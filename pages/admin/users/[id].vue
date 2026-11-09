<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from "vue";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "vue-sonner";
import { useAdminLiveUpdates } from "~/composables/useAdminLiveUpdates";
import { serverDeletionErrorKey } from "~/utils/serverDeletion";
import type {
  AdminTeam,
  AdminUserRow,
  AdminStaffRole,
  AdminServerSummary,
  AdminSiteSummary,
  AdminSubscriptionSummary,
} from "~/types";
import { adminService } from "~/services/adminService";
import { useAuth } from "~/composables/useAuth";
import { useImpersonation } from "~/composables/useImpersonation";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import UserSitesTable from "~/components/admin/UserSitesTable.vue";
import UserServersTable from "~/components/admin/UserServersTable.vue";
import UserStaffRoleControl from "~/components/admin/UserStaffRoleControl.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const route = useRoute();
const userId = route.params.id as string;
const { locale, t, te } = useI18n();
const { user: currentUser } = useAuth();
const isSuperAdmin = computed(
  () => currentUser.value?.staff_role === "super_admin",
);
const isSelf = computed(() => String(currentUser.value?.id) === userId);

const { start } = useImpersonation();

const user = ref<AdminUserRow | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const busy = ref<
  "suspend" | "unsuspend" | "delete" | "spectate" | "role" | null
>(null);
const actionErrorMessage = ref("");
const roleError = ref("");
const siteDeleteBusy = ref<string | null>(null);
const siteDeleteErrors = ref<Record<string, string>>({});
const requestedSiteIds = ref<string[]>([]);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);
const mutationBusy = computed(() => !!busy.value || !!siteDeleteBusy.value);

useHead({
  title: () =>
    t("admin.userDetail.pageTitle", {
      name: user.value?.name ?? t("admin.common.user"),
    }),
});

function applyBreadcrumb(): void {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.users"), to: "/admin" },
    { label: user.value?.name || t("admin.common.user") },
  ]);
}
applyBreadcrumb();
watch(locale, applyBreadcrumb);

const isSuspended = computed(() => user.value?.status === "suspended");
const statusVariant = computed(() =>
  isSuspended.value ? "destructive" : "green",
);
const userStatusLabel = computed(() => {
  const status = user.value?.status || "active";
  const key = `admin.statuses.user.${status}`;
  return te(key) ? t(key) : status.replace(/_/g, " ");
});
const staffRoleLabel = computed(() => {
  const role = user.value?.staff_role;
  if (!role) return "";
  const key = `admin.statuses.staffRole.${role}`;
  return te(key) ? t(key) : role.replace(/_/g, " ");
});

const initials = computed(() =>
  (user.value?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2),
);

const activeSubs = computed(
  () =>
    user.value?.teams.filter((t) => t.subscription?.status === "active")
      .length ?? 0,
);

const formatNumber = (value: number): string =>
  value.toLocaleString(locale.value);

// Subscription → badge mapping (matches the teams chips elsewhere).
function subBadge(team: AdminTeam): {
  variant: "green" | "blue" | "orange" | "secondary";
  label: string;
} {
  const sub = team.subscription;
  if (!sub) {
    return {
      variant: "secondary",
      label: t("admin.statuses.subscription.free"),
    };
  }
  return statusBadge(sub.status, sub.trial_ends_at);
}

// Maps any subscription status to a badge variant + label, shared by the team
// chips and the Subscriptions tab.
function statusBadge(
  status: string,
  trialEndsAt?: string | null,
): {
  variant: "green" | "blue" | "orange" | "secondary";
  label: string;
} {
  switch (status) {
    case "active":
      return {
        variant: "green",
        label: t("admin.statuses.subscription.active"),
      };
    case "on_trial": {
      const days = trialEndsAt
        ? differenceInCalendarDays(new Date(trialEndsAt), new Date())
        : null;
      return {
        variant: "blue",
        label:
          days !== null
            ? t("admin.statuses.subscription.trialDays", {
                days: formatNumber(days),
              })
            : t("admin.statuses.subscription.trial"),
      };
    }
    case "past_due":
    case "unpaid":
      return {
        variant: "orange",
        label: t(`admin.statuses.subscription.${status}`),
      };
    default:
      return {
        variant: "secondary",
        label: te(`admin.statuses.subscription.${status}`)
          ? t(`admin.statuses.subscription.${status}`)
          : status.replace(/_/g, " "),
      };
  }
}

// Lazy-loaded resource tabs. Each fetches on first activation and caches.
type TabKey = "profile" | "teams" | "servers" | "sites";
type ResourceKey = TabKey | "subscriptions";
const activeTab = computed<TabKey>(() => {
  const tab = route.query.tab;
  return typeof tab === "string" && ["teams", "servers", "sites"].includes(tab)
    ? (tab as TabKey)
    : "profile";
});

const servers = ref<AdminServerSummary[]>([]);
const sites = ref<AdminSiteSummary[]>([]);
const subscriptions = ref<AdminSubscriptionSummary[]>([]);

const loaded = ref<Record<ResourceKey, boolean>>({
  profile: true,
  teams: true,
  subscriptions: false,
  servers: false,
  sites: false,
});
const loadingTab = ref<Record<ResourceKey, boolean>>({
  profile: false,
  teams: false,
  subscriptions: false,
  servers: false,
  sites: false,
});

const tabErrors = ref<Partial<Record<ResourceKey, string>>>({});
const tabVersions: Record<ResourceKey, number> = {
  profile: 0,
  teams: 0,
  subscriptions: 0,
  servers: 0,
  sites: 0,
};

async function loadTab(tab: ResourceKey, force = false): Promise<void> {
  if (
    tab === "profile" ||
    tab === "teams" ||
    (loaded.value[tab] && !force) ||
    (loadingTab.value[tab] && !force)
  ) {
    return;
  }

  const version = ++tabVersions[tab];
  loadingTab.value[tab] = true;
  try {
    if (tab === "servers") {
      const res = await adminService.userServers(userId);
      if (disposed || version !== tabVersions[tab]) return;
      servers.value = res.data ?? [];
    } else if (tab === "sites") {
      const res = await adminService.userSites(userId);
      if (disposed || version !== tabVersions[tab]) return;
      sites.value = res.data ?? [];
      requestedSiteIds.value = requestedSiteIds.value.filter((id) =>
        sites.value.some(
          (site) => site.id === id && !site.uninstallation_failed_at,
        ),
      );
    } else if (tab === "subscriptions") {
      const res = await adminService.userSubscriptions(userId);
      if (disposed || version !== tabVersions[tab]) return;
      subscriptions.value = res.data ?? [];
    }
    loaded.value[tab] = true;
    tabErrors.value[tab] = "";
  } catch {
    if (disposed || version !== tabVersions[tab]) return;
    tabErrors.value[tab] = t("admin.userDetail.loadTabFailed", {
      resource: t(`admin.userDetail.tabs.${tab}`),
    });
  } finally {
    if (version === tabVersions[tab]) loadingTab.value[tab] = false;
  }
}

let loadVersion = 0;
let disposed = false;
onScopeDispose(() => {
  disposed = true;
  loadVersion++;
});

async function load(): Promise<void> {
  const version = ++loadVersion;
  isLoading.value = !user.value;
  try {
    const res = await adminService.showUser(userId);
    if (disposed || version !== loadVersion) return;
    notFound.value = false;
    user.value = res.data;
    applyBreadcrumb();
  } catch (error: unknown) {
    if (disposed || version !== loadVersion) return;
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      notFound.value = true;
    } else {
      toast.error(t("admin.userDetail.loadFailed"));
    }
  } finally {
    if (version === loadVersion) isLoading.value = false;
  }
}

function actionError(error: unknown, fallback: string): void {
  const err = error as { data?: { message?: string } };
  actionErrorMessage.value = err.data?.message || fallback;
}

async function suspend(): Promise<void> {
  if (!isSuperAdmin.value || isSelf.value || mutationBusy.value) return;
  actionErrorMessage.value = "";
  busy.value = "suspend";
  try {
    await adminService.suspendUser(userId);
    toast.success(t("admin.userDetail.suspended"));
    await load();
  } catch (error: unknown) {
    actionError(error, t("admin.userDetail.suspendFailed"));
  } finally {
    busy.value = null;
  }
}

async function unsuspend(): Promise<void> {
  if (!isSuperAdmin.value || isSelf.value || mutationBusy.value) return;
  actionErrorMessage.value = "";
  busy.value = "unsuspend";
  try {
    await adminService.unsuspendUser(userId);
    toast.success(t("admin.userDetail.unsuspended"));
    await load();
  } catch (error: unknown) {
    actionError(error, t("admin.userDetail.unsuspendFailed"));
  } finally {
    busy.value = null;
  }
}

async function remove(): Promise<void> {
  if (
    !isSuperAdmin.value ||
    isSelf.value ||
    user.value?.staff_role ||
    mutationBusy.value ||
    !user.value ||
    !confirmationDialog.value
  )
    return;
  const result = await confirmationDialog.value.show({
    title: t("admin.userDetail.deleteTitle"),
    description: t("admin.userDetail.deleteDescription", {
      name: user.value.name,
    }),
    confirmText: t("admin.userDetail.deleteUser"),
    destructive: true,
  });
  if (!result.ok || mutationBusy.value) return;
  actionErrorMessage.value = "";
  busy.value = "delete";
  try {
    await adminService.deleteUser(userId);
    toast.success(t("admin.userDetail.deleted"));
    navigateTo("/admin");
  } catch (error: unknown) {
    actionError(error, t("admin.userDetail.deleteFailed"));
    busy.value = null;
  }
}

async function spectate(): Promise<void> {
  if (mutationBusy.value) return;
  actionErrorMessage.value = "";
  busy.value = "spectate";
  try {
    await start(userId, t("admin.userDetail.supportSessionReason"));
  } catch (error: unknown) {
    actionError(error, t("admin.userDetail.spectateFailed"));
    busy.value = null;
  }
}

async function changeStaffRole(role: AdminStaffRole | null): Promise<void> {
  if (
    !isSuperAdmin.value ||
    isSelf.value ||
    mutationBusy.value ||
    !user.value ||
    !confirmationDialog.value ||
    role === (user.value.staff_role ?? null)
  )
    return;
  const label = role
    ? t(`admin.statuses.staffRole.${role}`)
    : t("admin.userDetail.regularUser");
  const result = await confirmationDialog.value.show({
    title: t("admin.userDetail.changeRoleTitle"),
    description: t("admin.userDetail.changeRoleDescription", {
      email: user.value.email,
      role: label,
    }),
    warning: t(
      role
        ? "admin.userDetail.grantStaffWarning"
        : "admin.userDetail.removeStaffWarning",
    ),
    confirmText: t("admin.userDetail.saveRole"),
    destructive: role === null,
  });
  if (!result.ok || mutationBusy.value) return;
  busy.value = "role";
  roleError.value = "";
  try {
    const response = await adminService.updateStaffRole(userId, role);
    user.value.staff_role = response.data.staff_role;
    await load();
    toast.success(t("admin.userDetail.roleUpdated"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    roleError.value =
      err.data?.message || t("admin.userDetail.roleUpdateFailed");
  } finally {
    busy.value = null;
  }
}

async function removeSite(site: AdminSiteSummary): Promise<void> {
  if (
    !isSuperAdmin.value ||
    mutationBusy.value ||
    requestedSiteIds.value.includes(site.id) ||
    (site.uninstallation_requested_at && !site.uninstallation_failed_at) ||
    !confirmationDialog.value
  )
    return;
  const result = await confirmationDialog.value.show({
    title: t("admin.userDetail.deleteSite"),
    description: t("admin.userDetail.deleteSiteDescription", {
      address: site.address,
      server: site.server_name,
    }),
    warning: t("admin.userDetail.deleteSiteWarning"),
    inputVerificationText: site.address,
    helpText: t("admin.userDetail.deleteSiteHelp"),
    confirmText: t("admin.userDetail.deleteSite"),
    destructive: true,
  });
  if (!result.ok || mutationBusy.value) return;
  siteDeleteBusy.value = site.id;
  siteDeleteErrors.value[site.id] = "";
  try {
    await adminService.deleteSite(site.id, site.address);
    requestedSiteIds.value.push(site.id);
    toast.success(t("admin.userDetail.siteDeletionRequested"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    siteDeleteErrors.value[site.id] =
      err.data?.message || t("admin.userDetail.siteDeletionFailed");
  } finally {
    siteDeleteBusy.value = null;
  }
}

useAdminLiveUpdates(
  async () => {
    await Promise.all([
      load(),
      ...(["servers", "sites", "subscriptions"] as ResourceKey[])
        .filter((tab) => loaded.value[tab] || loadingTab.value[tab])
        .map((tab) => loadTab(tab, true)),
    ]);
  },
  {
    resources: ["user", "team", "subscription", "server", "site", "docker"],
    userId,
    paused: mutationBusy,
    onChange(change) {
      if (change.resource === "server" && change.action === "deletion_failed") {
        toast.error(t(serverDeletionErrorKey(change.error_code)));
      }
    },
  },
);

watch(
  activeTab,
  (tab) => void loadTab(tab === "profile" ? "subscriptions" : tab),
  { immediate: true },
);
onMounted(load);
</script>

<template>
  <div class="pb-10">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16"
    >
      <Icon name="lucide:user-x" class="h-10 w-10 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        {{ t("admin.userDetail.notFound") }}
      </p>
      <Button variant="outline" size="sm" @click="navigateTo('/admin')">
        {{ t("admin.userDetail.backToUsers") }}
      </Button>
    </div>

    <div v-else-if="user" class="space-y-6">
      <header v-if="activeTab === 'profile'" class="space-y-5">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex min-w-0 items-center gap-4">
            <Avatar v-if="activeTab === 'profile'" class="h-10 w-10 shrink-0">
              <AvatarFallback class="bg-muted text-sm font-medium">{{
                initials
              }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl font-semibold">
                  {{ user.name }}
                </h1>
                <Badge
                  v-if="activeTab === 'profile'"
                  :variant="statusVariant"
                  >{{ userStatusLabel }}</Badge
                >
                <Badge
                  v-if="activeTab === 'profile' && user.staff_role"
                  variant="secondary"
                  >{{ staffRoleLabel }}</Badge
                >
              </div>
              <p
                v-if="activeTab === 'profile'"
                class="break-all text-sm text-muted-foreground"
              >
                {{ user.email }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="mutationBusy"
              @click="spectate"
            >
              <Icon
                :name="busy === 'spectate' ? 'lucide:loader-2' : 'lucide:eye'"
                class="h-4 w-4"
                :class="{ 'animate-spin': busy === 'spectate' }"
              />
              {{ t("admin.userDetail.spectate") }}
            </Button>
            <DropdownMenu v-if="isSuperAdmin && !isSelf">
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="t('admin.common.moreActions')"
                  :disabled="mutationBusy"
                >
                  <Icon name="lucide:ellipsis" class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  v-if="!isSuspended"
                  :disabled="mutationBusy"
                  @select="suspend"
                >
                  <Icon name="lucide:ban" class="h-4 w-4" />
                  {{ t("admin.userDetail.suspend") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-else
                  :disabled="mutationBusy"
                  @select="unsuspend"
                >
                  <Icon name="lucide:circle-check" class="h-4 w-4" />
                  {{ t("admin.userDetail.unsuspend") }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  :disabled="mutationBusy || !!user.staff_role"
                  :aria-describedby="
                    user.staff_role ? 'staff-deletion-help' : undefined
                  "
                  @select="remove"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                  {{ t("admin.userDetail.deleteUser") }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <dl
          v-if="activeTab === 'profile'"
          class="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:pl-14"
        >
          <div class="flex items-center gap-2">
            <dt class="text-muted-foreground">
              {{ t("admin.userDetail.tabs.teams") }}
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ formatNumber(user.teams.length) }}
            </dd>
          </div>
          <div class="flex items-center gap-2">
            <dt class="text-muted-foreground">
              {{ t("admin.userDetail.activeSubscriptionsShort") }}
            </dt>
            <dd class="font-semibold tabular-nums">
              {{ formatNumber(activeSubs) }}
            </dd>
          </div>
          <div class="flex items-center gap-2">
            <dt class="text-muted-foreground">
              {{ t("admin.userDetail.joined") }}
            </dt>
            <dd class="font-medium">
              <SharedDateTooltip
                v-if="user.created_at"
                :date="user.created_at"
              /><span v-else>—</span>
            </dd>
          </div>
        </dl>
        <p
          v-if="actionErrorMessage"
          role="alert"
          class="text-sm text-destructive"
        >
          {{ actionErrorMessage }}
        </p>
      </header>
      <div
        v-if="isSuperAdmin && activeTab === 'profile'"
        class="space-y-2 border-y border-border/70 py-5"
      >
        <UserStaffRoleControl
          :role="user.staff_role"
          :is-self="isSelf"
          :disabled="mutationBusy"
          :busy="busy === 'role'"
          :error="roleError"
          @save="changeStaffRole"
        />
      </div>
      <p
        v-if="
          activeTab === 'profile' && isSuperAdmin && user.staff_role && !isSelf
        "
        id="staff-deletion-help"
        class="text-xs leading-relaxed text-muted-foreground"
      >
        {{ t("admin.userDetail.demoteBeforeDelete") }}
      </p>
      <!-- Subscriptions -->
      <section
        v-if="activeTab === 'profile'"
        aria-labelledby="user-subscriptions-title"
        class="space-y-3"
      >
        <h2 id="user-subscriptions-title" class="text-sm font-semibold">
          {{ t("admin.userDetail.tabs.subscriptions") }}
        </h2>
        <div
          v-if="tabErrors.subscriptions"
          role="alert"
          class="flex items-center justify-between gap-3 text-sm text-destructive"
        >
          <p>{{ tabErrors.subscriptions }}</p>
          <Button
            variant="outline"
            size="sm"
            :disabled="loadingTab.subscriptions"
            @click="loadTab('subscriptions', true)"
          >
            {{ t("admin.userDetail.retry") }}
          </Button>
        </div>
        <div
          v-if="loadingTab.subscriptions && !loaded.subscriptions"
          class="flex items-center justify-center py-6"
          role="status"
          :aria-label="t('server.common.loading')"
        >
          <Icon
            name="lucide:loader-2"
            class="h-6 w-6 animate-spin text-muted-foreground"
          />
        </div>
        <div v-else-if="subscriptions.length" class="divide-y divide-border/60">
          <div
            v-for="(sub, i) in subscriptions"
            :key="`${sub.team_id}-${i}`"
            class="flex items-center justify-between gap-4 py-3"
          >
            <div class="flex items-center gap-3">
              <div>
                <p class="text-sm font-medium">{{ sub.team_name }}</p>
                <p class="text-xs text-muted-foreground">
                  <template
                    v-if="sub.status === 'on_trial' && sub.trial_ends_at"
                  >
                    {{ t("admin.userDetail.trialEnds") }}
                    <SharedDateTooltip :date="sub.trial_ends_at" />
                  </template>
                  <template v-else-if="sub.ends_at">
                    {{ t("admin.userDetail.ends") }}
                    <SharedDateTooltip :date="sub.ends_at" />
                  </template>
                  <template v-else-if="sub.renews_at">
                    {{ t("admin.userDetail.renews") }}
                    <SharedDateTooltip :date="sub.renews_at" />
                  </template>
                  <template v-if="sub.card_last_four">
                    · •••• {{ sub.card_last_four }}
                  </template>
                </p>
              </div>
            </div>
            <Badge
              :variant="statusBadge(sub.status, sub.trial_ends_at).variant"
            >
              {{ statusBadge(sub.status, sub.trial_ends_at).label }}
            </Badge>
          </div>
        </div>
        <p
          v-else-if="!tabErrors.subscriptions"
          class="py-3 text-sm text-muted-foreground"
        >
          {{ t("admin.userDetail.noSubscriptions") }}
        </p>
      </section>

      <!-- User resources -->
      <div v-if="activeTab !== 'profile'" class="min-w-0 flex-1">
        <h1 class="sr-only">{{ t(`admin.userDetail.tabs.${activeTab}`) }}</h1>
        <div
          v-if="tabErrors[activeTab]"
          role="alert"
          class="my-3 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <p>{{ tabErrors[activeTab] }}</p>
          <Button
            variant="outline"
            size="sm"
            :disabled="loadingTab[activeTab]"
            @click="loadTab(activeTab, true)"
            >{{ t("admin.userDetail.retry") }}</Button
          >
        </div>

        <!-- Teams -->
        <section
          v-if="activeTab === 'teams'"
          :aria-label="t('admin.userDetail.tabs.teams')"
        >
          <div v-if="user.teams.length" class="divide-y divide-border/60">
            <div
              v-for="team in user.teams"
              :key="team.id"
              class="flex items-center justify-between gap-4 py-4"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60"
                >
                  <Icon
                    :name="
                      team.personal_team ? 'lucide:user' : 'lucide:users-round'
                    "
                    class="h-4 w-4 text-muted-foreground"
                  />
                </div>
                <div>
                  <p class="text-sm font-medium">{{ team.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{
                      team.personal_team
                        ? t("admin.userDetail.personalTeam")
                        : t("admin.userDetail.team")
                    }}
                  </p>
                </div>
              </div>
              <Badge :variant="subBadge(team).variant">
                {{ subBadge(team).label }}
              </Badge>
            </div>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center gap-3 py-16 text-center"
          >
            <Icon
              name="lucide:users"
              class="h-8 w-8 text-muted-foreground/50"
            />
            <p class="text-sm text-muted-foreground">
              {{ t("admin.userDetail.noTeams") }}
            </p>
          </div>
        </section>

        <!-- Servers -->
        <section
          v-if="activeTab === 'servers'"
          :aria-label="t('admin.userDetail.tabs.servers')"
        >
          <UserServersTable
            :servers="servers"
            :loading="loadingTab.servers"
            :loaded="loaded.servers"
          />
        </section>

        <!-- Sites -->
        <section
          v-if="activeTab === 'sites'"
          :aria-label="t('admin.userDetail.tabs.sites')"
        >
          <UserSitesTable
            :sites="sites"
            :loading="loadingTab.sites"
            :can-delete="isSuperAdmin"
            :disabled="mutationBusy"
            :busy-id="siteDeleteBusy"
            :pending-ids="requestedSiteIds"
            :errors="siteDeleteErrors"
            @delete="removeSite"
          />
        </section>
      </div>
    </div>
  </div>
</template>

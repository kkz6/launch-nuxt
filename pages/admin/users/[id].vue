<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "vue-sonner";
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
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import UserSitesTable from "~/components/admin/UserSitesTable.vue";
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
const serverSearch = ref("");

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

const serverStatusText = (status: string): string => {
  const key = `admin.statuses.server.${status}`;
  return te(key) ? t(key) : status.replace(/_/g, " ");
};

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

// Provider/status badge for a server row.
function serverBadge(server: AdminServerSummary): {
  variant: "green" | "secondary";
  label: string;
} {
  if (server.status === "running" && server.connected) {
    return {
      variant: "green",
      label: t("admin.statuses.server.running"),
    };
  }
  return {
    variant: "secondary",
    label: te(`admin.statuses.server.${server.status}`)
      ? t(`admin.statuses.server.${server.status}`)
      : server.status.replace(/_/g, " "),
  };
}

// Lazy-loaded resource tabs. Each fetches on first activation and caches.
type TabKey = "teams" | "subscriptions" | "servers" | "sites";
const activeTab = ref<TabKey>("teams");

const servers = ref<AdminServerSummary[]>([]);
const filteredServers = computed(() => {
  const query = serverSearch.value.trim().toLocaleLowerCase();
  return servers.value.filter((server) =>
    `${server.name} ${server.public_ipv4 || ""} ${server.provider}`
      .toLocaleLowerCase()
      .includes(query),
  );
});
const sites = ref<AdminSiteSummary[]>([]);
const subscriptions = ref<AdminSubscriptionSummary[]>([]);

const loaded = ref<Record<TabKey, boolean>>({
  teams: true,
  subscriptions: false,
  servers: false,
  sites: false,
});
const loadingTab = ref<Record<TabKey, boolean>>({
  teams: false,
  subscriptions: false,
  servers: false,
  sites: false,
});

const tabErrors = ref<Partial<Record<TabKey, string>>>({});

async function loadTab(tab: TabKey, force = false): Promise<void> {
  if (
    tab === "teams" ||
    (loaded.value[tab] && !force) ||
    loadingTab.value[tab]
  ) {
    return;
  }

  loadingTab.value[tab] = true;
  try {
    if (tab === "servers") {
      const res = await adminService.userServers(userId);
      servers.value = res.data ?? [];
    } else if (tab === "sites") {
      const res = await adminService.userSites(userId);
      sites.value = res.data ?? [];
      requestedSiteIds.value = requestedSiteIds.value.filter((id) =>
        sites.value.some(
          (site) => site.id === id && !site.uninstallation_failed_at,
        ),
      );
    } else if (tab === "subscriptions") {
      const res = await adminService.userSubscriptions(userId);
      subscriptions.value = res.data ?? [];
    }
    loaded.value[tab] = true;
    tabErrors.value[tab] = "";
  } catch {
    tabErrors.value[tab] = t("admin.userDetail.loadTabFailed", {
      resource: t(`admin.userDetail.tabs.${tab}`),
    });
  } finally {
    loadingTab.value[tab] = false;
  }
}

function onTabChange(value: string | number): void {
  const tab = value as TabKey;
  activeTab.value = tab;
  void loadTab(tab);
}

async function load(): Promise<void> {
  isLoading.value = true;
  try {
    const res = await adminService.showUser(userId);
    user.value = res.data;
    applyBreadcrumb();
  } catch (error: unknown) {
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      notFound.value = true;
    } else {
      toast.error(t("admin.userDetail.loadFailed"));
    }
  } finally {
    isLoading.value = false;
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
      <header class="space-y-5">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex min-w-0 items-center gap-4">
            <Avatar class="h-10 w-10 shrink-0">
              <AvatarFallback
                class="bg-muted text-sm font-medium"
                >{{ initials }}</AvatarFallback
              >
            </Avatar>
            <div class="min-w-0 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <h1
                  class="text-xl font-semibold"
                >
                  {{ user.name }}
                </h1>
                <Badge :variant="statusVariant">{{ userStatusLabel }}</Badge>
                <Badge v-if="user.staff_role" variant="secondary">{{
                  staffRoleLabel
                }}</Badge>
              </div>
              <p class="break-all text-sm text-muted-foreground">
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
            <template v-if="isSuperAdmin && !isSelf">
              <Button
                v-if="!isSuspended"
                variant="outline"
                size="sm"
                :disabled="mutationBusy"
                @click="suspend"
                >{{ t("admin.userDetail.suspend") }}</Button
              >
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="mutationBusy"
                @click="unsuspend"
                >{{ t("admin.userDetail.unsuspend") }}</Button
              >
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                :disabled="mutationBusy || !!user.staff_role"
                :aria-describedby="
                  user.staff_role ? 'staff-deletion-help' : undefined
                "
                @click="remove"
              >
                {{ t("admin.userDetail.deleteUser") }}
              </Button>
            </template>
          </div>
        </div>
        <dl class="flex flex-wrap gap-x-6 gap-y-2 text-xs sm:pl-16">
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
      <div v-if="isSuperAdmin" class="space-y-2 border-y border-border/70 py-5">
        <UserStaffRoleControl
          :role="user.staff_role"
          :is-self="isSelf"
          :disabled="mutationBusy"
          :busy="busy === 'role'"
          :error="roleError"
          @save="changeStaffRole"
        />
        <p
          v-if="user.staff_role && !isSelf"
          id="staff-deletion-help"
          class="text-xs leading-relaxed text-muted-foreground"
        >
          {{ t("admin.userDetail.demoteBeforeDelete") }}
        </p>
      </div>

      <!-- User resources -->
      <div class="min-w-0 flex-1">
        <Tabs :model-value="activeTab" @update:model-value="onTabChange">
          <TabsList
            class="mb-6 flex w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border/70 bg-transparent p-0 sm:gap-7"
          >
            <TabsTrigger
              value="teams"
              class="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {{ t("admin.userDetail.tabs.teams") }}
              <span class="ml-2 text-xs tabular-nums text-muted-foreground">
                {{ formatNumber(user.teams.length) }}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="subscriptions"
              class="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {{ t("admin.userDetail.tabs.subscriptions") }}
              <span
                v-if="loaded.subscriptions"
                class="ml-2 text-xs tabular-nums text-muted-foreground"
              >
                {{ formatNumber(subscriptions.length) }}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="servers"
              class="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {{ t("admin.userDetail.tabs.servers") }}
              <span
                v-if="loaded.servers"
                class="ml-2 text-xs tabular-nums text-muted-foreground"
              >
                {{ formatNumber(servers.length) }}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="sites"
              class="relative -mb-px rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {{ t("admin.userDetail.tabs.sites") }}
              <span
                v-if="loaded.sites"
                class="ml-2 text-xs tabular-nums text-muted-foreground"
              >
                {{ formatNumber(sites.length) }}
              </span>
            </TabsTrigger>
          </TabsList>

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
              >{{ t("admin.userDetail.refresh") }}</Button
            >
          </div>

          <!-- Teams -->
          <TabsContent value="teams">
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
                        team.personal_team
                          ? 'lucide:user'
                          : 'lucide:users-round'
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
          </TabsContent>

          <!-- Subscriptions -->
          <TabsContent value="subscriptions">
            <div
              v-if="loadingTab.subscriptions"
              class="flex items-center justify-center py-16"
            >
              <Icon
                name="lucide:loader-2"
                class="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
            <div
              v-else-if="subscriptions.length"
              class="divide-y divide-border/60"
            >
              <div
                v-for="(sub, i) in subscriptions"
                :key="`${sub.team_id}-${i}`"
                class="flex items-center justify-between gap-4 py-4"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60"
                  >
                    <Icon
                      name="lucide:credit-card"
                      class="h-4 w-4 text-muted-foreground"
                    />
                  </div>
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
            <div
              v-else
              class="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <Icon
                name="lucide:credit-card"
                class="h-8 w-8 text-muted-foreground/50"
              />
              <p class="text-sm text-muted-foreground">
                {{ t("admin.userDetail.noSubscriptions") }}
              </p>
            </div>
          </TabsContent>

          <!-- Servers -->
          <TabsContent value="servers" class="space-y-4">
            <div class="relative max-w-sm">
              <Label for="admin-server-search" class="sr-only">{{
                t("admin.userDetail.searchServers")
              }}</Label>
              <Icon
                name="lucide:search"
                class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="admin-server-search"
                v-model="serverSearch"
                type="search"
                class="h-9 border-border/70 bg-background pl-9 shadow-none"
                :placeholder="t('admin.userDetail.searchServersPlaceholder')"
              />
            </div>
            <div
              v-if="loadingTab.servers"
              class="flex items-center justify-center py-16"
            >
              <Icon
                name="lucide:loader-2"
                class="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
            <div
              v-else-if="filteredServers.length"
              class="divide-y divide-border/60"
            >
              <NuxtLink
                v-for="server in filteredServers"
                :key="server.id"
                :to="`/admin/servers/${server.id}`"
                class="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-muted/30"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60"
                  >
                    <Icon
                      name="lucide:server"
                      class="h-4 w-4 text-muted-foreground"
                    />
                  </div>
                  <div>
                    <p class="text-sm font-medium">{{ server.name }}</p>
                    <p class="text-xs capitalize text-muted-foreground">
                      {{ server.provider.replace("_", " ") }} ·
                      {{ serverStatusText(server.status) }}
                    </p>
                  </div>
                </div>
                <Badge :variant="serverBadge(server).variant">
                  {{ serverBadge(server).label }}
                </Badge>
              </NuxtLink>
            </div>
            <div
              v-else
              class="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <Icon
                name="lucide:server"
                class="h-8 w-8 text-muted-foreground/50"
              />
              <p class="text-sm text-muted-foreground">
                {{
                  serverSearch.trim()
                    ? t("admin.userDetail.noMatchingServers")
                    : t("admin.userDetail.noServers")
                }}
              </p>
            </div>
          </TabsContent>

          <!-- Sites -->
          <TabsContent value="sites">
            <UserSitesTable
              :sites="sites"
              :loading="loadingTab.sites"
              :can-delete="isSuperAdmin"
              :disabled="mutationBusy"
              :busy-id="siteDeleteBusy"
              :pending-ids="requestedSiteIds"
              :errors="siteDeleteErrors"
              @delete="removeSite"
              @refresh="loadTab('sites', true)"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>

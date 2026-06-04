<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "vue-sonner";
import type {
  AdminTeam,
  AdminUserRow,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const route = useRoute();
const userId = route.params.id as string;

const { user: currentUser } = useAuth();
const isSuperAdmin = computed(
  () => currentUser.value?.staff_role === "super_admin",
);
const isSelf = computed(() => String(currentUser.value?.id) === userId);

const { start } = useImpersonation();

const user = ref<AdminUserRow | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const busy = ref<"suspend" | "unsuspend" | "delete" | "spectate" | null>(null);

useHead({ title: () => `Admin — ${user.value?.name ?? "User"}` });

function applyBreadcrumb(): void {
  setBreadcrumbs([
    { label: "Admin", to: "/admin/overview" },
    { label: "Users", to: "/admin" },
    { label: user.value?.name || "User" },
  ]);
}
applyBreadcrumb();

const isSuspended = computed(() => user.value?.status === "suspended");
const statusVariant = computed(() =>
  isSuspended.value ? "destructive" : "green",
);

const initials = computed(() =>
  (user.value?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2),
);

const joined = computed(() =>
  user.value?.created_at
    ? new Date(user.value.created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—",
);

const activeSubs = computed(
  () =>
    user.value?.teams.filter((t) => t.subscription?.status === "active")
      .length ?? 0,
);

// Subscription → badge mapping (matches the teams chips elsewhere).
function subBadge(team: AdminTeam): {
  variant: "green" | "blue" | "orange" | "secondary";
  label: string;
} {
  const sub = team.subscription;
  if (!sub) return { variant: "secondary", label: "free" };
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
      return { variant: "green", label: "active" };
    case "on_trial": {
      const days = trialEndsAt
        ? differenceInCalendarDays(new Date(trialEndsAt), new Date())
        : null;
      return {
        variant: "blue",
        label: days !== null ? `trial · ${days}d` : "trial",
      };
    }
    case "past_due":
    case "unpaid":
      return { variant: "orange", label: status.replace("_", " ") };
    default:
      return { variant: "secondary", label: status };
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Provider/status badge for a server row.
function serverBadge(server: AdminServerSummary): {
  variant: "green" | "secondary";
  label: string;
} {
  if (server.status === "running" && server.connected) {
    return { variant: "green", label: server.status };
  }
  return { variant: "secondary", label: server.status };
}

// Lazy-loaded resource tabs. Each fetches on first activation and caches.
type TabKey = "teams" | "subscriptions" | "servers" | "sites";
const activeTab = ref<TabKey>("teams");

const servers = ref<AdminServerSummary[]>([]);
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

async function loadTab(tab: TabKey): Promise<void> {
  if (tab === "teams" || loaded.value[tab] || loadingTab.value[tab]) {
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
    } else if (tab === "subscriptions") {
      const res = await adminService.userSubscriptions(userId);
      subscriptions.value = res.data ?? [];
    }
    loaded.value[tab] = true;
  } catch {
    toast.error(`Failed to load ${tab}`);
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
      toast.error("Failed to load user");
    }
  } finally {
    isLoading.value = false;
  }
}

function actionError(error: unknown, fallback: string): void {
  const err = error as { data?: { message?: string } };
  toast.error(err.data?.message || fallback);
}

async function suspend(): Promise<void> {
  busy.value = "suspend";
  try {
    await adminService.suspendUser(userId);
    toast.success("User suspended");
    await load();
  } catch (error: unknown) {
    actionError(error, "Failed to suspend user");
  } finally {
    busy.value = null;
  }
}

async function unsuspend(): Promise<void> {
  busy.value = "unsuspend";
  try {
    await adminService.unsuspendUser(userId);
    toast.success("User unsuspended");
    await load();
  } catch (error: unknown) {
    actionError(error, "Failed to unsuspend user");
  } finally {
    busy.value = null;
  }
}

async function remove(): Promise<void> {
  busy.value = "delete";
  try {
    await adminService.deleteUser(userId);
    toast.success("User deleted");
    navigateTo("/admin");
  } catch (error: unknown) {
    actionError(error, "Failed to delete user");
    busy.value = null;
  }
}

async function spectate(): Promise<void> {
  busy.value = "spectate";
  try {
    await start(userId, "Staff support session");
  } catch (error: unknown) {
    actionError(error, "Failed to start spectate session");
    busy.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="pb-10">
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
      <p class="text-sm text-muted-foreground">This user no longer exists.</p>
      <Button variant="outline" size="sm" @click="navigateTo('/admin')">
        Back to users
      </Button>
    </div>

    <div v-else-if="user" class="flex flex-col gap-8 lg:flex-row">
      <!-- Left rail: identity, key facts, actions -->
      <aside
        class="shrink-0 space-y-5 lg:sticky lg:top-4 lg:w-72 lg:self-start lg:border-r lg:pr-8"
      >
        <div class="space-y-3">
          <Avatar class="h-16 w-16">
            <AvatarFallback class="text-lg font-semibold">
              {{ initials }}
            </AvatarFallback>
          </Avatar>
          <div class="space-y-1.5">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ user.name }}
            </h1>
            <div class="flex flex-wrap items-center gap-2">
              <Badge :variant="statusVariant" class="capitalize">
                {{ user.status }}
              </Badge>
              <span
                v-if="user.staff_role"
                class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
              >
                <Icon name="lucide:shield" class="h-3.5 w-3.5" />
                {{ user.staff_role }}
              </span>
            </div>
            <p class="break-all text-sm text-muted-foreground">
              {{ user.email }}
            </p>
          </div>
        </div>

        <dl class="space-y-2.5 border-t pt-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Teams</dt>
            <dd class="font-medium">{{ user.teams.length }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Active subs</dt>
            <dd class="font-medium">{{ activeSubs }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Joined</dt>
            <dd class="font-medium">{{ joined }}</dd>
          </div>
        </dl>

        <div class="flex flex-col gap-1.5 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            class="justify-start"
            :disabled="busy === 'spectate'"
            @click="spectate"
          >
            <Icon
              :name="busy === 'spectate' ? 'lucide:loader-2' : 'lucide:eye'"
              class="h-4 w-4"
              :class="{ 'animate-spin': busy === 'spectate' }"
            />
            Spectate
          </Button>

          <template v-if="isSuperAdmin && !isSelf">
            <Button
              v-if="!isSuspended"
              variant="outline"
              size="sm"
              class="justify-start"
              :disabled="busy === 'suspend'"
              @click="suspend"
            >
              <Icon
                :name="busy === 'suspend' ? 'lucide:loader-2' : 'lucide:ban'"
                class="h-4 w-4"
                :class="{ 'animate-spin': busy === 'suspend' }"
              />
              Suspend
            </Button>
            <Button
              v-else
              variant="outline"
              size="sm"
              class="justify-start"
              :disabled="busy === 'unsuspend'"
              @click="unsuspend"
            >
              <Icon
                :name="
                  busy === 'unsuspend'
                    ? 'lucide:loader-2'
                    : 'lucide:circle-check'
                "
                class="h-4 w-4"
                :class="{ 'animate-spin': busy === 'unsuspend' }"
              />
              Unsuspend
            </Button>

            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  :disabled="busy === 'delete'"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Permanently deletes {{ user.name }} and all their data. Only
                    allowed if they never had a paying subscription.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    @click="remove"
                  >
                    Delete user
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </template>
        </div>
      </aside>

      <!-- Right content: resource tabs -->
      <div class="min-w-0 flex-1">
        <Tabs :model-value="activeTab" @update:model-value="onTabChange">
          <TabsList>
            <TabsTrigger value="teams">
              Teams
              <span class="ml-1.5 text-xs text-muted-foreground">
                {{ user.teams.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions">
              Subscriptions
              <span
                v-if="loaded.subscriptions"
                class="ml-1.5 text-xs text-muted-foreground"
              >
                {{ subscriptions.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="servers">
              Servers
              <span
                v-if="loaded.servers"
                class="ml-1.5 text-xs text-muted-foreground"
              >
                {{ servers.length }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sites">
              Sites
              <span
                v-if="loaded.sites"
                class="ml-1.5 text-xs text-muted-foreground"
              >
                {{ sites.length }}
              </span>
            </TabsTrigger>
          </TabsList>

          <!-- Teams -->
          <TabsContent value="teams">
            <div v-if="user.teams.length" class="divide-y border-t">
              <div
                v-for="team in user.teams"
                :key="team.id"
                class="flex items-center justify-between gap-4 py-3.5"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
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
                      {{ team.personal_team ? "Personal team" : "Team" }}
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
              class="flex flex-col items-center justify-center gap-2 border-t py-16 text-center"
            >
              <Icon
                name="lucide:users"
                class="h-8 w-8 text-muted-foreground/50"
              />
              <p class="text-sm text-muted-foreground">
                This user does not own any teams.
              </p>
            </div>
          </TabsContent>

          <!-- Subscriptions -->
          <TabsContent value="subscriptions">
            <div
              v-if="loadingTab.subscriptions"
              class="flex items-center justify-center border-t py-16"
            >
              <Icon
                name="lucide:loader-2"
                class="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
            <div v-else-if="subscriptions.length" class="divide-y border-t">
              <div
                v-for="(sub, i) in subscriptions"
                :key="`${sub.team_id}-${i}`"
                class="flex items-center justify-between gap-4 py-3.5"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
                  >
                    <Icon
                      name="lucide:credit-card"
                      class="h-4 w-4 text-muted-foreground"
                    />
                  </div>
                  <div>
                    <p class="text-sm font-medium">{{ sub.team_name }}</p>
                    <p class="text-xs text-muted-foreground">
                      <template v-if="sub.status === 'on_trial'">
                        trial ends {{ formatDate(sub.trial_ends_at) }}
                      </template>
                      <template v-else-if="sub.ends_at">
                        ends {{ formatDate(sub.ends_at) }}
                      </template>
                      <template v-else>
                        renews {{ formatDate(sub.renews_at) }}
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
              class="flex flex-col items-center justify-center gap-2 border-t py-16 text-center"
            >
              <Icon
                name="lucide:credit-card"
                class="h-8 w-8 text-muted-foreground/50"
              />
              <p class="text-sm text-muted-foreground">
                This user has no subscriptions.
              </p>
            </div>
          </TabsContent>

          <!-- Servers -->
          <TabsContent value="servers">
            <div
              v-if="loadingTab.servers"
              class="flex items-center justify-center border-t py-16"
            >
              <Icon
                name="lucide:loader-2"
                class="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
            <div v-else-if="servers.length" class="divide-y border-t">
              <NuxtLink
                v-for="server in servers"
                :key="server.id"
                :to="`/admin/servers/${server.id}`"
                class="flex items-center justify-between gap-4 px-2 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
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
                      {{ server.status }}
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
              class="flex flex-col items-center justify-center gap-2 border-t py-16 text-center"
            >
              <Icon
                name="lucide:server"
                class="h-8 w-8 text-muted-foreground/50"
              />
              <p class="text-sm text-muted-foreground">
                This user does not own any servers.
              </p>
            </div>
          </TabsContent>

          <!-- Sites -->
          <TabsContent value="sites">
            <div
              v-if="loadingTab.sites"
              class="flex items-center justify-center border-t py-16"
            >
              <Icon
                name="lucide:loader-2"
                class="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
            <div v-else-if="sites.length" class="divide-y border-t">
              <div
                v-for="site in sites"
                :key="site.id"
                class="flex items-center justify-between gap-4 py-3.5"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
                  >
                    <Icon
                      name="lucide:globe"
                      class="h-4 w-4 text-muted-foreground"
                    />
                  </div>
                  <div>
                    <p class="text-sm font-medium">{{ site.address }}</p>
                    <p class="text-xs text-muted-foreground">
                      on {{ site.server_name }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <Badge variant="secondary" class="capitalize">
                    {{ site.type }}
                  </Badge>
                  <Badge variant="outline" class="uppercase">
                    {{ site.tls_setting }}
                  </Badge>
                </div>
              </div>
            </div>
            <div
              v-else
              class="flex flex-col items-center justify-center gap-2 border-t py-16 text-center"
            >
              <Icon
                name="lucide:globe"
                class="h-8 w-8 text-muted-foreground/50"
              />
              <p class="text-sm text-muted-foreground">
                This user does not have any sites.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>

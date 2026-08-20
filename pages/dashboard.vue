<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { locale, t } = useI18n();

useHead(() => ({ title: t("public.dashboard.pageTitle") }));

const { user } = useAuth();
const { open: openSettingsSheet } = useSettingsSheet();

// Check subscription status
const isSubscribed = computed(
  () => user.value?.current_team?.is_subscribed ?? true,
);

// Time-based greeting
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return t("public.dashboard.greetings.morning");
  if (hour < 18) return t("public.dashboard.greetings.afternoon");
  return t("public.dashboard.greetings.evening");
});

const firstName = computed(() => {
  return user.value?.name?.split(" ")[0] || "";
});

interface Server {
  id: string;
  name: string;
  status: string;
  provider: string;
  /**
   * "php" / "database" / "loadbalancer" / "docker" — matches the
   * server module's enum. Drives which workload count to show on
   * the card (sites for PHP, workloads for docker).
   */
  type?: string;
  sites_count: number;
  /**
   * Live count of docker workloads (applications + composes +
   * managed databases) for this server. Only meaningful when
   * `type === "docker"`; otherwise it's 0 and the card uses
   * `sites_count` instead.
   */
  workloads_count: number;
}

interface Activity {
  id: string;
  site_name: string;
  site_id: string;
  server_id: string;
  server_name: string;
  status: string;
  created_at: string;
  commit_sha: string;
  commit_message: string;
  user: {
    name: string;
  } | null;
}

interface DashboardResponse {
  data: {
    servers: Server[];
    recent_activity: Activity[];
  };
}

const isLoading = ref(true);
const servers = ref<Server[]>([]);
const recentActivity = ref<Activity[]>([]);

// Watch for refresh trigger from navbar (team switch)
const dashboardRefreshKey = useState("dashboardRefreshKey", () => 0);
watch(dashboardRefreshKey, () => {
  fetchDashboard();
});

const fetchDashboard = async () => {
  try {
    const response = await $api<DashboardResponse>("/dashboard");
    servers.value = response.data.servers;
    recentActivity.value = response.data.recent_activity;
  } catch {
    // Silent fail
  } finally {
    isLoading.value = false;
  }
};

const route = useRoute();
const router = useRouter();

onMounted(() => {
  fetchDashboard();
  // Landing here from a git-provider install callback (?settings=connections)
  // opens the matching settings tab so the user sees the new connection,
  // then drops the param so a refresh doesn't reopen the sheet.
  const tab = route.query.settings;
  if (typeof tab === "string" && tab) {
    openSettingsSheet(tab);
    void router.replace({ query: { ...route.query, settings: undefined } });
  }
});

// Computed values
const displayedServers = computed(() => servers.value.slice(0, 8));
const displayedActivity = computed(() => recentActivity.value.slice(0, 6));

const getProviderIcon = (provider: string): string => {
  const name = provider?.toLowerCase() || "";
  if (name.includes("digitalocean")) return "simple-icons:digitalocean";
  if (name.includes("hetzner")) return "simple-icons:hetzner";
  if (name.includes("linode")) return "simple-icons:linode";
  if (name.includes("vultr")) return "simple-icons:vultr";
  return "lucide:server";
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "finished":
      return "bg-green-500";
    case "deploying":
      return "bg-blue-500 animate-pulse";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-yellow-500";
  }
};

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: locale.value === "ja" ? ja : enUS,
    });
  } catch {
    return "";
  }
};

const getUserInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
</script>

<template>
  <div class="pb-10">
    <!-- Subscription Required State -->
    <div v-if="!isSubscribed">
      <div class="mb-6">
        <h1 class="text-xl font-semibold">{{ greeting }}, {{ firstName }}</h1>
      </div>

      <div class="mx-auto flex w-full max-w-xl flex-col">
        <div class="rounded-lg border bg-card p-8 text-center">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30"
          >
            <Icon
              name="lucide:credit-card"
              class="h-7 w-7 text-amber-600 dark:text-amber-400"
            />
          </div>
          <h2 class="mb-2 text-lg font-semibold">
            {{ t("public.dashboard.subscriptionRequired") }}
          </h2>
          <p class="mb-6 text-sm text-muted-foreground">
            {{ t("public.dashboard.subscriptionDescription") }}
          </p>
          <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              @click="openSettingsSheet('billing')"
            >
              <Icon name="lucide:credit-card" class="h-4 w-4" />
              {{ t("public.dashboard.addPaymentMethod") }}
            </button>
            <a
              href="mailto:support@launchctl.io"
              class="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Icon name="lucide:mail" class="h-4 w-4" />
              {{ t("public.dashboard.contactSupport") }}
            </a>
          </div>
        </div>

        <div class="mt-6 rounded-lg border bg-muted/30 p-4">
          <h3 class="mb-3 text-sm font-medium">
            {{ t("public.dashboard.subscriptionIncludes") }}
          </h3>
          <ul class="space-y-2 text-sm text-muted-foreground">
            <li class="flex items-center gap-2">
              <Icon name="lucide:check" class="h-4 w-4 text-emerald-500" />
              {{ t("public.dashboard.benefits.servers") }}
            </li>
            <li class="flex items-center gap-2">
              <Icon name="lucide:check" class="h-4 w-4 text-emerald-500" />
              {{ t("public.dashboard.benefits.deployments") }}
            </li>
            <li class="flex items-center gap-2">
              <Icon name="lucide:check" class="h-4 w-4 text-emerald-500" />
              {{ t("public.dashboard.benefits.platform") }}
            </li>
            <li class="flex items-center gap-2">
              <Icon name="lucide:check" class="h-4 w-4 text-emerald-500" />
              {{ t("public.dashboard.benefits.teams") }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Normal Dashboard Content -->
    <div v-else>
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <Icon
          name="lucide:loader-2"
          class="h-8 w-8 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <!-- Greeting -->
        <div class="mb-6">
          <h1 class="text-xl font-semibold">{{ greeting }}, {{ firstName }}</h1>
        </div>

        <!-- SSL certificate expiry banner — renders nothing when no
             certs are expiring. Self-fetches via the composable. -->
        <DashboardCertificateExpiryBanner class="mb-6" />

        <!-- Empty State -->
        <div
          v-if="servers.length === 0"
          class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16"
        >
          <Icon name="lucide:server" class="h-12 w-12 text-muted-foreground" />
          <div class="text-center">
            <p class="font-medium">{{ t("public.dashboard.noServers") }}</p>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t("public.dashboard.noServersDescription") }}
            </p>
          </div>
          <ServerCreateServerDialog />
        </div>

        <template v-else>
          <!-- Servers Section -->
          <div class="mb-8">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-sm font-medium text-muted-foreground">
                {{ t("public.dashboard.servers") }}
              </h2>
              <NuxtLink
                v-if="servers.length > 8"
                to="/servers"
                class="text-sm text-muted-foreground hover:text-foreground"
              >
                {{ t("public.dashboard.viewAll", { count: servers.length }) }}
              </NuxtLink>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NuxtLink
                v-for="server in displayedServers"
                :key="server.id"
                :to="`/servers/${server.id}`"
                class="group"
              >
                <div
                  class="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                >
                  <div class="flex items-center gap-2">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted"
                    >
                      <Icon
                        :name="getProviderIcon(server.provider)"
                        class="h-4 w-4 text-muted-foreground"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm font-medium truncate">{{
                          server.name
                        }}</span>
                        <span
                          class="h-1.5 w-1.5 shrink-0 rounded-full"
                          :class="
                            server.status === 'connected'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                          "
                        />
                      </div>
                      <p class="text-xs text-muted-foreground">
                        <!--
                        Docker servers don't have rows in the Laravel
                        `sites` table — their workloads (applications,
                        compose stacks, managed databases) live in the
                        docker module. Switch the label so the card
                        shows something meaningful instead of always
                        "0 sites".
                      -->
                        <template v-if="server.type === 'docker'">
                          {{ server.workloads_count }}
                          {{
                            t(
                              server.workloads_count === 1
                                ? "public.dashboard.workload"
                                : "public.dashboard.workloads",
                            )
                          }}
                        </template>
                        <template v-else>
                          {{ server.sites_count }}
                          {{
                            t(
                              server.sites_count === 1
                                ? "public.dashboard.site"
                                : "public.dashboard.sites",
                            )
                          }}
                        </template>
                      </p>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>

          <!-- Recent Activity -->
          <div>
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-sm font-medium text-muted-foreground">
                {{ t("public.dashboard.recentActivity") }}
              </h2>
            </div>

            <div
              v-if="recentActivity.length === 0"
              class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12"
            >
              <Icon
                name="lucide:activity"
                class="h-8 w-8 text-muted-foreground"
              />
              <p class="text-sm text-muted-foreground">
                {{ t("public.dashboard.noRecentActivity") }}
              </p>
            </div>

            <div v-else class="rounded-lg border bg-card">
              <NuxtLink
                v-for="(activity, index) in displayedActivity"
                :key="activity.id"
                :to="`/servers/${activity.server_id}/sites/${activity.site_id}`"
                class="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                :class="{ 'border-b': index < displayedActivity.length - 1 }"
              >
                <!-- Status dot -->
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="getStatusColor(activity.status)"
                />

                <!-- Site & Server + Commit Message -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium">{{ activity.site_name }}</span>
                    <span class="text-muted-foreground">/</span>
                    <span class="text-sm text-muted-foreground">{{
                      activity.server_name
                    }}</span>
                  </div>
                  <p
                    v-if="activity.commit_message"
                    class="truncate text-xs text-muted-foreground"
                  >
                    {{ activity.commit_message }}
                  </p>
                </div>

                <!-- Commit SHA -->
                <code
                  class="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:block"
                >
                  {{ activity.commit_sha }}
                </code>

                <!-- User -->
                <div
                  v-if="activity.user"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
                  :title="activity.user.name"
                >
                  {{ getUserInitials(activity.user.name) }}
                </div>

                <!-- Time -->
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ formatDate(activity.created_at) }}
                </span>
              </NuxtLink>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

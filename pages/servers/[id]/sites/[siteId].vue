<script setup lang="ts">
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Deployment, Server, Site } from "~/types";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const route = useRoute();
const { t } = useI18n();
const serverId = computed(() => route.params.id as string);
const siteId = computed(() => route.params.siteId as string);

const server = ref<Server | null>(null);
const site = ref<Site | null>(null);
const isLoading = ref(true);

// Shared terminal state with navbar
const isTerminalOpen = useState("serverTerminalOpen", () => false);

// Shared bus written by the navbar's Deploy button. When the user triggers
// a deploy from the navbar the API response comes back with the new
// Deployment, which the navbar pushes here so this page can apply it
// optimistically without waiting for the WebSocket round-trip.
const lastTriggeredDeployment = useState<Deployment | null>(
  "lastTriggeredDeployment",
  () => null,
);

// Get current team for WebSocket channel
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

// Terminal events trigger a single full refetch (commit data, finished_at,
// task output references all need the canonical server response).
// Non-terminal events (started/progress/rollback.started) are applied
// in-place from the event payload — no network round-trip per event.
const TERMINAL_DEPLOYMENT_EVENTS = new Set([
  "deployment.finished",
  "deployment.failed",
  "deployment.timeout",
  "deployment.rollback.completed",
  "deployment.rollback.failed",
]);

// Debounced refetch for terminal events. Coalesces bursts where the same
// deployment publishes both a terminal event and a `deployment.progress`
// for the same status within ~300ms.
let siteFetchTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleRefetch = () => {
  if (siteFetchTimeout) clearTimeout(siteFetchTimeout);
  siteFetchTimeout = setTimeout(() => fetchSite(), 300);
};

// Apply an optimistic latest_deployment derived from the WebSocket event
// payload. Used when an event arrives before we have the full deployment
// object (e.g. someone triggered a deploy from another tab).
const applyOptimisticDeployment = (deploymentId: string, status: string) => {
  if (!site.value) return;
  const existing = site.value.latest_deployment;
  if (existing && existing.id === deploymentId) {
    // Same deployment — just patch the status.
    existing.status = status;
    return;
  }
  // Different (or no) deployment in state — synthesize a minimal record.
  // Commit data and task_id arrive on the terminal refetch.
  site.value = {
    ...site.value,
    latest_deployment: {
      id: deploymentId,
      site_id: siteId.value,
      status,
      // The fields below aren't in the event payload yet; use sensible
      // defaults so the existing card template doesn't crash. They get
      // replaced by the canonical values on the terminal refetch.
      user_id: null,
      task_id: "",
      git_hash: "",
      vcs_data: existing?.vcs_data ?? ({} as Deployment["vcs_data"]),
      commit_data: existing?.commit_data ?? ({} as Deployment["commit_data"]),
      user_notified_at: "",
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: existing?.user ?? null,
    },
  };
};

useDeploymentEvents(teamId, (data, event) => {
  if (data.site_id !== siteId.value) return;

  const isTerminal = TERMINAL_DEPLOYMENT_EVENTS.has(event);

  // Always reflect the latest known status immediately so the small
  // overview card never lags. Refetch only on terminal transitions where
  // new server-side fields (finished_at, commit data) actually arrive.
  if (
    typeof data.deployment_id === "string" &&
    typeof data.status === "string"
  ) {
    applyOptimisticDeployment(data.deployment_id, data.status);
  }
  if (isTerminal) {
    scheduleRefetch();
  }
});

// Watch the navbar bus: when a deploy is triggered from the top-right
// button, the API response is forwarded here, beating the WebSocket
// roundtrip. Clears itself after applying so subsequent reads don't
// re-apply a stale deployment.
watch(lastTriggeredDeployment, (deployment) => {
  if (!deployment || !site.value) return;
  if (deployment.site_id !== siteId.value) return;
  site.value = { ...site.value, latest_deployment: deployment };
  lastTriggeredDeployment.value = null;
});

// Valid tab values
const validTabs = [
  "general",
  "deployments",
  "files",
  "queues",
  "redirects",
  "commands",
  "settings",
];

// Get initial tab from query params or default to "general"
const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string;
  return validTabs.includes(tabFromQuery) ? tabFromQuery : "general";
};

const activeTab = ref(getInitialTab());

// Watch for tab changes from URL (navbar navigation)
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && validTabs.includes(newTab as string)) {
      activeTab.value = newTab as string;
    }
  },
);

const fetchSite = async () => {
  try {
    const siteData = await $api<{ data: Site }>(
      `/servers/${serverId.value}/sites/${siteId.value}`,
    );
    site.value = siteData.data;
  } catch {
    // Silent fail on refresh
  }
};

const handleAutoRestartUpdated = (enabled: boolean) => {
  if (!site.value) return;

  site.value = {
    ...site.value,
    auto_restart_queue: enabled,
  };
};

onMounted(async () => {
  try {
    const [serverData, siteData] = await Promise.all([
      $api<{ data: Server }>(`/servers/${serverId.value}`),
      $api<{ data: Site }>(`/servers/${serverId.value}/sites/${siteId.value}`),
    ]);
    server.value = serverData.data;
    site.value = siteData.data;
    useHead({ title: site.value?.address || t("site.common.site") });
  } catch {
    navigateTo(`/servers/${serverId.value}`);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon
      name="lucide:loader-2"
      class="h-8 w-8 animate-spin text-muted-foreground"
    />
  </div>

  <div v-else-if="site && server" class="pb-10">
    <!-- Tab Content -->
    <div v-if="activeTab === 'general'" class="space-y-4">
      <SiteDeployBlock
        v-if="!['wordpress', 'phpmyadmin'].includes(site.type)"
        :server="server"
        :site="site"
      />
      <SiteLoadBalancedBanner :site="site" />
      <SiteOverview :server="server" :site="site" />
      <SiteLaravelFeatures
        v-if="site.type === 'laravel'"
        :server-id="server.id"
        :site="site"
        @updated="fetchSite"
      />
    </div>

    <div v-else-if="activeTab === 'deployments'">
      <SiteDeployments
        :server-id="server.id"
        :site-id="site.id"
        :site="site"
        @update:site="site = $event"
      />
    </div>

    <div v-else-if="activeTab === 'files'">
      <SiteFiles :server-id="server.id" :site-id="site.id" />
    </div>

    <div v-else-if="activeTab === 'queues'">
      <SiteQueues
        :server-id="server.id"
        :site-id="site.id"
        :site="site"
        :auto-restart-queue="site.auto_restart_queue"
        @updated="handleAutoRestartUpdated"
      />
    </div>

    <div v-else-if="activeTab === 'redirects'">
      <SiteRedirects
        :server-id="server.id"
        :site-id="site.id"
        :site-address="site.address"
      />
    </div>

    <div v-else-if="activeTab === 'commands'">
      <SiteCommands :server-id="server.id" :site-id="site.id" />
    </div>

    <div v-else-if="activeTab === 'settings'">
      <SiteSettings :server-id="server.id" :site="site" @updated="fetchSite" />
    </div>

    <!-- Terminal Panel -->
    <SiteTerminalPanel
      :server="server"
      :site="site"
      :is-open="isTerminalOpen"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

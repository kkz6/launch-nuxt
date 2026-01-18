<script setup lang="ts">
import { useSiteEvents, useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Server, Site } from "~/types";
import { serverService } from "~/services/serverService";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);

const server = ref<Server | null>(null);
const sites = ref<Site[]>([]);
const isLoading = ref(true);

// Shared terminal state with navbar
const isTerminalOpen = useState('serverTerminalOpen', () => false);

// Get current team for WebSocket channel
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || '');

// Subscribe to real-time site events
useSiteEvents(teamId, (data) => {
  // Only refresh if the event is for this server
  // server_id can be at data.server_id or data.site.server_id depending on event type
  const eventServerId = data.server_id || data.site?.server_id;
  if (eventServerId === serverId.value) {
    fetchSites();
  }
});

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  // Check if this deployment is for a site on this server
  // Also check data.site.server_id in case it's included
  const siteExists = sites.value.some(site => site.id === data.site_id);
  const eventServerId = data.site?.server_id;
  if (siteExists || eventServerId === serverId.value) {
    fetchSites();
  }
});

// Valid tab values
const validTabs = ["sites", "metrics", "databases", "networks", "daemons", "schedulers", "advanced"];
const validSubTabs = ["general", "backups", "ssh-keys", "packages", "php", "services"];

// Get initial tab from query params or default to "sites"
const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string;
  return validTabs.includes(tabFromQuery) ? tabFromQuery : "sites";
};

const activeTab = ref(getInitialTab());

// Get active subtab for advanced settings
const activeSubTab = computed(() => {
  const subtabFromQuery = route.query.subtab as string;
  return validSubTabs.includes(subtabFromQuery) ? subtabFromQuery : "general";
});

// Sync tab changes to URL query params
watch(activeTab, (newTab) => {
  router.replace({
    query: { ...route.query, tab: newTab },
  });
});

// Watch for tab changes from URL (navbar navigation)
watch(() => route.query.tab, (newTab) => {
  if (newTab && validTabs.includes(newTab as string)) {
    activeTab.value = newTab as string;
  }
});

const fetchSites = async () => {
  try {
    const sitesData = await serverService.sites.list(serverId.value);
    sites.value = sitesData.data;
  } catch {
    // Silent fail on refresh
  }
};

onMounted(async () => {
  try {
    const [serverData, sitesData] = await Promise.all([
      serverService.get(serverId.value),
      serverService.sites.list(serverId.value),
    ]);
    server.value = serverData.data;
    sites.value = sitesData.data;
    useHead({ title: server.value?.name || "Server" });
  } catch {
    navigateTo("/servers");
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

  <div v-else-if="server" class="pb-10">
    <!-- Tab Content -->
    <div v-if="activeTab === 'sites'">
      <ServerShowSites :sites="sites" :server="server" @deleted="fetchSites" />
    </div>

    <div v-else-if="activeTab === 'metrics'">
      <ServerShowMetrics :server="server" />
    </div>

    <div v-else-if="activeTab === 'databases'">
      <ServerShowDatabases :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'networks'">
      <ServerShowNetworks :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'daemons'">
      <ServerShowDaemons :server="server" />
    </div>

    <div v-else-if="activeTab === 'schedulers'">
      <ServerShowSchedulers :server="server" />
    </div>

    <div v-else-if="activeTab === 'advanced'">
      <ServerAdvancedSettings :server="server" :active-sub-tab="activeSubTab" />
    </div>

    <!-- Server Terminal -->
    <ServerTerminalBottom
      v-if="server.connected"
      :server="server"
      :is-open="isTerminalOpen"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

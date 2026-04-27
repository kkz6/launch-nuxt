<script setup lang="ts">
import { useSiteEvents, useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Server, Site } from "~/types";
import { serverService } from "~/services/serverService";

definePageMeta({
  layout: "default",
  middleware: ["auth", "server-provisioned"],
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);

const server = ref<Server | null>(null);
const sites = ref<Site[]>([]);
const isLoading = ref(true);
const isSitesLoading = ref(true);

const isLoadBalancer = computed(() => server.value?.type === 'loadbalancer');

// Shared terminal state with navbar
const isTerminalOpen = useState('serverTerminalOpen', () => false);

// Get current team for WebSocket channel
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || '');

// Debounced silent refetch for WebSocket events
let sitesFetchTimeout: ReturnType<typeof setTimeout> | null = null;

const debouncedFetchSites = () => {
  if (sitesFetchTimeout) clearTimeout(sitesFetchTimeout);
  sitesFetchTimeout = setTimeout(() => fetchSites(), 300);
};

// Subscribe to real-time site events
useSiteEvents(teamId, (data) => {
  if (isLoadBalancer.value) return;
  const eventServerId = data.server_id || data.site?.server_id;
  if (eventServerId === serverId.value) {
    debouncedFetchSites();
  }
});

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  if (isLoadBalancer.value) return;
  const siteExists = sites.value.some(site => site.id === data.site_id);
  const eventServerId = data.site?.server_id;
  if (siteExists || eventServerId === serverId.value) {
    debouncedFetchSites();
  }
});

// Watch for refresh trigger from navbar (e.g., after site creation)
const sitesRefreshKey = useState('sitesRefreshKey', () => 0);
watch(sitesRefreshKey, () => {
  if (!isLoadBalancer.value) {
    fetchSites();
  }
});

// Valid tab values
const validTabs = ["sites", "apps", "upstreams", "metrics", "databases", "docker-services", "networks", "daemons", "schedulers", "advanced"];
const validSubTabs = ["general", "backups", "ssh-keys", "packages", "services"];

// Get initial tab from query params or default based on server type
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

// Use cached server data from index page if available
const { consumeCachedServer } = useNavbarCache();

onMounted(async () => {
  try {
    // Use cached data for instant render, fetch fresh data in background
    const cached = consumeCachedServer(serverId.value);
    if (cached) {
      server.value = cached;
      useHead({ title: server.value.name || "Server" });

      if (server.value.type === 'loadbalancer' && !route.query.tab) {
        activeTab.value = 'upstreams';
      } else if (server.value.type === 'docker' && !route.query.tab) {
        activeTab.value = 'apps';
      }

      isLoading.value = false;

      // Fetch fresh data and sites in parallel in background
      const promises: Promise<void>[] = [
        serverService.get(serverId.value).then(res => { server.value = res.data; }),
      ];
      if (server.value.type !== 'loadbalancer' && server.value.type !== 'docker') {
        promises.push(serverService.sites.list(serverId.value).then(res => { sites.value = res.data; isSitesLoading.value = false; }));
      } else {
        isSitesLoading.value = false;
      }
      await Promise.all(promises);
    } else {
      // Direct navigation - no cache, fetch everything
      const serverData = await serverService.get(serverId.value);
      server.value = serverData.data;
      useHead({ title: server.value?.name || "Server" });

      if (server.value?.type === 'loadbalancer' && !route.query.tab) {
        activeTab.value = 'upstreams';
      } else if (server.value?.type === 'docker' && !route.query.tab) {
        activeTab.value = 'apps';
      }

      isLoading.value = false;

      // Fetch sites after showing the page
      if (server.value?.type !== 'loadbalancer' && server.value?.type !== 'docker') {
        const sitesData = await serverService.sites.list(serverId.value);
        sites.value = sitesData.data;
      }
      isSitesLoading.value = false;
    }
  } catch {
    navigateTo("/servers");
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
      <ServerShowSites :sites="sites" :server="server" :is-loading="isSitesLoading" @deleted="fetchSites" />
    </div>

    <div v-else-if="activeTab === 'upstreams'">
      <ServerShowUpstreams :server="server" />
    </div>

    <div v-else-if="activeTab === 'metrics'">
      <ServerShowMetrics :server="server" />
    </div>

    <div v-else-if="activeTab === 'databases'">
      <ServerShowDatabases :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'docker-services'">
      <ServerShowDockerServices :server="server" />
    </div>

    <div v-else-if="activeTab === 'apps'">
      <ServerShowDockerApps :server="server" />
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

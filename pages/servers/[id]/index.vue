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

// Sites only exist for PHP-style servers. Load-balancers route via
// upstreams; docker servers expose Projects/Applications instead. The
// site-event refetch logic below short-circuits when sites aren't relevant.
const hasSitesTab = computed(
  () => server.value?.type !== 'loadbalancer' && server.value?.type !== 'docker',
);

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
  if (!hasSitesTab.value) return;
  const eventServerId = data.server_id || data.site?.server_id;
  if (eventServerId === serverId.value) {
    debouncedFetchSites();
  }
});

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  if (!hasSitesTab.value) return;
  const siteExists = sites.value.some(site => site.id === data.site_id);
  const eventServerId = data.site?.server_id;
  if (siteExists || eventServerId === serverId.value) {
    debouncedFetchSites();
  }
});

// Watch for refresh trigger from navbar (e.g., after site creation)
const sitesRefreshKey = useState('sitesRefreshKey', () => 0);
watch(sitesRefreshKey, () => {
  if (hasSitesTab.value) {
    fetchSites();
  }
});

// Tab validation is driven by the per-server-type rules. The set of valid
// tabs differs between PHP / load-balancer / docker — single source of
// truth is useServerTypeRules so this page never drifts from the Navbar.
const validSubTabs = ["general", "backups", "ssh-keys", "packages", "services"];

const allValidTabs = computed(() =>
  getServerTypeRules(server.value?.type).tabs.map((t) => t.value),
);

const defaultTab = computed(
  () => getServerTypeRules(server.value?.type).tabs[0]?.value ?? "sites",
);

const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string;
  // Until the server type has loaded we accept any non-empty query value
  // (will be re-validated below once the server data arrives). Falling back
  // to a hardcoded "sites" used to break first-paint on docker servers.
  if (!tabFromQuery) return defaultTab.value;
  return tabFromQuery;
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

// Watch for tab changes from URL (navbar navigation).
watch(() => route.query.tab, (newTab) => {
  if (newTab && allValidTabs.value.includes(newTab as string)) {
    activeTab.value = newTab as string;
  }
});

// Once we know the server type, snap to that type's default tab if the
// current activeTab isn't valid for it (e.g. user landed on /?tab=sites
// for a docker server, where "sites" isn't a valid tab).
watch(
  () => server.value?.type,
  () => {
    if (!allValidTabs.value.includes(activeTab.value)) {
      activeTab.value = defaultTab.value;
    }
  },
);

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

      if (!route.query.tab) {
        activeTab.value = defaultTab.value;
      }

      isLoading.value = false;

      // Fetch fresh data and sites in parallel in background. Only PHP-type
      // servers have sites — load-balancers route via upstreams, docker
      // servers don't have "sites" at all (they have projects).
      const hasSites = server.value.type !== 'loadbalancer' && server.value.type !== 'docker';
      const promises: Promise<void>[] = [
        serverService.get(serverId.value).then(res => { server.value = res.data; }),
      ];
      if (hasSites) {
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

      if (!route.query.tab) {
        activeTab.value = defaultTab.value;
      }

      isLoading.value = false;

      // See comment above on which server types have "sites".
      const hasSites = server.value?.type !== 'loadbalancer' && server.value?.type !== 'docker';
      if (hasSites) {
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

    <div v-else-if="activeTab === 'networks'">
      <!-- Docker servers get the host-level docker-network view; everything
           else uses the existing PHP/loadbalancer firewall rules view. -->
      <ServerDockerNetworks
        v-if="server.type === 'docker'"
        :server-id="server.id"
      />
      <ServerShowNetworks v-else :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'daemons'">
      <ServerShowDaemons :server="server" />
    </div>

    <div v-else-if="activeTab === 'schedulers'">
      <ServerShowSchedulers :server="server" />
    </div>

    <!--
      Docker-server tabs. Containers/Volumes/Traefik render placeholder
      empty states for now — see phase 1 in
      docs/plans/2026-05-22-docker-server-menus-design.md. The Projects tab
      is fully wired (create/list/delete).
    -->
    <div v-else-if="activeTab === 'projects'">
      <ServerDockerProjects :server="server" />
    </div>

    <div v-else-if="activeTab === 'containers'">
      <ServerDockerContainers :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'volumes'">
      <ServerDockerVolumes :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'traefik'">
      <ServerDockerTraefik :server-id="server.id" />
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

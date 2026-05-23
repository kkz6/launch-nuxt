<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  ChevronDown,
  LogOut,
  Settings,
  Plus,
  Check,
  Sun,
  Moon,
  Monitor,
  Server,
  Globe,
  Terminal,
} from "lucide-vue-next";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Deployment } from "~/types";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface Team {
  id: string;
  name: string;
  personal_team: boolean;
  image_url?: string;
  is_subscribed?: boolean;
}

const { user, logout, fetchUser } = useAuth();
const { setCurrentTeamId } = useApi();
const { reconnect: reconnectWebSocket } = useWebSocket();
const { open: openSettingsSheet } = useSettingsSheet();
const colorMode = useColorMode();
const route = useRoute();

// Check if current team is subscribed
const isSubscribed = computed(() => user.value?.current_team?.is_subscribed ?? true);

// Global navigation tabs
const globalTabsBase = [
  { value: "dashboard", label: "Dashboard", route: "/dashboard", icon: "lucide:layout-dashboard" },
  { value: "servers", label: "Servers", route: "/servers", icon: "lucide:server" },
  { value: "domains", label: "Domains", route: "/dns", icon: "lucide:globe" },
  { value: "scripts", label: "Scripts", route: "/scripts", icon: "lucide:scroll-text" },
];

// Track if component is mounted (client-side)
const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

const globalTabs = computed(() => {
  // On server-side, always return base tabs to avoid hydration mismatch
  if (!isMounted.value) {
    return globalTabsBase;
  }

  // If not subscribed, only show dashboard
  if (!isSubscribed.value) {
    return [{ value: "dashboard", label: "Dashboard", route: "/dashboard", icon: "lucide:layout-dashboard" }];
  }

  if (!user.value?.onboarded) {
    return [
      { value: "onboarding", label: "Onboarding", route: "/onboarding", icon: "lucide:rocket" },
      ...globalTabsBase,
    ];
  }
  return globalTabsBase;
});

// Tab indicator animation
const globalNavRef = ref<HTMLElement | null>(null);
const tabRefs = ref<Map<string, HTMLElement>>(new Map());
const indicatorLeft = ref(0);
const indicatorWidth = ref(0);

const setTabRef = (key: string, el: unknown) => {
  if (el) {
    tabRefs.value.set(key, (el as { $el: HTMLElement }).$el || el as HTMLElement);
  }
};

const updateIndicator = () => {
  if (!showGlobalTabs.value) {
    indicatorWidth.value = 0;
    return;
  }
  const currentPath = route.path.replace(/\/$/, '');
  const activeTab = globalTabs.value.find((tab) => {
    return currentPath === tab.route || currentPath.startsWith(`${tab.route}/`);
  });

  if (activeTab && tabRefs.value.has(activeTab.value)) {
    const tabEl = tabRefs.value.get(activeTab.value);
    if (tabEl && globalNavRef.value) {
      const navRect = globalNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      indicatorLeft.value = tabRect.left - navRect.left;
      indicatorWidth.value = tabRect.width;
    }
  } else {
    indicatorWidth.value = 0;
  }
};

watch(() => route.path, () => {
  nextTick(updateIndicator);
}, { immediate: true });

onMounted(() => {
  nextTick(updateIndicator);
});

// Server tabs indicator
const serverNavRef = ref<HTMLElement | null>(null);
const serverTabRefs = ref<Map<string, HTMLElement>>(new Map());
const serverIndicatorLeft = ref(0);
const serverIndicatorWidth = ref(0);

const setServerTabRef = (key: string, el: unknown) => {
  if (el) {
    serverTabRefs.value.set(key, (el as { $el: HTMLElement }).$el || el as HTMLElement);
  }
};

const updateServerIndicator = () => {
  if (!showServerTabs.value) {
    serverIndicatorWidth.value = 0;
    return;
  }
  // Default to whichever tab the active server type lists first. Docker
  // servers default to "projects", load-balancers to "upstreams", PHP to
  // "sites" — driven entirely by useServerTypeRules.
  const defaultTab = serverDetailTabs.value[0]?.value ?? 'sites';
  const currentTab = (route.query.tab as string) || defaultTab;
  if (serverTabRefs.value.has(currentTab)) {
    const tabEl = serverTabRefs.value.get(currentTab);
    if (tabEl && serverNavRef.value) {
      const navRect = serverNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      serverIndicatorLeft.value = tabRect.left - navRect.left;
      serverIndicatorWidth.value = tabRect.width;
    }
  } else {
    serverIndicatorWidth.value = 0;
  }
};

// Site tabs indicator
const siteNavRef = ref<HTMLElement | null>(null);
const siteTabRefs = ref<Map<string, HTMLElement>>(new Map());
const siteIndicatorLeft = ref(0);
const siteIndicatorWidth = ref(0);

const setSiteTabRef = (key: string, el: unknown) => {
  if (el) {
    siteTabRefs.value.set(key, (el as { $el: HTMLElement }).$el || el as HTMLElement);
  }
};

const updateSiteIndicator = () => {
  if (!showSiteTabs.value) {
    siteIndicatorWidth.value = 0;
    return;
  }
  const currentTab = (route.query.tab as string) || 'general';
  if (siteTabRefs.value.has(currentTab)) {
    const tabEl = siteTabRefs.value.get(currentTab);
    if (tabEl && siteNavRef.value) {
      const navRect = siteNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      siteIndicatorLeft.value = tabRect.left - navRect.left;
      siteIndicatorWidth.value = tabRect.width;
    }
  } else {
    siteIndicatorWidth.value = 0;
  }
};

// Advanced sub-tabs indicator
const advancedNavRef = ref<HTMLElement | null>(null);
const advancedTabRefs = ref<Map<string, HTMLElement>>(new Map());
const advancedIndicatorLeft = ref(0);
const advancedIndicatorWidth = ref(0);

const setAdvancedTabRef = (key: string, el: unknown) => {
  if (el) {
    advancedTabRefs.value.set(key, (el as { $el: HTMLElement }).$el || el as HTMLElement);
  }
};

const updateAdvancedIndicator = () => {
  if (!isAdvancedTabActive.value) {
    advancedIndicatorWidth.value = 0;
    return;
  }
  const currentSubTab = (route.query.subtab as string) || 'general';
  if (advancedTabRefs.value.has(currentSubTab)) {
    const tabEl = advancedTabRefs.value.get(currentSubTab);
    if (tabEl && advancedNavRef.value) {
      const navRect = advancedNavRef.value.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      advancedIndicatorLeft.value = tabRect.left - navRect.left;
      advancedIndicatorWidth.value = tabRect.width;
    }
  } else {
    advancedIndicatorWidth.value = 0;
  }
};

// Watch for route changes to update all indicators
watch([() => route.path, () => route.query.tab, () => route.query.subtab], () => {
  nextTick(() => {
    updateServerIndicator();
    updateSiteIndicator();
    updateAdvancedIndicator();
  });
}, { immediate: true });


// Server detail tabs — driven by useServerTypeRules so adding a new server
// type doesn't require touching this file. Keeps the loadbalancer/docker
// branches out of the navbar render path. The "isLoadBalancerServer"
// derived ref is kept for the advanced sub-tabs block below, which still
// filters by type until that block is similarly composable-driven.
const isLoadBalancerServer = computed(() => serverType.value === 'loadbalancer');
const isDockerServer = computed(() => serverType.value === 'docker');

const serverDetailTabs = computed(() => getServerTypeRules(serverType.value).tabs);

// Advanced sub-tabs (second level) - filtered by server type.
// - Load balancers: no backups (no app data) and no packages tab (the host
//   stack is minimal Caddy).
// - Docker servers: same exclusions. Backups belong inside individual
//   docker workloads, not the host. Packages aren't user-managed.
const advancedSubTabs = computed(() => {
  const isHostManaged = !isLoadBalancerServer.value && !isDockerServer.value;
  const tabs = [
    { value: "general", label: "General", query: "general", icon: "lucide:info" },
  ];
  if (isHostManaged) {
    tabs.push({ value: "backups", label: "Backups", query: "backups", icon: "lucide:hard-drive" });
  }
  tabs.push({ value: "ssh-keys", label: "SSH Keys", query: "ssh-keys", icon: "lucide:key" });
  if (isHostManaged) {
    tabs.push({ value: "packages", label: "Packages", query: "packages", icon: "lucide:package" });
  }
  tabs.push({ value: "services", label: "Services", query: "services", icon: "lucide:cog" });
  // Docker-only: Traefik config editing sits under Advanced rather than
  // as a top-level tab — admins occasionally inspect it, but it's not a
  // day-to-day workflow.
  if (isDockerServer.value) {
    tabs.push({ value: "traefik", label: "Traefik", query: "traefik", icon: "simple-icons:traefikproxy" });
  }
  return tabs;
});

// Site detail tabs (base - filtered based on site type)
const allSiteDetailTabs = [
  { value: "general", label: "Overview", query: "general", icon: "lucide:layout-dashboard" },
  { value: "deployments", label: "Deployments", query: "deployments", icon: "lucide:git-branch" },
  { value: "files", label: "Files", query: "files", icon: "lucide:folder-open" },
  { value: "queues", label: "Queues", query: "queues", icon: "lucide:list-todo" },
  { value: "redirects", label: "Redirects", query: "redirects", icon: "lucide:corner-up-right" },
  { value: "commands", label: "Commands", query: "commands", icon: "lucide:terminal-square" },
  { value: "settings", label: "Settings", query: "settings", icon: "lucide:settings" },
];

// DNS domain detail tabs
const dnsDetailTabs = [
  { value: "records", label: "Records", path: "" },
  { value: "settings", label: "Settings", path: "/settings" },
];

// Check if we're on a server detail page
const isServerDetailPage = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)$/);
  return match && match[1] !== 'create';
});

// Check if we're on a site detail page
const isSiteDetailPage = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)\/sites\/([^/]+)$/);
  return match !== null;
});

// Check if we're on a DNS domain detail page
const isDnsDetailPage = computed(() => {
  const match = route.path.match(/^\/dns\/([^/]+)(?:\/|$)/);
  return match && match[1] !== 'create';
});

// Check if we're on DNS settings page
const isDnsSettingsPage = computed(() => {
  return route.path.match(/^\/dns\/([^/]+)\/settings$/) !== null;
});

const serverId = computed(() => {
  // Match both /servers/:id and /servers/:id/sites/:siteId
  const serverMatch = route.path.match(/^\/servers\/([^/]+)(?:\/|$)/);
  return serverMatch ? serverMatch[1] : null;
});

const siteId = computed(() => {
  const match = route.path.match(/^\/servers\/([^/]+)\/sites\/([^/]+)$/);
  return match ? match[2] : null;
});

const domainId = computed(() => {
  const match = route.path.match(/^\/dns\/([^/]+)(?:\/|$)/);
  return match ? match[1] : null;
});

// Server data for detail page
const serverName = ref<string | null>(null);
const serverIp = ref<string | null>(null);
const serverConnected = ref(false);
const serverProvider = ref<string | null>(null);
const serverStatus = ref<string | null>(null);
const serverType = ref<string | null>(null);
const serverProvisionCommand = ref<string | null>(null);
const showProvisionDialog = ref(false);

// Site data for detail page
const siteAddress = ref<string | null>(null);
const siteType = ref<string | null>(null);
const siteUrl = ref<string | null>(null);
const isDeploying = ref(false);

// Shared bus consumed by the site detail page so that triggering a deploy
// from the navbar updates the on-page overview card immediately, without
// waiting for the WebSocket roundtrip + debounced refetch.
const lastTriggeredDeployment = useState<Deployment | null>('lastTriggeredDeployment', () => null);

const onDeployTriggered = (deployment: Deployment) => {
  isDeploying.value = true;
  lastTriggeredDeployment.value = deployment;
};

// Get current team for WebSocket channel
const teamId = computed(() => user.value?.current_team_id?.toString() || '');

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  // Update deployment status for current site
  if (data.site_id === siteId.value) {
    if (data.status === 'pending' || data.status === 'installing') {
      isDeploying.value = true;
    } else if (data.status === 'finished' || data.status === 'failed' || data.status === 'timeout') {
      isDeploying.value = false;
    }
  }
});

// Domain data for DNS detail page
const domainAddress = ref<string | null>(null);
const domainProvider = ref<string | null>(null);
const domainProviderLabel = ref<string | null>(null);

const providerLabels: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: "Custom Server",
};

const siteTypeLabels: Record<string, string> = {
  laravel: "Laravel",
  wordpress: "WordPress",
  generic: "Generic PHP",
  phpmyadmin: "phpMyAdmin",
};

// Computed site tabs based on site type
const siteDetailTabs = computed(() => {
  if (!siteType.value) return allSiteDetailTabs;
  if (siteType.value === 'wordpress') {
    return allSiteDetailTabs.filter((t) => !['deployments', 'queues'].includes(t.value));
  }
  if (siteType.value === 'phpmyadmin') {
    return allSiteDetailTabs.filter((t) => !['deployments', 'queues', 'redirects', 'commands'].includes(t.value));
  }
  if (siteType.value === 'generic') {
    return allSiteDetailTabs.filter((t) => !['queues'].includes(t.value));
  }
  return allSiteDetailTabs;
});

const { getCachedServer, getCachedSite } = useNavbarCache();

const applyServerData = (data: { name: string; public_ipv4: string; connected: boolean; provider: string; status: string; type: string; provision_command?: string }) => {
  serverName.value = data.name;
  serverIp.value = data.public_ipv4;
  serverConnected.value = data.connected;
  serverProvider.value = data.provider;
  serverStatus.value = data.status;
  serverType.value = data.type;
  serverProvisionCommand.value = data.provision_command || null;
};

// Fetch server info when on server or site detail page
watch([serverId, siteId], async ([sId, stId]) => {
  if (sId && !stId) {
    // Server detail page - use cache if available, otherwise fetch
    const cached = getCachedServer(sId);
    if (cached) {
      applyServerData(cached);
    } else {
      try {
        const response = await $api<{ data: { name: string; public_ipv4: string; connected: boolean; provider: string; status: string; type: string; provision_command?: string } }>(`/servers/${sId}`);
        applyServerData(response.data);
      } catch {
        serverName.value = null;
      }
    }
    // Clear site data
    siteAddress.value = null;
    siteType.value = null;
  } else if (sId && stId) {
    // Apply site cache immediately for instant tab filtering
    const cachedSite = getCachedSite(stId);
    if (cachedSite) {
      siteAddress.value = cachedSite.address;
      siteType.value = cachedSite.type;
    }

    // Fetch full data from API
    try {
      const [serverRes, siteRes] = await Promise.all([
        $api<{ data: { name: string; public_ipv4: string; connected: boolean; provider: string; status: string; type: string; provision_command?: string } }>(`/servers/${sId}`),
        $api<{ data: { address: string; type: string; url: string } }>(`/servers/${sId}/sites/${stId}`),
      ]);
      applyServerData(serverRes.data);
      siteAddress.value = siteRes.data.address;
      siteType.value = siteRes.data.type;
      siteUrl.value = siteRes.data.url;
    } catch {
      serverName.value = null;
      siteAddress.value = null;
    }
  } else {
    serverName.value = null;
    serverProvider.value = null;
    serverStatus.value = null;
    serverType.value = null;
    serverProvisionCommand.value = null;
    siteAddress.value = null;
    siteType.value = null;
  }
}, { immediate: true });

// Fetch domain info when on DNS detail page
watch(domainId, async (dId) => {
  if (dId && dId !== 'create') {
    try {
      const response = await $api<{
        data: {
          domain: {
            address: string;
            provider?: { provider: string; profile: string };
          };
        };
      }>(`/dns/domains/${dId}`);
      domainAddress.value = response.data.domain.address;
      domainProvider.value = response.data.domain.provider?.provider || null;
      domainProviderLabel.value = response.data.domain.provider?.profile || null;
    } catch {
      domainAddress.value = null;
      domainProvider.value = null;
      domainProviderLabel.value = null;
    }
  } else {
    domainAddress.value = null;
    domainProvider.value = null;
    domainProviderLabel.value = null;
  }
}, { immediate: true });

const isGlobalTabActive = (tabRoute: string) => {
  const currentPath = route.path.replace(/\/$/, ''); // Remove trailing slash
  return currentPath === tabRoute || currentPath.startsWith(`${tabRoute}/`);
};

const isServerTabActive = (query: string) => {
  const currentTab = route.query.tab as string || 'sites';
  return currentTab === query;
};

const isAdvancedTabActive = computed(() => {
  return (route.query.tab as string) === 'advanced';
});

const isAdvancedSubTabActive = (query: string) => {
  const currentSubTab = route.query.subtab as string || 'general';
  return currentSubTab === query;
};

const isSiteTabActive = (query: string) => {
  const currentTab = route.query.tab as string || 'general';
  return currentTab === query;
};

const isDnsTabActive = (tabPath: string) => {
  if (tabPath === '') {
    // Records tab is active when not on settings page
    return !isDnsSettingsPage.value;
  }
  if (tabPath === '/settings') {
    return isDnsSettingsPage.value;
  }
  return false;
};

// Show provision button for custom servers that need provisioning
const showProvisionButton = computed(() => {
  return serverProvider.value === 'custom_server' && serverStatus.value === 'new';
});

const showGlobalTabs = computed(() => {
  const currentPath = route.path.replace(/\/$/, ''); // Remove trailing slash
  // If not subscribed, only show on dashboard
  if (!isSubscribed.value) {
    return currentPath === '/dashboard';
  }
  // Show global tabs only on list pages, not detail pages
  return currentPath === '/dashboard' || currentPath === '/servers' || currentPath === '/dns' || currentPath === '/scripts' || currentPath === '/onboarding';
});

const showDnsTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isDnsDetailPage.value;
});

const isServerDataLoaded = computed(() => serverType.value !== null);

const showServerTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isServerDetailPage.value;
});

const showSiteTabs = computed(() => {
  if (!isSubscribed.value) return false;
  return isSiteDetailPage.value;
});

// Watch for section visibility changes to update indicators when they become visible
watch([showGlobalTabs, showServerTabs, showSiteTabs, isAdvancedTabActive], ([globalVisible, serverVisible, siteVisible, advancedVisible]) => {
  // Clear stale refs when sections become hidden
  if (!serverVisible) serverTabRefs.value.clear();
  if (!siteVisible) siteTabRefs.value.clear();
  if (!advancedVisible) advancedTabRefs.value.clear();

  // Wait for refs to be populated after render
  setTimeout(() => {
    nextTick(() => {
      if (globalVisible) updateIndicator();
      if (serverVisible) updateServerIndicator();
      if (siteVisible) updateSiteIndicator();
      if (advancedVisible) updateAdvancedIndicator();
    });
  }, 50);
}, { immediate: true });

// DNS refresh trigger
const dnsRefreshKey = useState('dnsRefreshKey', () => 0);
const onDnsCreated = () => {
  dnsRefreshKey.value++;
};

// Scripts refresh trigger
const scriptsRefreshKey = useState('scriptsRefreshKey', () => 0);
const onScriptCreated = () => {
  scriptsRefreshKey.value++;
};

// Sites refresh trigger (when a site is created from navbar)
const sitesRefreshKey = useState('sitesRefreshKey', () => 0);
const onSiteCreated = () => {
  sitesRefreshKey.value++;
};

// Docker projects refresh trigger — bumped by the navbar's New
// Project button so ServerDockerProjects can prepend the new row
// without a full refetch. Same pattern as sitesRefreshKey.
const dockerProjectsRefreshKey = useState('dockerProjectsRefreshKey', () => 0);
const onDockerProjectCreated = () => {
  dockerProjectsRefreshKey.value++;
};

// Terminal state (shared with server detail page)
const isTerminalOpen = useState('serverTerminalOpen', () => false);
const openTerminal = () => {
  isTerminalOpen.value = true;
};

const setColorMode = (mode: "light" | "dark" | "system") => {
  colorMode.preference = mode;
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else if (mode === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

const isOpen = ref(false);
const isCreateTeamOpen = ref(false);
const teams = ref<Team[]>([]);
const isTeamsLoading = ref(true);
const confirmationDialog = ref<InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null>(null);

const currentTeam = computed(() =>
  teams.value.find((t) => t.id === String(user.value?.current_team_id))
);

const fetchTeams = async () => {
  try {
    const response = await $api<{ data: Team[] }>("/teams");
    teams.value = response.data;
  } catch {
    // Silent fail
  } finally {
    isTeamsLoading.value = false;
  }
};

// Refresh triggers for team switch
const serversRefreshKey = useState('serversRefreshKey', () => 0);
const dashboardRefreshKey = useState('dashboardRefreshKey', () => 0);

const switchTeam = async (teamId: string) => {
  if (teamId === String(user.value?.current_team_id)) return;

  // Find the team name for the toast
  const targetTeam = teams.value.find((t) => t.id === teamId);

  try {
    await $api(`/teams/${teamId}/switch`, { method: "POST" });
    // Update stored team ID
    setCurrentTeamId(teamId);
    // Refresh user data to get updated current_team_id
    await fetchUser();
    // Reconnect WebSocket with new team context
    reconnectWebSocket();
    // Navigate to dashboard and trigger refresh
    navigateTo("/dashboard");
    // Trigger refresh for various pages
    serversRefreshKey.value++;
    dashboardRefreshKey.value++;
    scriptsRefreshKey.value++;
    dnsRefreshKey.value++;
    // Show success toast
    toast.success(`Switched to ${targetTeam?.name || 'team'}`);
  } catch {
    toast.error("Failed to switch team");
  }
};

const deleteTeam = async (team: Team) => {
  if (!confirmationDialog.value) return;
  if (team.personal_team) {
    toast.error("Cannot delete personal team");
    return;
  }

  const result = await confirmationDialog.value.show({
    title: "Delete Team",
    description: `Are you sure you want to delete "${team.name}"? This action cannot be undone and will remove all team data.`,
    confirmText: "Delete Team",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/teams/${team.id}`, { method: "DELETE" });
      teams.value = teams.value.filter((t) => t.id !== team.id);
      toast.success("Team deleted");
      if (team.id === String(user.value?.current_team_id)) {
        window.location.reload();
      }
    } catch {
      toast.error("Failed to delete team");
    }
  }
};

const canDeleteTeam = (team: Team) => {
  return !team.personal_team;
};

const getTeamInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const openSettings = () => {
  isOpen.value = false;
  openSettingsSheet();
};

const userInitials = computed(() => {
  if (!user.value?.name) return "U";
  return user.value.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

const handleLogout = async () => {
  isOpen.value = false;
  await logout();
};

const navigateTo = (path: string) => {
  isOpen.value = false;
  useRouter().push(path);
};

const onTeamCreated = () => {
  fetchTeams();
};

onMounted(fetchTeams);
</script>

<template>
  <nav
    class="z-40 w-full shrink-0 border-b border-divider bg-background/70 backdrop-blur-lg"
  >
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div
      class="flex h-16 items-center justify-between px-4 lg:px-8"
    >
      <NuxtLink to="/dashboard" class="flex items-center gap-2">
        <span class="text-xl font-bold">launchctl</span>
      </NuxtLink>

      <!-- Subscription Banner -->
      <div
        v-if="!isSubscribed"
        class="group relative h-5 cursor-pointer overflow-hidden text-sm"
        @click="openSettingsSheet('billing')"
      >
        <span class="block text-muted-foreground transition-transform duration-300 ease-out group-hover:-translate-y-full">
          Your subscription is inactive
        </span>
        <span class="absolute inset-x-0 top-full flex items-center gap-1 font-medium text-primary transition-transform duration-300 ease-out group-hover:-translate-y-full">
          Subscribe now
          <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
        </span>
      </div>

      <div class="flex items-center space-x-2">
        <!-- User Menu (with Teams) -->
        <ClientOnly>
          <DropdownMenu v-model:open="isOpen">
            <DropdownMenuTrigger as-child>
              <div
                class="group flex h-9 cursor-pointer items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 transition-colors duration-150 hover:bg-muted/50"
              >
                <Avatar class="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-xs font-medium sm:text-sm">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>

                <ChevronDown class="ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-y-0.5" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-52 p-1">
              <!-- User Info -->
              <div class="px-2 py-1.5">
                <p class="text-sm font-medium">{{ user?.name }}</p>
                <p class="text-xs text-muted-foreground">{{ user?.email }}</p>
              </div>
              <DropdownMenuSeparator class="my-1" />

              <!-- Teams Section -->
              <div v-if="isTeamsLoading" class="flex items-center justify-center py-2">
                <Icon name="lucide:loader-2" class="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
              <template v-else>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    v-for="team in teams"
                    :key="team.id"
                    class="cursor-pointer justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                    @click="switchTeam(team.id)"
                  >
                    <span class="truncate">{{ team.name }}</span>
                    <Check v-if="team.id === String(user?.current_team_id)" class="h-3.5 w-3.5 text-primary" />
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                    @click="isCreateTeamOpen = true"
                  >
                    <Plus class="h-3.5 w-3.5" />
                    <span>New team</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </template>
              <DropdownMenuSeparator class="my-1" />

              <!-- Menu Items -->
              <DropdownMenuItem
                class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm"
                @click="openSettings"
              >
                <Settings class="h-3.5 w-3.5 text-muted-foreground" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator class="my-1" />

              <!-- Theme Switcher -->
              <div class="flex items-center justify-between px-2 py-1.5">
                <span class="text-sm text-muted-foreground">Theme</span>
                <div class="flex items-center gap-0.5 rounded-md border bg-muted/50 p-0.5">
                  <button
                    type="button"
                    class="rounded p-1 transition-colors"
                    :class="colorMode.preference === 'light' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    @click.stop="setColorMode('light')"
                  >
                    <Sun class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 transition-colors"
                    :class="colorMode.preference === 'dark' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    @click.stop="setColorMode('dark')"
                  >
                    <Moon class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    class="rounded p-1 transition-colors"
                    :class="colorMode.preference === 'system' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    @click.stop="setColorMode('system')"
                  >
                    <Monitor class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <DropdownMenuSeparator class="my-1" />

              <DropdownMenuItem
                class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm text-destructive focus:text-destructive"
                @click="handleLogout"
              >
                <LogOut class="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div
              class="flex h-9 animate-pulse items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2"
            >
              <div class="h-8 w-8 rounded-full bg-muted" />
              <div class="h-3.5 w-3.5 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- Global Navigation Tabs (Servers / Domains) -->
    <!-- On mobile the tabs can overflow the viewport; we let them scroll
         horizontally and keep the page-level "Create" action pinned to the
         right so it's always reachable. The scrollbar is hidden visually
         but the area still scrolls via touch / wheel. -->
    <div v-if="showGlobalTabs" class="px-4 lg:px-8">
      <div class="-mb-px flex items-center gap-3">
        <nav
          ref="globalNavRef"
          class="relative flex flex-1 gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <NuxtLink
            v-for="tab in globalTabs"
            :key="tab.value"
            :ref="(el) => setTabRef(tab.value, el)"
            :to="tab.route"
            class="relative flex shrink-0 items-center gap-2 whitespace-nowrap px-1 py-3 text-sm font-medium transition-colors"
            :class="[
              isGlobalTabActive(tab.route)
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Icon :name="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </NuxtLink>
          <!-- Sliding indicator -->
          <span
            class="absolute bottom-0 h-0.5 bg-foreground transition-all duration-300 ease-out"
            :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
          />
        </nav>
        <div class="flex shrink-0 items-center">
          <ServerCreateServerDialog v-if="route.path === '/servers'" />
          <DnsAddDomain v-if="route.path === '/dns'" :providers="[]" @created="onDnsCreated" />
          <ScriptsCreateScript v-if="route.path === '/scripts'" @created="onScriptCreated" />
        </div>
      </div>
    </div>

    <!-- Server Detail Navigation -->
    <div v-if="showServerTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <!-- Breadcrumb + Server info -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/servers"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Server class="h-4 w-4" />
            Servers
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <template v-if="isServerDataLoaded">
            <div class="flex items-center gap-2">
              <span class="relative flex items-center gap-1.5 text-sm font-medium">
                <span
                  class="h-2 w-2 rounded-full"
                  :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
                />
                {{ serverName }}
              </span>
              <span v-if="isLoadBalancerServer" class="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                Load Balancer
              </span>
              <span v-if="serverProvider" class="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                {{ providerLabels[serverProvider] || serverProvider }}
              </span>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center gap-2">
              <div class="h-4 w-32 animate-pulse rounded bg-muted" />
              <div class="h-5 w-16 animate-pulse rounded bg-muted" />
            </div>
          </template>
        </div>
        <div v-if="isServerDataLoaded" class="flex items-center gap-2">
          <Button
            v-if="showProvisionButton"
            variant="outline"
            size="sm"
            class="border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
            @click="showProvisionDialog = true"
          >
            <Icon name="lucide:terminal" class="mr-2 h-4 w-4" />
            Provision
          </Button>
          <Button
            v-if="serverConnected"
            variant="outline"
            size="sm"
            @click="openTerminal"
          >
            <Terminal class="mr-2 h-4 w-4" />
            Terminal
          </Button>
          <ServerAddSite v-if="serverId && !isLoadBalancerServer && isServerTabActive('sites')" :server-id="serverId" @created="onSiteCreated" />
          <!--
            Docker-only create-project action. Mirrors ServerAddSite's
            convention: tab-gated, self-contained button + dialog,
            emits to bump the page's refresh key. Visible only on
            docker servers when the Projects tab is active.
          -->
          <ServerDockerCreateProject
            v-if="serverId && isDockerServer && isServerTabActive('projects')"
            :server-id="serverId"
            @created="onDockerProjectCreated"
          />
        </div>
      </div>
      <nav
        v-if="isServerDataLoaded"
        ref="serverNavRef"
        class="relative -mb-px flex gap-1 overflow-x-auto"
        :class="{ '-mx-4 lg:-mx-8 px-4 lg:px-8 border-b border-border mb-0': isAdvancedTabActive }"
      >
        <NuxtLink
          v-for="tab in serverDetailTabs"
          :key="tab.value"
          :ref="(el) => setServerTabRef(tab.query, el)"
          :to="{ path: `/servers/${serverId}`, query: tab.query === 'advanced' ? { tab: tab.query, subtab: 'general' } : { tab: tab.query } }"
          class="relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isServerTabActive(tab.query)
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          ]"
        >
          <Icon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
        <!-- Sliding indicator -->
        <span
          class="absolute bottom-0 h-0.5 bg-foreground transition-all duration-300 ease-out"
          :style="{ left: `${serverIndicatorLeft}px`, width: `${serverIndicatorWidth}px` }"
        />
      </nav>
      <nav v-else class="relative -mb-px flex gap-1 overflow-x-auto">
        <div v-for="i in 6" :key="i" class="h-9 w-20 animate-pulse rounded bg-muted px-3 py-2" />
      </nav>
      <!-- Advanced Sub-tabs -->
      <nav v-if="isAdvancedTabActive" ref="advancedNavRef" class="relative -mb-px flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="subtab in advancedSubTabs"
          :key="subtab.value"
          :ref="(el) => setAdvancedTabRef(subtab.query, el)"
          :to="{ path: `/servers/${serverId}`, query: { tab: 'advanced', subtab: subtab.query } }"
          class="relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isAdvancedSubTabActive(subtab.query)
              ? 'text-rose-500 dark:text-rose-300'
              : 'text-muted-foreground hover:text-foreground'
          ]"
        >
          <Icon :name="subtab.icon" class="h-4 w-4" />
          {{ subtab.label }}
        </NuxtLink>
        <!-- Sliding indicator -->
        <span
          class="absolute bottom-0 h-0.5 bg-rose-400 transition-all duration-300 ease-out"
          :style="{ left: `${advancedIndicatorLeft}px`, width: `${advancedIndicatorWidth}px` }"
        />
      </nav>
    </div>

    <!-- Site Detail Navigation -->
    <div v-if="showSiteTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <!-- Breadcrumb: Servers / ServerName / SiteAddress -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/servers"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Server class="h-4 w-4" />
            Servers
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <NuxtLink
            :to="`/servers/${serverId}`"
            class="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
            />
            {{ serverName || 'Loading...' }}
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <div class="flex items-center gap-2">
            <Globe class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{ siteAddress || 'Loading...' }}</span>
            <span v-if="siteType" class="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              {{ siteTypeLabels[siteType] || siteType }}
            </span>
            <a v-if="siteUrl" :href="siteUrl" target="_blank" rel="noreferrer" class="text-muted-foreground hover:text-foreground">
              <Icon name="lucide:external-link" class="h-4 w-4" />
            </a>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <SharedLogsSheet v-if="serverId && siteId" :server-id="serverId" type="site" :site-id="siteId" />
          <Button
            v-if="serverConnected"
            variant="outline"
            size="sm"
            @click="openTerminal"
          >
            <Terminal class="mr-2 h-4 w-4" />
            Terminal
          </Button>
          <SiteDeployApplication
            v-if="serverId && siteId && siteType && !['wordpress', 'phpmyadmin'].includes(siteType)"
            :server-id="serverId"
            :site-id="siteId"
            :is-deploying="isDeploying"
            @deployed="onDeployTriggered"
          />
        </div>
      </div>
      <nav ref="siteNavRef" class="relative -mb-px flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="tab in siteDetailTabs"
          :key="tab.value"
          :ref="(el) => setSiteTabRef(tab.query, el)"
          :to="{ path: `/servers/${serverId}/sites/${siteId}`, query: { tab: tab.query } }"
          class="relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isSiteTabActive(tab.query)
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          ]"
        >
          <Icon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
        <!-- Sliding indicator -->
        <span
          class="absolute bottom-0 h-0.5 bg-foreground transition-all duration-300 ease-out"
          :style="{ left: `${siteIndicatorLeft}px`, width: `${siteIndicatorWidth}px` }"
        />
      </nav>
    </div>

    <!-- DNS Domain Detail Navigation -->
    <div v-if="showDnsTabs" class="px-4 lg:px-8">
      <div class="flex items-center justify-between py-2">
        <!-- Breadcrumb: Domains / domain.address -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/dns"
            class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Globe class="h-4 w-4" />
            Domains
          </NuxtLink>
          <span class="text-muted-foreground">/</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ domainAddress || 'Loading...' }}</span>
            <span v-if="domainProviderLabel" class="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              {{ domainProviderLabel }}
            </span>
          </div>
        </div>
      </div>
      <nav class="-mb-px flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="tab in dnsDetailTabs"
          :key="tab.value"
          :to="`/dns/${domainId}${tab.path}`"
          class="relative whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isDnsTabActive(tab.path)
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
          ]"
        >
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Create Team Dialog -->
    <SettingsCreateTeam v-model:open="isCreateTeamOpen" @created="onTeamCreated" />

    <SettingsSheet />

    <!-- Provision Command Dialog -->
    <ServerProvisionCommandDialog
      v-if="serverId && serverProvisionCommand"
      v-model:open="showProvisionDialog"
      :server-id="serverId"
      :provision-command="serverProvisionCommand"
    />
  </nav>
</template>

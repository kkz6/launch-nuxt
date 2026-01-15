<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  ChevronsUpDown,
  LogOut,
  Rocket,
  Settings,
  Plus,
  Trash2,
  Check,
  Sun,
  Moon,
  Monitor,
  Server,
  Globe,
  Terminal,
} from "lucide-vue-next";
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
}

const { user, logout } = useAuth();
const { open: openSettingsSheet } = useSettingsSheet();
const colorMode = useColorMode();
const route = useRoute();

// Global navigation tabs
const globalTabs = [
  { value: "servers", label: "Servers", route: "/servers", icon: Server },
  { value: "domains", label: "Domains", route: "/dns", icon: Globe },
];

// Server detail tabs
const serverDetailTabs = [
  { value: "sites", label: "Sites", query: "sites" },
  { value: "databases", label: "Databases", query: "databases" },
  { value: "networks", label: "Networks", query: "networks" },
  { value: "daemons", label: "Daemons", query: "daemons" },
  { value: "schedulers", label: "Schedulers", query: "schedulers" },
  { value: "advanced", label: "Advanced", query: "advanced" },
];

// Site detail tabs (base - filtered based on site type)
const allSiteDetailTabs = [
  { value: "general", label: "Overview", query: "general" },
  { value: "deployments", label: "Deployments", query: "deployments" },
  { value: "files", label: "Files", query: "files" },
  { value: "queues", label: "Queues", query: "queues" },
  { value: "commands", label: "Commands", query: "commands" },
  { value: "settings", label: "Settings", query: "settings" },
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

// Site data for detail page
const siteAddress = ref<string | null>(null);
const siteType = ref<string | null>(null);
const siteUrl = ref<string | null>(null);

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
};

// Computed site tabs based on site type
const siteDetailTabs = computed(() => {
  if (!siteType.value) return allSiteDetailTabs;
  if (siteType.value === 'wordpress') {
    return allSiteDetailTabs.filter((t) => !['deployments', 'queues'].includes(t.value));
  }
  if (siteType.value === 'generic') {
    return allSiteDetailTabs.filter((t) => t.value !== 'queues');
  }
  return allSiteDetailTabs;
});

// Fetch server info when on server or site detail page
watch([serverId, siteId], async ([sId, stId]) => {
  if (sId && !stId) {
    // Server detail page only
    try {
      const response = await $api<{ data: { name: string; public_ipv4: string; connected: boolean; provider: string } }>(`/servers/${sId}`);
      serverName.value = response.data.name;
      serverIp.value = response.data.public_ipv4;
      serverConnected.value = response.data.connected;
      serverProvider.value = response.data.provider;
    } catch {
      serverName.value = null;
    }
    // Clear site data
    siteAddress.value = null;
    siteType.value = null;
  } else if (sId && stId) {
    // Site detail page - fetch both server and site
    try {
      const [serverRes, siteRes] = await Promise.all([
        $api<{ data: { name: string; public_ipv4: string; connected: boolean; provider: string } }>(`/servers/${sId}`),
        $api<{ data: { address: string; type: string; url: string } }>(`/servers/${sId}/sites/${stId}`),
      ]);
      serverName.value = serverRes.data.name;
      serverIp.value = serverRes.data.public_ipv4;
      serverConnected.value = serverRes.data.connected;
      serverProvider.value = serverRes.data.provider;
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
  return route.path === tabRoute || route.path.startsWith(`${tabRoute}/`);
};

const isServerTabActive = (query: string) => {
  const currentTab = route.query.tab as string || 'sites';
  return currentTab === query;
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

const showGlobalTabs = computed(() => {
  // Show global tabs only on list pages, not detail pages
  return route.path === '/servers' || route.path === '/dns';
});

const showDnsTabs = computed(() => {
  return isDnsDetailPage.value;
});

const showServerTabs = computed(() => {
  return isServerDetailPage.value;
});

const showSiteTabs = computed(() => {
  return isSiteDetailPage.value;
});

// DNS refresh trigger
const dnsRefreshKey = useState('dnsRefreshKey', () => 0);
const onDnsCreated = () => {
  dnsRefreshKey.value++;
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
const isTeamOpen = ref(false);
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

const switchTeam = async (teamId: string) => {
  if (teamId === String(user.value?.current_team_id)) return;
  try {
    await $api(`/teams/${teamId}/switch`, { method: "POST" });
    window.location.reload();
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
    class="sticky top-0 z-40 w-full border-b border-divider bg-background/70 backdrop-blur-lg"
  >
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div
      class="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 lg:px-8"
    >
      <NuxtLink to="/servers" class="flex items-center gap-2">
        <span class="text-xl font-bold">launchctl</span>
      </NuxtLink>

      <div class="flex items-center space-x-2">
        <!-- Team Switcher -->
        <ClientOnly>
          <DropdownMenu v-model:open="isTeamOpen">
            <DropdownMenuTrigger as-child>
              <button
                class="flex h-9 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 text-sm font-medium shadow-sm transition-all duration-150 hover:bg-accent/10 hover:shadow-md"
              >
                <Avatar class="h-5 w-5">
                  <AvatarImage v-if="currentTeam?.image_url" :src="currentTeam.image_url" />
                  <AvatarFallback class="text-[10px]">
                    {{ currentTeam ? getTeamInitials(currentTeam.name) : '?' }}
                  </AvatarFallback>
                </Avatar>
                <span class="hidden max-w-[120px] truncate sm:inline">
                  {{ currentTeam?.name || 'Select Team' }}
                </span>
                <ChevronsUpDown class="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
                Teams
              </DropdownMenuLabel>

              <div v-if="isTeamsLoading" class="flex items-center justify-center py-4">
                <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground" />
              </div>

              <template v-else>
                <DropdownMenuItem
                  v-for="team in teams"
                  :key="team.id"
                  class="cursor-pointer justify-between gap-2 px-2 py-2"
                  @click="switchTeam(team.id)"
                >
                  <div class="flex items-center gap-2">
                    <Avatar class="h-6 w-6">
                      <AvatarImage v-if="team.image_url" :src="team.image_url" />
                      <AvatarFallback class="text-[10px]">
                        {{ getTeamInitials(team.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <span class="truncate">{{ team.name }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Check
                      v-if="team.id === String(user?.current_team_id)"
                      class="h-4 w-4 text-primary"
                    />
                    <button
                      v-if="canDeleteTeam(team)"
                      class="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      @click.stop="deleteTeam(team)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </DropdownMenuItem>
              </template>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="cursor-pointer gap-2 px-2 py-2"
                @click="isCreateTeamOpen = true"
              >
                <Plus class="h-4 w-4 text-muted-foreground" />
                <span>Create Team</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div class="flex h-9 w-32 animate-pulse items-center gap-2 rounded-lg border border-border bg-background/50 px-3">
              <div class="h-5 w-5 rounded-full bg-muted" />
              <div class="h-4 flex-1 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>

        <!-- User Menu -->
        <ClientOnly>
          <DropdownMenu v-model:open="isOpen">
            <DropdownMenuTrigger as-child>
              <div
                class="flex h-9 cursor-pointer items-center gap-0.5 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-1 shadow-sm transition-all duration-150 hover:bg-accent/10 hover:shadow-md sm:pr-1.5"
              >
                <Avatar class="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-xs font-medium sm:text-sm">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>

                <span
                  class="ml-0.5 mr-2 hidden max-w-[150px] truncate text-sm font-medium sm:inline"
                >
                  {{ user?.name }}
                </span>

                <ChevronsUpDown class="h-4 w-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-[280px] sm:w-64">
              <DropdownMenuLabel
                class="flex items-center gap-2 px-2 py-3 sm:py-2"
              >
                <Avatar class="h-10 w-10 sm:hidden">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-sm font-medium">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">{{ user?.name }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    user?.email
                  }}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  v-if="user?.onboarded"
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="navigateTo('/onboarding')"
                >
                  <Rocket class="h-4 w-4 text-muted-foreground" />
                  <span>Onboarding</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="openSettings"
                >
                  <Settings class="h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />

              <!-- Theme Switcher -->
              <div class="px-2 py-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted-foreground">Theme</span>
                  <div class="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition-colors"
                      :class="colorMode.preference === 'light' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click.stop="setColorMode('light')"
                    >
                      <Sun class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition-colors"
                      :class="colorMode.preference === 'dark' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click.stop="setColorMode('dark')"
                    >
                      <Moon class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition-colors"
                      :class="colorMode.preference === 'system' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click.stop="setColorMode('system')"
                    >
                      <Monitor class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="cursor-pointer gap-2 px-2 py-2.5 text-destructive focus:text-destructive sm:py-2"
                @click="handleLogout"
              >
                <LogOut class="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div
              class="flex h-9 animate-pulse items-center gap-0.5 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-1 shadow-sm sm:pr-1.5"
            >
              <div class="h-8 w-8 rounded-full bg-muted" />
              <div class="ml-0.5 mr-2 hidden h-4 w-16 rounded bg-muted sm:block" />
              <div class="h-4 w-4 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- Global Navigation Tabs (Servers / Domains) -->
    <div v-if="showGlobalTabs" class="mx-auto max-w-8xl px-4 lg:px-8">
      <div class="-mb-px flex items-center justify-between">
        <nav class="flex gap-6">
          <NuxtLink
            v-for="tab in globalTabs"
            :key="tab.value"
            :to="tab.route"
            class="relative flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors"
            :class="[
              isGlobalTabActive(tab.route)
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
            ]"
          >
            <component :is="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </NuxtLink>
        </nav>
        <ServerCreateServerDialog v-if="route.path === '/servers'" />
        <DnsAddDomain v-if="route.path === '/dns'" :providers="[]" @created="onDnsCreated" />
      </div>
    </div>

    <!-- Server Detail Navigation -->
    <div v-if="showServerTabs" class="mx-auto max-w-8xl px-4 lg:px-8">
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
          <div class="flex items-center gap-2">
            <span class="relative flex items-center gap-1.5 text-sm font-medium">
              <span
                class="h-2 w-2 rounded-full"
                :class="serverConnected ? 'bg-emerald-500' : 'bg-red-500'"
              />
              {{ serverName || 'Loading...' }}
            </span>
            <span v-if="serverProvider" class="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              {{ providerLabels[serverProvider] || serverProvider }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <SharedLogsSheet v-if="serverId" :server-id="serverId" type="server" />
          <Button
            v-if="serverConnected"
            variant="outline"
            size="sm"
            @click="openTerminal"
          >
            <Terminal class="mr-2 h-4 w-4" />
            Terminal
          </Button>
          <ServerAddSite v-if="serverId" :server-id="serverId" />
        </div>
      </div>
      <nav class="-mb-px flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="tab in serverDetailTabs"
          :key="tab.value"
          :to="{ path: `/servers/${serverId}`, query: { tab: tab.query } }"
          class="relative whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isServerTabActive(tab.query)
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
          ]"
        >
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Site Detail Navigation -->
    <div v-if="showSiteTabs" class="mx-auto max-w-8xl px-4 lg:px-8">
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
            v-if="serverId && siteId && siteType !== 'wordpress'"
            :server-id="serverId"
            :site-id="siteId"
          />
        </div>
      </div>
      <nav class="-mb-px flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="tab in siteDetailTabs"
          :key="tab.value"
          :to="{ path: `/servers/${serverId}/sites/${siteId}`, query: { tab: tab.query } }"
          class="relative whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
          :class="[
            isSiteTabActive(tab.query)
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
          ]"
        >
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>

    <!-- DNS Domain Detail Navigation -->
    <div v-if="showDnsTabs" class="mx-auto max-w-8xl px-4 lg:px-8">
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
  </nav>
</template>

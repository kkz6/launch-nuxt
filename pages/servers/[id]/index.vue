<script setup lang="ts">
import { Terminal } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
const isTerminalOpen = ref(false);

// Valid tab values
const validTabs = ["sites", "databases", "networks", "logs", "daemons", "schedulers", "advanced"];

// Get initial tab from query params or default to "sites"
const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string;
  return validTabs.includes(tabFromQuery) ? tabFromQuery : "sites";
};

const activeTab = ref(getInitialTab());

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

const serviceProviders: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: "Custom Server",
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
    <!-- Server info bar -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Badge :variant="server.connected ? 'success' : 'destructive'">
          {{ server.connected ? "Connected" : "Disconnected" }}
        </Badge>
        <Badge>
          {{
            server.provider === "custom_server"
              ? "Custom Server"
              : serviceProviders[server.provider] || server.provider
          }}
        </Badge>
        <span v-if="server.description" class="text-sm text-muted-foreground">
          {{ server.description }}
        </span>
      </div>
      <div v-if="server.connected" class="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                @click="isTerminalOpen = true"
              >
                <Terminal class="mr-2 h-4 w-4" />
                Terminal
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open Terminal</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- Tab Content -->
    <div v-if="activeTab === 'sites'">
      <ServerShowSites :sites="sites" :server="server" />
    </div>

    <div v-else-if="activeTab === 'databases'">
      <ServerShowDatabases :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'networks'">
      <ServerShowNetworks :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'logs'">
      <ServerShowLogs :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'daemons'">
      <ServerShowDaemons :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'schedulers'">
      <ServerShowSchedulers :server-id="server.id" />
    </div>

    <div v-else-if="activeTab === 'advanced'">
      <ServerAdvancedSettings :server="server" />
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

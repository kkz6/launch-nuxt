<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import type { Server } from "~/types";
import { serverService } from "~/services/serverService";
import { useServersStore } from "~/stores/useServersStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({
  title: "Servers",
});

// Pinia store owns: the servers list, the WS subscription, and event-
// driven mutations. We just read from it. Compare with the old code
// where every page had its own fetch+merge+subscribe — see
// stores/useServersStore.ts for the rationale.
const serversStore = useServersStore();
const { servers, isLoading } = storeToRefs(serversStore);

// Provision dialog state
const showProvisionDialog = ref(false);
const selectedServer = ref<Server | null>(null);

// Logs dialog state
const showLogsDialog = ref(false);

const openProvisionDialog = (server: Server) => {
  selectedServer.value = server;
  showProvisionDialog.value = true;
};

const openLogsDialog = (server: Server) => {
  selectedServer.value = server;
  showLogsDialog.value = true;
};

// Navigate to detail page on card click — only when the server is running.
// We do this manually (instead of <NuxtLink>) because the previous
// <component :is="'NuxtLink'"> dynamic-component pattern silently dropped
// NuxtLink's navigation wiring, leaving cards visually clickable but inert.
const onCardClick = (server: Server) => {
  if (server.status !== 'running') return;
  cacheServer(server);
  navigateTo(`/servers/${server.id}`);
};

// Optimistically remove the row immediately while the WS event catches up.
// The store will reconcile on the next event.
const handleServerDeleted = (serverId: string) => {
  serversStore.remove(serverId);
};

const handleRetryProvision = async (server: Server) => {
  try {
    await serverService.retryProvision(server.id);
    toast.success("Provisioning has been queued");
    await serversStore.fetchAll();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to retry provisioning");
  }
};

const handleConnected = async () => {
  // Try Connection succeeded; the server is now in provisioning.
  // Pull the fresh list so the row flips out of awaiting_connection.
  await serversStore.fetchAll();
};

// Check if server needs pending actions UI
const needsPendingActions = (server: Server): boolean => {
  return ['new', 'starting', 'failed', 'awaiting_connection'].includes(server.status);
};

// Watch for refresh trigger (e.g., after team switch)
const serversRefreshKey = useState('serversRefreshKey', () => 0);
watch(serversRefreshKey, () => {
  serversStore.fetchAll();
});

const getProviderIcon = (provider: string): string => {
  const name = provider?.toLowerCase() || "";
  if (name.includes("digitalocean")) return "simple-icons:digitalocean";
  if (name.includes("hetzner")) return "simple-icons:hetzner";
  if (name.includes("linode")) return "simple-icons:linode";
  if (name.includes("vultr")) return "simple-icons:vultr";
  if (name.includes("aws")) return "simple-icons:amazonwebservices";
  if (name.includes("google") || name.includes("gcp")) return "simple-icons:googlecloud";
  if (name.includes("azure")) return "simple-icons:microsoftazure";
  return "lucide:server";
};

const getServerIcon = (server: Server): string => {
  if (server.type === "loadbalancer") return "lucide:network";
  if (server.type === "docker") return "simple-icons:docker";
  return getProviderIcon(server.provider);
};

const getProviderColor = (server: Server): string => {
  if (server.type === "loadbalancer") return "#6366f1";
  if (server.type === "docker") return "#2496ED";
  const name = server.provider?.toLowerCase() || "";
  if (name.includes("digitalocean")) return "#0080FF";
  if (name.includes("hetzner")) return "#D50C2D";
  if (name.includes("linode")) return "#00A95C";
  if (name.includes("vultr")) return "#007BFC";
  if (name.includes("aws")) return "#FF9900";
  if (name.includes("google") || name.includes("gcp")) return "#4285F4";
  if (name.includes("azure")) return "#0078D4";
  return "#6B7280";
};

const isNonDefaultType = (server: Server): boolean => {
  return !!server.type && server.type !== "php";
};

const getStatusColor = (server: Server): string => {
  switch (server.status) {
    case "running":
      return server.connected ? "bg-green-500" : "bg-red-500";
    case "provisioning":
    case "new":
    case "starting":
    case "awaiting_connection":
      return "bg-yellow-500";
    case "failed":
    case "unknown":
      return "bg-red-500";
    case "deleting":
      return "bg-orange-500";
    default:
      return "bg-gray-500";
  }
};

const getStatusLabel = (server: Server): string => {
  if (server.status_label) return server.status_label;
  const labels: Record<string, string> = {
    running: "Running",
    provisioning: "Provisioning",
    new: "Creating",
    starting: "Starting",
    failed: "Failed",
    deleting: "Deleting",
    unknown: "Unknown",
    awaiting_connection: "Awaiting Connection",
  };
  return labels[server.status] || server.status;
};

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

// Auto-close provision dialogs when the selected server's status changes.
// Reads directly from the store's reactive list — no local state to keep
// in sync.
watch(servers, (newServers) => {
  if (!selectedServer.value) return

  const updated = newServers.find(s => s.id === selectedServer.value!.id)
  if (!updated) return

  // Close provision command dialog once the server moves past the
  // pre-connect states. Cloud servers start in 'new' and flip when the
  // wait-for-connect job sees SSH; custom servers start in
  // 'awaiting_connection' and flip when the user clicks Try Connection.
  if (showProvisionDialog.value && !['new', 'awaiting_connection'].includes(updated.status)) {
    showProvisionDialog.value = false
  }

  // Close logs sheet when provisioning completes
  if (showLogsDialog.value && updated.status === 'running') {
    showLogsDialog.value = false
  }
})

// Cache server data for Navbar when navigating to detail page
const { cacheServer } = useNavbarCache();

// First-mount fetch. The store dedupes by `hasFetched`, so revisiting
// /servers from another route doesn't refetch unnecessarily, but the WS
// subscription has already been keeping the list current in the
// background — no spinner flash on return visits.
onMounted(() => {
  if (!serversStore.hasFetched) {
    serversStore.fetchAll();
  } else {
    serversStore.ensureSubscribed();
  }
});
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="servers.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:server" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">No servers added yet</p>
        <p class="text-sm text-muted-foreground">Click on Create Server to get started</p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <!-- All cards are plain divs. Only running cards get the click
           handler that navigates to the detail page; non-running cards get
           pointer-events-none so they look inert. Inner action buttons
           override that with pointer-events-auto so they still work. -->
      <div
        v-for="server in servers"
        :key="server.id"
        class="group block h-full"
        :class="server.status === 'running' ? 'cursor-pointer' : 'pointer-events-none'"
        @click="onCardClick(server)"
      >
        <div
          class="relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          :class="{
            'border-destructive/30 bg-destructive/5': server.status === 'failed',
            'opacity-60': server.status === 'unknown',
          }"
        >
          <!-- Provisioning progress bar -->
          <div
            v-if="server.status === 'provisioning'"
            class="pointer-events-none absolute inset-y-0 left-0 rounded-lg bg-green-500/20 transition-[width] duration-700 ease-out"
            :style="{ width: `${server.progress || 0}%` }"
          />

          <!-- Connecting animation (for new/starting servers) -->
          <div
            v-else-if="server.status === 'new' || server.status === 'starting'"
            class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
          >
            <div class="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          </div>

          <!-- Info icon - top right -->
          <TooltipProvider v-if="server.status === 'running'" :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="pointer-events-auto absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors cursor-help"
                  @click.prevent.stop
                >
                  <Icon name="lucide:info" class="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" class="max-w-xs">
                <div class="space-y-2 text-xs">
                  <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    <template v-if="server.type_label">
                      <span class="text-muted-foreground">Type</span>
                      <span>{{ server.type_label }}</span>
                    </template>
                    <template v-if="server.operating_system_label">
                      <span class="text-muted-foreground">OS</span>
                      <span>{{ server.operating_system_label }}</span>
                    </template>
                    <template v-if="server.cpu_cores">
                      <span class="text-muted-foreground">CPU</span>
                      <span>{{ server.cpu_cores }} cores</span>
                    </template>
                    <template v-if="server.memory_in_mb">
                      <span class="text-muted-foreground">Memory</span>
                      <span>{{ server.memory_in_mb }} MB</span>
                    </template>
                    <template v-if="server.storage_in_gb">
                      <span class="text-muted-foreground">Storage</span>
                      <span>{{ server.storage_in_gb }} GB</span>
                    </template>
                    <template v-if="server.ssh_port">
                      <span class="text-muted-foreground">SSH Port</span>
                      <span>{{ server.ssh_port }}</span>
                    </template>
                    <template v-if="server.username">
                      <span class="text-muted-foreground">User</span>
                      <span>{{ server.username }}</span>
                    </template>
                    <span class="text-muted-foreground">Connected</span>
                    <span :class="server.connected ? 'text-green-500' : 'text-red-500'">
                      {{ server.connected ? 'Yes' : 'No' }}
                    </span>
                    <template v-if="server.services_count">
                      <span class="text-muted-foreground">Services</span>
                      <span>{{ server.services_count }}</span>
                    </template>
                  </div>
                  <p v-if="server.provisioned_at" class="border-t pt-1.5 text-muted-foreground">
                    Provisioned {{ formatDate(server.provisioned_at) }}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div class="relative flex items-start gap-3">
            <div
              class="brand-icon-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors duration-200"
              :style="{ '--brand-color': getProviderColor(server) }"
            >
              <Icon
                :name="getServerIcon(server)"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold truncate">{{ server.name }}</h3>
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="getStatusColor(server)"
                />
              </div>
              <p class="text-sm text-muted-foreground truncate">
                <span>{{ server.provider_label || server.provider }}</span>
                <template v-if="isNonDefaultType(server)">
                  <span class="mx-1">·</span>
                  <span>{{ server.type_label || server.type }}</span>
                </template>
              </p>
              <p v-if="server.public_ipv4" class="text-sm text-muted-foreground truncate">
                {{ server.public_ipv4 }}
              </p>
            </div>
          </div>

          <div class="relative mt-auto flex min-h-7 items-center justify-between pt-4 text-sm">
            <div class="flex items-center gap-4">
              <div
                v-if="server.status === 'running'"
                class="flex items-center gap-1.5 text-muted-foreground"
              >
                <!--
                  Docker servers don't have rows in the Laravel
                  `sites` table — their workloads (applications +
                  composes + managed databases) live in the docker
                  module. Swap the icon + label so the card shows a
                  meaningful count instead of always "0 sites".
                -->
                <template v-if="server.type === 'docker'">
                  <Icon name="lucide:container" class="h-3.5 w-3.5" />
                  <span>
                    {{ server.workloads_count ?? 0 }}
                    {{ (server.workloads_count ?? 0) === 1 ? 'workload' : 'workloads' }}
                  </span>
                </template>
                <template v-else>
                  <Icon name="lucide:globe" class="h-3.5 w-3.5" />
                  <span>
                    {{ server.sites_count ?? 0 }}
                    {{ (server.sites_count ?? 0) === 1 ? 'site' : 'sites' }}
                  </span>
                </template>
              </div>
              <div class="flex items-center gap-1.5">
                <span
                  v-if="server.status === 'provisioning'"
                  class="flex items-center gap-2 text-muted-foreground"
                >
                  <span class="flex items-center gap-1.5">
                    <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
                    {{ getStatusLabel(server) }}
                  </span>
                  <button
                    type="button"
                    class="pointer-events-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                    @click.prevent.stop="openLogsDialog(server)"
                  >
                    <Icon name="lucide:terminal" class="h-3 w-3" />
                    Logs
                  </button>
                </span>
                <span
                  v-else-if="server.status === 'deleting'"
                  class="flex items-center gap-1.5 text-muted-foreground"
                >
                  <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
                  {{ getStatusLabel(server) }}
                </span>
                <ServerPendingActions
                  v-else-if="needsPendingActions(server)"
                  :server="server"
                  @provision="openProvisionDialog"
                  @view-logs="openLogsDialog"
                  @deleted="handleServerDeleted"
                  @retry-provision="handleRetryProvision"
                  @connected="handleConnected"
                />
              </div>
            </div>
            <span class="text-muted-foreground">
              {{ formatDate(server.provisioned_at || server.created_at) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Provision Command Dialog -->
    <ServerProvisionCommandDialog
      v-if="selectedServer"
      v-model:open="showProvisionDialog"
      :server-id="selectedServer.id"
      :provision-command="selectedServer.provision_command || null"
    />

    <!-- Provision Logs Sheet -->
    <ServerProvisionLogsSheet
      v-model:open="showLogsDialog"
      :server="selectedServer"
    />
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

.group:hover .brand-icon-bg {
  background-color: var(--brand-color);
}

.group:hover .brand-icon {
  color: white;
}
</style>

<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import type { Server } from "~/types";
import { serverService } from "~/services/serverService";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({
  title: "Servers",
});

const servers = ref<Server[]>([]);
const isLoading = ref(true);

// Provision dialog state
const showProvisionDialog = ref(false);
const selectedServer = ref<Server | null>(null);

const openProvisionDialog = (server: Server) => {
  selectedServer.value = server;
  showProvisionDialog.value = true;
};

// Watch for refresh trigger (e.g., after team switch)
const serversRefreshKey = useState('serversRefreshKey', () => 0);
watch(serversRefreshKey, () => {
  fetchServers();
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

const getStatusColor = (status: string): string => {
  switch (status) {
    case "running":
      return "bg-green-500";
    case "provisioning":
    case "new":
    case "starting":
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

const fetchServers = async () => {
  isLoading.value = true;
  try {
    const response = await serverService.list();
    servers.value = response.data;
  } catch {
    // Handle error silently
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchServers);
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
      <NuxtLink
        v-for="server in servers"
        :key="server.id"
        :to="server.status === 'running' ? `/servers/${server.id}` : '#'"
        class="group"
        :class="{ 'pointer-events-none': server.status !== 'running' }"
      >
        <div
          class="relative rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          :class="{
            'opacity-60': server.status === 'failed' || server.status === 'unknown',
          }"
        >
          <!-- Provisioning progress bar -->
          <div
            v-if="server.status === 'provisioning'"
            class="pointer-events-none absolute inset-0 animate-pulse rounded-lg bg-green-500/20"
            :style="{ width: `${server.progress || 0}%` }"
          />

          <!-- Connecting animation (for new/starting servers) -->
          <div
            v-else-if="server.status === 'new' || server.status === 'starting'"
            class="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
          >
            <div class="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          </div>

          <div class="relative flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon
                :name="getProviderIcon(server.provider)"
                class="h-5 w-5 text-muted-foreground"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold truncate">{{ server.name }}</h3>
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="getStatusColor(server.status)"
                />
              </div>
              <p class="text-sm text-muted-foreground truncate">
                {{ server.provider_label || server.provider }}
              </p>
              <p v-if="server.public_ipv4" class="text-sm text-muted-foreground truncate">
                {{ server.public_ipv4 }}
              </p>
            </div>
          </div>

          <div class="relative mt-4 flex items-center justify-between text-sm">
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="lucide:globe" class="h-3.5 w-3.5" />
                <span>{{ server.sites_count ?? 0 }} sites</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span
                  v-if="server.status === 'provisioning' || server.status === 'deleting'"
                  class="flex items-center gap-1.5 text-muted-foreground"
                >
                  <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
                  {{ getStatusLabel(server) }}
                </span>
                <button
                  v-else-if="server.provider === 'custom_server' && server.provision_command"
                  class="pointer-events-auto flex items-center gap-1.5 rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                  @click.prevent="openProvisionDialog(server)"
                >
                  <Icon name="lucide:terminal" class="h-3 w-3" />
                  Provision
                </button>
                <span
                  v-else-if="server.status === 'new' || server.status === 'starting'"
                  class="flex items-center gap-1.5 text-muted-foreground"
                >
                  <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
                  {{ getStatusLabel(server) }}
                </span>
                <span
                  v-else-if="server.status === 'failed'"
                  class="text-destructive"
                >
                  {{ getStatusLabel(server) }}
                </span>
              </div>
            </div>
            <span class="text-muted-foreground">
              {{ formatDate(server.provisioned_at || server.created_at) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Provision Command Dialog -->
    <ServerProvisionCommandDialog
      v-if="selectedServer"
      v-model:open="showProvisionDialog"
      :server-id="selectedServer.id"
      :provision-command="selectedServer.provision_command || null"
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
</style>

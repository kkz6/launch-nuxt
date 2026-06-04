<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import type { AdminServerDetail } from "~/types";
import { adminService } from "~/services/adminService";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const route = useRoute();
const serverId = route.params.id as string;

const server = ref<AdminServerDetail | null>(null);
const isLoading = ref(true);
const notFound = ref(false);

useHead({ title: () => `Admin — ${server.value?.name ?? "Server"}` });

function applyBreadcrumb(): void {
  setBreadcrumbs([
    { label: "Admin", to: "/admin/overview" },
    { label: "Servers", to: "/admin/servers" },
    { label: server.value?.name || "Server" },
  ]);
}
applyBreadcrumb();

const statusVariant = computed(() =>
  server.value?.status === "running" ? "green" : "secondary",
);

const providerIcon = computed(() => {
  const name = server.value?.provider?.toLowerCase() || "";
  if (name.includes("digitalocean")) return "simple-icons:digitalocean";
  if (name.includes("hetzner")) return "simple-icons:hetzner";
  if (name.includes("linode")) return "simple-icons:linode";
  if (name.includes("vultr")) return "simple-icons:vultr";
  if (name.includes("aws")) return "simple-icons:amazonaws";
  return "lucide:server";
});

const memory = computed(() => {
  const mb = server.value?.memory_in_mb;
  if (!mb) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
});

const teamInitials = computed(() =>
  (server.value?.owner.team_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2),
);

const detectedOS = computed(() => {
  const s = server.value;
  if (!s) return "";
  return [s.detected_os_id, s.detected_os_version, s.detected_arch]
    .filter(Boolean)
    .join(" · ");
});

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function load(): Promise<void> {
  isLoading.value = true;
  try {
    const res = await adminService.showServer(serverId);
    server.value = res.data;
    applyBreadcrumb();
  } catch (error: unknown) {
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      notFound.value = true;
    } else {
      toast.error("Failed to load server");
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16"
    >
      <Icon name="lucide:server-off" class="h-10 w-10 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">This server no longer exists.</p>
      <Button variant="outline" size="sm" @click="navigateTo('/admin/servers')">
        Back to servers
      </Button>
    </div>

    <div v-else-if="server" class="space-y-5">
      <!-- Hero -->
      <div
        class="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/40 p-6"
      >
        <div
          class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-2xl"
        />
        <div class="relative flex flex-wrap items-center gap-4">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted shadow-sm"
          >
            <Icon :name="providerIcon" class="h-8 w-8 text-foreground" />
          </div>
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold tracking-tight">
                {{ server.name }}
              </h1>
              <Badge :variant="statusVariant" class="capitalize">
                {{ server.status }}
              </Badge>
              <span
                class="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="server.connected ? 'bg-emerald-500' : 'bg-red-500'"
                />
                {{ server.connected ? "Connected" : "Disconnected" }}
              </span>
            </div>
            <p class="text-sm capitalize text-muted-foreground">
              {{ server.provider.replace("_", " ") }}
              <template v-if="server.type"> · {{ server.type }}</template>
            </p>
          </div>
        </div>
      </div>

      <!-- Owner (the key ask: who owns this) -->
      <NuxtLink
        v-if="server.owner.user_id"
        :to="`/admin/users/${server.owner.user_id}`"
        class="group flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
      >
        <div class="flex items-center gap-3">
          <Avatar class="h-11 w-11 border">
            <AvatarFallback class="text-sm font-semibold">
              {{ teamInitials }}
            </AvatarFallback>
          </Avatar>
          <div>
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold">{{ server.owner.team_name }}</p>
              <Badge v-if="server.owner.personal_team" variant="secondary">
                personal
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ server.owner.user_name }} · {{ server.owner.user_email }}
            </p>
          </div>
        </div>
        <span
          class="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground"
        >
          View owner
          <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
        </span>
      </NuxtLink>

      <!-- Spec tiles -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:cpu" class="h-3.5 w-3.5" />
            vCPU
          </div>
          <p class="mt-2 text-lg font-semibold">
            {{ server.cpu_cores ?? "—" }}
          </p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:memory-stick" class="h-3.5 w-3.5" />
            Memory
          </div>
          <p class="mt-2 text-lg font-semibold">{{ memory }}</p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:hard-drive" class="h-3.5 w-3.5" />
            Storage
          </div>
          <p class="mt-2 text-lg font-semibold">
            {{ server.storage_in_gb ? `${server.storage_in_gb} GB` : "—" }}
          </p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:globe" class="h-3.5 w-3.5" />
            Public IPv4
          </div>
          <p class="mt-2 truncate font-mono text-sm font-semibold">
            {{ server.public_ipv4 || "—" }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <!-- OS -->
        <div class="rounded-xl border bg-card">
          <div class="flex items-center gap-2 border-b px-5 py-3">
            <Icon name="lucide:disc-3" class="h-4 w-4 text-muted-foreground" />
            <h2 class="text-sm font-semibold">Operating system</h2>
          </div>
          <div class="space-y-3 px-5 py-4 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Selected</span>
              <span class="font-medium">
                {{ server.operating_system || "—" }}
              </span>
            </div>
            <div v-if="detectedOS" class="flex justify-between gap-4">
              <span class="text-muted-foreground">Detected</span>
              <span class="font-medium">{{ detectedOS }}</span>
            </div>
            <div
              v-if="server.detected_kernel"
              class="flex justify-between gap-4"
            >
              <span class="text-muted-foreground">Kernel</span>
              <span class="font-mono text-xs font-medium">
                {{ server.detected_kernel }}
              </span>
            </div>
          </div>
        </div>

        <!-- Status -->
        <div class="rounded-xl border bg-card">
          <div class="flex items-center gap-2 border-b px-5 py-3">
            <Icon name="lucide:gauge" class="h-4 w-4 text-muted-foreground" />
            <h2 class="text-sm font-semibold">Status &amp; lifecycle</h2>
          </div>
          <div class="space-y-3 px-5 py-4 text-sm">
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Monitoring</span>
              <Badge
                :variant="server.monitoring_enabled ? 'green' : 'secondary'"
              >
                {{ server.monitoring_enabled ? "on" : "off" }}
              </Badge>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Auto-update</span>
              <Badge :variant="server.auto_update ? 'green' : 'secondary'">
                {{ server.auto_update ? "on" : "off" }}
              </Badge>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Provisioned</span>
              <span class="font-medium">
                {{ formatDate(server.provisioned_at) }}
              </span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Last connectivity</span>
              <span class="font-medium">
                {{ formatDate(server.last_connectivity_check) }}
              </span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Created</span>
              <span class="font-medium">{{
                formatDate(server.created_at)
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

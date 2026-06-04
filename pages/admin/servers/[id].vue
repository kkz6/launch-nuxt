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

    <div v-else-if="server">
      <!-- Identity header -->
      <div class="flex flex-wrap items-center gap-4 border-b pb-6">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-xl bg-muted"
        >
          <Icon :name="providerIcon" class="h-7 w-7 text-foreground" />
        </div>
        <div class="space-y-1.5">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="text-2xl font-semibold tracking-tight">
              {{ server.name }}
            </h1>
            <Badge :variant="statusVariant" class="capitalize">
              {{ server.status }}
            </Badge>
            <span
              class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
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

      <!-- Metrics strip -->
      <div class="flex flex-wrap gap-x-12 gap-y-6 border-b py-6">
        <div>
          <p class="text-2xl font-semibold">{{ server.cpu_cores ?? "—" }}</p>
          <p
            class="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground"
          >
            vCPU
          </p>
        </div>
        <div>
          <p class="text-2xl font-semibold">{{ memory }}</p>
          <p
            class="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground"
          >
            Memory
          </p>
        </div>
        <div>
          <p class="text-2xl font-semibold">
            {{ server.storage_in_gb ? `${server.storage_in_gb} GB` : "—" }}
          </p>
          <p
            class="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground"
          >
            Storage
          </p>
        </div>
        <div>
          <p class="font-mono text-2xl font-semibold">
            {{ server.public_ipv4 || "—" }}
          </p>
          <p
            class="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground"
          >
            Public IPv4
          </p>
        </div>
      </div>

      <!-- Owner (the key ask: who owns this) -->
      <div class="border-b py-6">
        <h2
          class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Owner
        </h2>
        <NuxtLink
          v-if="server.owner.user_id"
          :to="`/admin/users/${server.owner.user_id}`"
          class="group -mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
        >
          <div class="flex items-center gap-3">
            <Avatar class="h-10 w-10">
              <AvatarFallback class="text-sm font-semibold">
                {{ teamInitials }}
              </AvatarFallback>
            </Avatar>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium">{{ server.owner.team_name }}</p>
                <span
                  v-if="server.owner.personal_team"
                  class="text-xs text-muted-foreground"
                >
                  · personal
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ server.owner.user_name }} · {{ server.owner.user_email }}
              </p>
            </div>
          </div>
          <Icon
            name="lucide:arrow-right"
            class="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
          />
        </NuxtLink>
      </div>

      <!-- Detail columns -->
      <div class="grid grid-cols-1 gap-x-12 gap-y-6 py-6 sm:grid-cols-2">
        <div>
          <h2
            class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Operating system
          </h2>
          <dl class="divide-y text-sm">
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Selected</dt>
              <dd class="font-medium">{{ server.operating_system || "—" }}</dd>
            </div>
            <div v-if="detectedOS" class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Detected</dt>
              <dd class="font-medium">{{ detectedOS }}</dd>
            </div>
            <div
              v-if="server.detected_kernel"
              class="flex justify-between gap-4 py-2.5"
            >
              <dt class="text-muted-foreground">Kernel</dt>
              <dd class="font-mono text-xs font-medium">
                {{ server.detected_kernel }}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2
            class="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Status &amp; lifecycle
          </h2>
          <dl class="divide-y text-sm">
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Monitoring</dt>
              <dd class="font-medium">
                {{ server.monitoring_enabled ? "On" : "Off" }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Auto-update</dt>
              <dd class="font-medium">
                {{ server.auto_update ? "On" : "Off" }}
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Provisioned</dt>
              <dd class="font-medium">
                {{ formatDate(server.provisioned_at) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Last connectivity</dt>
              <dd class="font-medium">
                {{ formatDate(server.last_connectivity_check) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">Created</dt>
              <dd class="font-medium">{{ formatDate(server.created_at) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

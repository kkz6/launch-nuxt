<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import type { AdminServerDetail } from "~/types";
import { adminService } from "~/services/adminService";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

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

const memory = computed(() => {
  const mb = server.value?.memory_in_mb;
  if (!mb) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
});

const detectedOS = computed(() => {
  const s = server.value;
  if (!s) return "";
  return [s.detected_os_id, s.detected_os_version, s.detected_arch]
    .filter(Boolean)
    .join(" · ");
});

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
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
  <div class="space-y-6 pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="notFound"
      class="rounded-lg border border-dashed py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">This server no longer exists.</p>
      <Button
        variant="outline"
        size="sm"
        class="mt-4"
        @click="navigateTo('/admin/servers')"
      >
        Back to servers
      </Button>
    </div>

    <template v-else-if="server">
      <!-- Header -->
      <div class="space-y-1">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold">{{ server.name }}</h1>
          <Badge :variant="statusVariant">{{ server.status }}</Badge>
          <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              class="h-2 w-2 rounded-full"
              :class="server.connected ? 'bg-emerald-500' : 'bg-red-500'"
            />
            {{ server.connected ? "Connected" : "Disconnected" }}
          </span>
        </div>
        <p v-if="server.description" class="text-sm text-muted-foreground">
          {{ server.description }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Owner -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Owner</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">Team</span>
              <span class="flex items-center gap-2 font-medium">
                {{ server.owner.team_name || "—" }}
                <Badge v-if="server.owner.personal_team" variant="secondary">
                  personal
                </Badge>
              </span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-muted-foreground">User</span>
              <NuxtLink
                v-if="server.owner.user_id"
                :to="`/admin/users/${server.owner.user_id}`"
                class="font-medium text-primary hover:underline"
              >
                {{ server.owner.user_name || "View user" }}
              </NuxtLink>
              <span v-else class="font-medium">—</span>
            </div>
            <div
              v-if="server.owner.user_email"
              class="flex items-center justify-between gap-4"
            >
              <span class="text-muted-foreground">Email</span>
              <span class="font-medium">{{ server.owner.user_email }}</span>
            </div>
          </CardContent>
        </Card>

        <!-- Specs -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Specs</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Provider</span>
              <span class="font-medium">{{ server.provider }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Type</span>
              <span class="font-medium">{{ server.type || "—" }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">vCPU</span>
              <span class="font-medium">{{ server.cpu_cores ?? "—" }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Memory</span>
              <span class="font-medium">{{ memory }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Storage</span>
              <span class="font-medium">
                {{ server.storage_in_gb ? `${server.storage_in_gb} GB` : "—" }}
              </span>
            </div>
          </CardContent>
        </Card>

        <!-- Network & OS -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Network &amp; OS</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Public IPv4</span>
              <span class="font-mono font-medium">
                {{ server.public_ipv4 || "—" }}
              </span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Operating system</span>
              <span class="font-medium">{{
                server.operating_system || "—"
              }}</span>
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
          </CardContent>
        </Card>

        <!-- Status -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Monitoring</span>
              <Badge
                :variant="server.monitoring_enabled ? 'green' : 'secondary'"
              >
                {{ server.monitoring_enabled ? "on" : "off" }}
              </Badge>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Auto-update</span>
              <Badge :variant="server.auto_update ? 'green' : 'secondary'">
                {{ server.auto_update ? "on" : "off" }}
              </Badge>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Provisioned</span>
              <span class="font-medium">{{
                formatDate(server.provisioned_at)
              }}</span>
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
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>

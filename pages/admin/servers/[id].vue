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
const { locale, t, te } = useI18n();
const { getServerTypeLabel } = useStableMetadataLabels();

const server = ref<AdminServerDetail | null>(null);
const isLoading = ref(true);
const notFound = ref(false);

useHead({
  title: () =>
    t("admin.serverDetail.pageTitle", {
      name: server.value?.name ?? t("admin.common.server"),
    }),
});

function applyBreadcrumb(): void {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.servers"), to: "/admin/servers" },
    { label: server.value?.name || t("admin.common.server") },
  ]);
}
applyBreadcrumb();
watch(locale, applyBreadcrumb);

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
  return mb >= 1024
    ? `${(mb / 1024).toLocaleString(locale.value, { maximumFractionDigits: 1 })} GB`
    : `${mb.toLocaleString(locale.value)} MB`;
});

const formatNumber = (value: number): string =>
  value.toLocaleString(locale.value);

const serverStatusLabel = computed(() => {
  const status = server.value?.status || "unknown";
  const key = `admin.statuses.server.${status}`;
  return te(key) ? t(key) : status.replace(/_/g, " ");
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
      toast.error(t("admin.serverDetail.loadFailed"));
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
      <p class="text-sm text-muted-foreground">
        {{ t("admin.serverDetail.notFound") }}
      </p>
      <Button variant="outline" size="sm" @click="navigateTo('/admin/servers')">
        {{ t("admin.serverDetail.backToServers") }}
      </Button>
    </div>

    <div v-else-if="server" class="flex flex-col gap-8 lg:flex-row">
      <!-- Left rail: identity + specs -->
      <aside
        class="shrink-0 space-y-5 lg:sticky lg:top-4 lg:w-72 lg:self-start lg:border-r lg:pr-8"
      >
        <div class="space-y-3">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-xl bg-muted"
          >
            <Icon :name="providerIcon" class="h-7 w-7 text-foreground" />
          </div>
          <div class="space-y-1.5">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ server.name }}
            </h1>
            <div class="flex flex-wrap items-center gap-2">
              <Badge :variant="statusVariant" class="capitalize">
                {{ serverStatusLabel }}
              </Badge>
              <span
                class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="server.connected ? 'bg-emerald-500' : 'bg-red-500'"
                />
                {{
                  server.connected
                    ? t("admin.serverDetail.connected")
                    : t("admin.serverDetail.disconnected")
                }}
              </span>
            </div>
            <p class="text-sm capitalize text-muted-foreground">
              {{ server.provider.replace("_", " ") }}
              <template v-if="server.type">
                · {{ getServerTypeLabel(server.type, server.type) }}
              </template>
            </p>
          </div>
        </div>

        <dl class="space-y-2.5 border-t pt-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.vcpu") }}
            </dt>
            <dd class="font-medium">
              {{ server.cpu_cores ? formatNumber(server.cpu_cores) : "—" }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.memory") }}
            </dt>
            <dd class="font-medium">{{ memory }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.storage") }}
            </dt>
            <dd class="font-medium">
              {{
                server.storage_in_gb
                  ? `${formatNumber(server.storage_in_gb)} GB`
                  : "—"
              }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.publicIpv4") }}
            </dt>
            <dd class="font-mono font-medium">
              {{ server.public_ipv4 || "—" }}
            </dd>
          </div>
        </dl>
      </aside>

      <!-- Right content -->
      <div class="min-w-0 flex-1 space-y-8">
        <!-- Owner (the key ask: who owns this) -->
        <section>
          <h2 class="mb-2 text-sm font-semibold">
            {{ t("admin.serverDetail.owner") }}
          </h2>
          <NuxtLink
            v-if="server.owner.user_id"
            :to="`/admin/users/${server.owner.user_id}`"
            class="group flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div class="flex items-center gap-3">
              <Avatar class="h-10 w-10">
                <AvatarFallback class="text-sm font-semibold">
                  {{ teamInitials }}
                </AvatarFallback>
              </Avatar>
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium">
                    {{ server.owner.team_name }}
                  </p>
                  <span
                    v-if="server.owner.personal_team"
                    class="text-xs text-muted-foreground"
                  >
                    · {{ t("admin.serverDetail.personal") }}
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
        </section>

        <section>
          <h2 class="mb-2 text-sm font-semibold">
            {{ t("admin.serverDetail.operatingSystem") }}
          </h2>
          <dl class="divide-y border-t text-sm">
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.selected") }}
              </dt>
              <dd class="font-medium">{{ server.operating_system || "—" }}</dd>
            </div>
            <div v-if="detectedOS" class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.detected") }}
              </dt>
              <dd class="font-medium">{{ detectedOS }}</dd>
            </div>
            <div
              v-if="server.detected_kernel"
              class="flex justify-between gap-4 py-2.5"
            >
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.kernel") }}
              </dt>
              <dd class="font-mono text-xs font-medium">
                {{ server.detected_kernel }}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 class="mb-2 text-sm font-semibold">
            {{ t("admin.serverDetail.statusLifecycle") }}
          </h2>
          <dl class="divide-y border-t text-sm">
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.monitoring") }}
              </dt>
              <dd class="font-medium">
                {{
                  server.monitoring_enabled
                    ? t("admin.common.on")
                    : t("admin.common.off")
                }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.autoUpdate") }}
              </dt>
              <dd class="font-medium">
                {{
                  server.auto_update
                    ? t("admin.common.on")
                    : t("admin.common.off")
                }}
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.provisioned") }}
              </dt>
              <dd class="font-medium">
                <SharedDateTooltip
                  v-if="server.provisioned_at"
                  :date="server.provisioned_at"
                />
                <span v-else>—</span>
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.lastConnectivity") }}
              </dt>
              <dd class="font-medium">
                <SharedDateTooltip
                  v-if="server.last_connectivity_check"
                  :date="server.last_connectivity_check"
                />
                <span v-else>—</span>
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.created") }}
              </dt>
              <dd class="font-medium">
                <SharedDateTooltip
                  v-if="server.created_at"
                  :date="server.created_at"
                />
                <span v-else>—</span>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

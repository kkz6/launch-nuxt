<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import type { AdminServerDetail } from "~/types";
import { adminService } from "~/services/adminService";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import AdminPageHeader from "~/components/admin/PageHeader.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const route = useRoute();
const serverId = route.params.id as string;
const { locale, t, te } = useI18n();
const { getServerTypeLabel } = useStableMetadataLabels();
const { user: currentUser } = useAuth();
const isSuperAdmin = computed(
  () => currentUser.value?.staff_role === "super_admin",
);

const server = ref<AdminServerDetail | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const deleteLoading = ref(false);
const deleteError = ref("");
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const deletionImpact = computed(() =>
  t(
    server.value?.provider === "custom_server"
      ? "admin.serverDetail.deleteCustomImpact"
      : "admin.serverDetail.deleteCloudImpact",
  ),
);
const deletionBlockedReason = computed(() => {
  const value = server.value;
  if (!value) return "";
  if (["starting", "provisioning", "deleting"].includes(value.status)) {
    return t("admin.serverDetail.deleteBusy");
  }
  if (value.sites_count > 0) {
    return t("admin.serverDetail.deleteSites", { count: value.sites_count });
  }
  if (value.projects_count > 0) {
    return t("admin.serverDetail.deleteProjects", {
      count: value.projects_count,
    });
  }
  return "";
});

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

async function deleteServer(): Promise<void> {
  if (
    !isSuperAdmin.value ||
    !server.value ||
    deletionBlockedReason.value ||
    deleteLoading.value ||
    !confirmationDialog.value
  )
    return;

  deleteError.value = "";
  const result = await confirmationDialog.value.show({
    title: t("admin.serverDetail.deleteTitle"),
    description: t("admin.serverDetail.deleteDescription", {
      name: server.value.name,
    }),
    warning: deletionImpact.value,
    confirmText: t("admin.serverDetail.deleteTitle"),
    cancelText: t("admin.common.cancel"),
    destructive: true,
    helpText: t("admin.serverDetail.deleteHelp"),
    inputVerificationText: server.value.name,
  });
  if (!result.ok || deleteLoading.value) return;

  deleteLoading.value = true;
  try {
    const res = await adminService.deleteServer(serverId, server.value.name);
    toast.success(
      t(
        res.data.status === "deleted"
          ? "admin.serverDetail.deleted"
          : "admin.serverDetail.deleteRequested",
      ),
    );
    await navigateTo("/admin/servers");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    deleteError.value =
      err.data?.message || t("admin.serverDetail.deleteFailed");
  } finally {
    deleteLoading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-7">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <AdminPageHeader
      :title="server?.name || t('admin.common.server')"
      :description="t('adminResources.serverDetail.description')"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="navigateTo('/admin/servers')"
        >
          <Icon name="lucide:arrow-left" class="mr-2 h-4 w-4" />
          {{ t("admin.serverDetail.backToServers") }}
        </Button>
      </template>
    </AdminPageHeader>
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center gap-4 border-y py-16"
    >
      <Icon name="lucide:server-off" class="h-10 w-10 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        {{ t("admin.serverDetail.notFound") }}
      </p>
      <Button variant="outline" size="sm" @click="navigateTo('/admin/servers')">
        {{ t("admin.serverDetail.backToServers") }}
      </Button>
    </div>

    <div v-else-if="server" class="space-y-6">
      <!-- Compact identity and configuration strip -->
      <section class="min-w-0 border-y border-border/70 py-5">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary"
            >
              <Icon :name="providerIcon" class="h-5 w-5" />
            </div>
            <div class="space-y-1">
              <h2 class="text-sm font-semibold">
                {{ t("adminResources.serverDetail.configuration") }}
              </h2>
              <p class="text-sm capitalize text-muted-foreground">
                {{ server.provider.replace("_", " ") }}
                <template v-if="server.type">
                  · {{ getServerTypeLabel(server.type, server.type) }}
                </template>
              </p>
            </div>
          </div>
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
        </div>

        <dl
          class="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4"
        >
          <div class="space-y-1">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.vcpu") }}
            </dt>
            <dd class="font-medium">
              {{ server.cpu_cores ? formatNumber(server.cpu_cores) : "—" }}
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.memory") }}
            </dt>
            <dd class="font-medium">{{ memory }}</dd>
          </div>
          <div class="space-y-1">
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
          <div class="space-y-1">
            <dt class="text-muted-foreground">
              {{ t("admin.serverDetail.publicIpv4") }}
            </dt>
            <dd class="break-all font-mono text-sm font-medium">
              {{ server.public_ipv4 || "—" }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- Ownership and system metadata -->
      <div class="grid min-w-0 items-start gap-x-12 gap-y-8 lg:grid-cols-2">
        <!-- Owner -->
        <section class="min-w-0">
          <h2 class="mb-4 text-sm font-semibold">
            {{ t("admin.serverDetail.owner") }}
          </h2>
          <NuxtLink
            v-if="server.owner.user_id"
            :to="`/admin/users/${server.owner.user_id}`"
            class="group -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div class="flex min-w-0 items-center gap-3">
              <Avatar class="h-9 w-9 shrink-0">
                <AvatarFallback
                  class="bg-primary/5 text-xs font-semibold text-primary"
                >
                  {{ teamInitials }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
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
                <p class="break-words text-xs text-muted-foreground">
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

        <section class="min-w-0">
          <h2 class="mb-4 text-sm font-semibold">
            {{ t("admin.serverDetail.operatingSystem") }}
          </h2>
          <dl class="divide-y divide-border/60 text-sm">
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
              <dd class="break-words text-right font-medium">
                {{ detectedOS }}
              </dd>
            </div>
            <div
              v-if="server.detected_kernel"
              class="flex justify-between gap-4 py-2.5"
            >
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.kernel") }}
              </dt>
              <dd class="break-all text-right font-mono text-xs font-medium">
                {{ server.detected_kernel }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="min-w-0">
          <h2 class="mb-4 text-sm font-semibold">
            {{ t("admin.serverDetail.statusLifecycle") }}
          </h2>
          <dl class="divide-y divide-border/60 text-sm">
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

        <section
          v-if="isSuperAdmin"
          aria-labelledby="server-delete-heading"
          class="min-w-0 space-y-3 border-t border-border/70 pt-5"
        >
          <h2
            id="server-delete-heading"
            class="text-sm font-semibold text-destructive"
          >
            {{ t("admin.serverDetail.deleteTitle") }}
          </h2>
          <p class="text-sm text-muted-foreground">{{ deletionImpact }}</p>
          <p class="text-sm text-muted-foreground">
            {{ t("admin.serverDetail.deleteRequirements") }}
          </p>
          <p v-if="deletionBlockedReason" class="text-sm text-muted-foreground">
            {{ deletionBlockedReason }}
          </p>
          <p v-if="deleteError" role="alert" class="text-sm text-destructive">
            {{ deleteError }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive"
            :disabled="deleteLoading || !!deletionBlockedReason"
            @click="deleteServer"
          >
            <Icon
              v-if="deleteLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              server.status === "deleting"
                ? t("admin.serverDetail.deleting")
                : t("admin.serverDetail.deleteTitle")
            }}
          </Button>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from "vue";
import { toast } from "vue-sonner";
import { useAdminLiveUpdates } from "~/composables/useAdminLiveUpdates";
import type { AdminServerDetail } from "~/types";
import { adminService } from "~/services/adminService";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import AdminPageHeader from "~/components/admin/PageHeader.vue";

const props = defineProps<{ serverId: string }>();
const emit = defineEmits<{
  loaded: [server: AdminServerDetail];
  deleted: [];
}>();
const serverId = props.serverId;
const { locale, t, te } = useI18n();
const { getServerTypeLabel } = useStableMetadataLabels();
const { user: currentUser } = useAuth();
const isSuperAdmin = computed(
  () => currentUser.value?.staff_role === "super_admin",
);

const server = ref<AdminServerDetail | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const loadError = ref(false);
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

const detectedOS = computed(() => {
  const s = server.value;
  if (!s) return "";
  return [s.detected_os_id, s.detected_os_version, s.detected_arch]
    .filter(Boolean)
    .join(" · ");
});

let loadVersion = 0;
let disposed = false;
onScopeDispose(() => {
  disposed = true;
  loadVersion++;
});

async function load(): Promise<void> {
  const version = ++loadVersion;
  isLoading.value = !server.value;
  try {
    const res = await adminService.showServer(serverId);
    if (disposed || version !== loadVersion) return;
    notFound.value = false;
    loadError.value = false;
    server.value = res.data;
    emit("loaded", res.data);
  } catch (error: unknown) {
    if (disposed || version !== loadVersion) return;
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      notFound.value = true;
    } else {
      loadError.value = true;
      toast.error(t("admin.serverDetail.loadFailed"));
    }
  } finally {
    if (version === loadVersion) isLoading.value = false;
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
    emit("deleted");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    deleteError.value =
      err.data?.message || t("admin.serverDetail.deleteFailed");
    if (!disposed) await load();
  } finally {
    deleteLoading.value = false;
  }
}

useAdminLiveUpdates(load, {
  resources: ["server", "site", "docker", "team", "user"],
  serverId,
  paused: deleteLoading,
  onChange(change) {
    if (change.resource === "server" && change.action === "deletion_failed") {
      deleteError.value = t("admin.serverDetail.deleteFailed");
      toast.error(deleteError.value);
    }
  },
});

onMounted(load);
</script>

<template>
  <div class="min-w-0 space-y-5">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <AdminPageHeader :title="server?.name || t('admin.common.server')">
      <template v-if="server" #title-leading>
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"
        >
          <Icon :name="providerIcon" class="h-4 w-4 text-muted-foreground" />
        </div>
      </template>
      <template v-if="$slots.actions" #actions
        ><slot name="actions"
      /></template>
    </AdminPageHeader>
    <div
      v-if="isLoading"
      class="flex justify-center py-12"
      role="status"
      :aria-label="t('server.common.loading')"
    >
      <Icon
        name="lucide:loader-2"
        class="h-5 w-5 animate-spin text-muted-foreground"
      />
    </div>
    <p v-else-if="notFound" class="py-8 text-sm text-muted-foreground">
      {{ t("admin.serverDetail.notFound") }}
    </p>
    <div
      v-if="loadError && !isLoading && !notFound"
      role="alert"
      class="flex items-center justify-between gap-3 text-sm text-destructive"
    >
      <p>{{ t("admin.serverDetail.loadFailed") }}</p>
      <Button variant="outline" size="sm" @click="load">{{
        t("admin.userDetail.retry")
      }}</Button>
    </div>
    <div v-if="server && !isLoading && !notFound" class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm capitalize text-muted-foreground">
          {{ server.provider.replace(/_/g, " ") }}
          <template v-if="server.type">
            · {{ getServerTypeLabel(server.type, server.type) }}</template
          >
        </p>
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
      <Separator />
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
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

      <Separator />
      <div class="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <section
          aria-labelledby="server-configuration-heading"
          class="min-w-0 space-y-2"
        >
          <h2 id="server-configuration-heading" class="text-sm font-semibold">
            {{ t("adminResources.serverDetail.configuration") }}
          </h2>
          <dl class="divide-y divide-border/60 text-sm">
            <div class="flex justify-between gap-4 py-2.5">
              <dt class="text-muted-foreground">
                {{ t("admin.serverDetail.operatingSystem") }}
              </dt>
              <dd class="text-right font-medium capitalize">
                {{ server.operating_system?.replace(/_/g, " ") || "—" }}
              </dd>
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
          </dl>
        </section>
        <section
          aria-labelledby="server-activity-heading"
          class="min-w-0 space-y-2"
        >
          <h2 id="server-activity-heading" class="text-sm font-semibold">
            {{ t("admin.serverDetail.statusLifecycle") }}
          </h2>
          <dl class="divide-y divide-border/60 text-sm">
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
      <Separator />
      <section aria-labelledby="server-owner-heading" class="space-y-3">
        <h2 id="server-owner-heading" class="text-sm font-semibold">
          {{ t("admin.serverDetail.owner") }}
        </h2>
        <NuxtLink
          v-if="server.owner.user_id"
          :to="`/admin/users/${server.owner.user_id}`"
          class="group flex items-center justify-between gap-4 rounded-md py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div class="min-w-0 space-y-1">
            <p class="font-medium">
              {{ server.owner.team_name
              }}<span
                v-if="server.owner.personal_team"
                class="ml-2 text-xs font-normal text-muted-foreground"
                >{{ t("admin.serverDetail.personal") }}</span
              >
            </p>
            <p class="break-words text-xs text-muted-foreground">
              {{ server.owner.user_name }} · {{ server.owner.user_email }}
            </p>
          </div>
          <Icon
            name="lucide:chevron-right"
            class="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground"
          />
        </NuxtLink>
      </section>
      <Separator v-if="isSuperAdmin" />
      <section
        v-if="isSuperAdmin"
        aria-labelledby="server-delete-heading"
        class="min-w-0 space-y-3"
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
</template>

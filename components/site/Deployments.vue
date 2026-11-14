<script setup lang="ts">
import { toast } from "vue-sonner";
import { onBeforeUnmount, watch } from "vue";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Site, Deployment, SiteReleaseInventory } from "~/types";

interface Props {
  serverId: string;
  siteId: string;
  site: Site;
}

const props = defineProps<Props>();
const { t } = useI18n();
const { canEdit, canManageTeam } = useCan();
const emit = defineEmits<{
  "update:site": [site: Site];
}>();

// Get current team for WebSocket channel
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

// Lifecycle events patch statuses immediately. Fetch the full record when a
// deployment starts and finishes because broadcasts omit commit data and task_id.
const TERMINAL_DEPLOYMENT_EVENTS = new Set([
  "deployment.finished",
  "deployment.failed",
  "deployment.timeout",
  "deployment.rollback.completed",
  "deployment.rollback.failed",
]);
const notifiedRollbackWarnings = new Set<string>();
const deployments = ref<Deployment[]>([]);
const isLoading = ref(true);
const releaseInventory = ref<SiteReleaseInventory | null>(null);
const refreshingRuntime = ref(false);
const rollingBackId = ref<string | null>(null);
const contextKey = computed(
  () => `${teamId.value}/${props.serverId}/${props.siteId}`,
);
let liveUpdateVersion = 0;
let latestFetchId = 0;
let latestInventoryFetchId = 0;
let disposed = false;
let inventoryRetryTimeout: ReturnType<typeof setTimeout> | null = null;

const invalidateInventory = () => {
  latestInventoryFetchId++;
  releaseInventory.value = null;
  if (inventoryRetryTimeout) clearTimeout(inventoryRetryTimeout);
  inventoryRetryTimeout = null;
};

// Coalesce lifecycle refreshes without delaying them on every progress tick.
let deployFetchTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleRefetch = () => {
  if (deployFetchTimeout) return;
  deployFetchTimeout = setTimeout(() => {
    deployFetchTimeout = null;
    void refreshState();
  }, 300);
};

// Synthesise a placeholder deployment from a WebSocket event payload.
// Used when a `deployment.started` arrives for a deploy we didn't trigger
// from this tab — we want the row to appear immediately rather than wait
// for a full-record refresh.
const synthesizePending = (
  deploymentId: string,
  status: string,
): Deployment => ({
  id: deploymentId,
  site_id: props.siteId,
  status,
  user_id: null,
  task_id: "",
  git_hash: "",
  vcs_data: {} as Deployment["vcs_data"],
  commit_data: {} as Deployment["commit_data"],
  user_notified_at: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user: null,
});

useDeploymentEvents(
  teamId,
  (data, event) => {
    if (data.site_id !== props.siteId) return;
    if (event.startsWith("deployment.runtime.")) {
      refreshingRuntime.value = event === "deployment.runtime.started";
      if (event === "deployment.runtime.completed") {
        if (data.post_actions_pending === true) {
          toast.warning(t("site.deployments.runtimeWorkerRestartPending"));
        } else {
          toast.success(t("site.deployments.runtimeRefreshed"));
        }
      } else if (event === "deployment.runtime.failed") {
        toast.error(t("site.deployments.runtimeRefreshFailed"));
      }
      invalidateInventory();
      scheduleRefetch();
      return;
    }
    if (typeof data.deployment_id !== "string") return;

    if (
      event === "deployment.rollback.completed" &&
      data.post_actions_pending === true &&
      !notifiedRollbackWarnings.has(data.deployment_id)
    ) {
      notifiedRollbackWarnings.add(data.deployment_id);
      toast.warning(t("site.deployments.rollbackPostActionsPending"));
    }

    const isTerminal = TERMINAL_DEPLOYMENT_EVENTS.has(event);
    const isStarting =
      event === "deployment.started" || event === "deployment.rollback.started";
    if (isTerminal || isStarting) {
      liveUpdateVersion++;
      invalidateInventory();
    }

    // Apply the status to the matching row (or prepend a synthesized one).
    // This keeps the list visually in sync with `deployment.started` and
    // every `deployment.progress` tick without a refetch per event.
    const status =
      typeof data.status === "string"
        ? data.status
        : isStarting
          ? "installing"
          : undefined;
    if (status) {
      const idx = deployments.value.findIndex(
        (d) => d.id === data.deployment_id,
      );
      if (idx >= 0) {
        if (deployments.value[idx].status !== status) liveUpdateVersion++;
        deployments.value[idx].status = status;
      } else if (isStarting) {
        deployments.value.unshift(
          synthesizePending(data.deployment_id, status),
        );
      }
    }

    // Deployments from other tabs/webhooks have no local Deploy response. Fetch
    // their metadata at the start, rather than waiting for the deploy to finish.
    const deployment = deployments.value.find(
      (d) => d.id === data.deployment_id,
    );
    if (
      isTerminal ||
      event === "deployment.started" ||
      event === "deployment.rollback.started" ||
      !deployment ||
      !deployment.task_id
    ) {
      scheduleRefetch();
    }
  },
  {
    onReconnect: () => {
      // The terminal event may have been missed. Do not claim completion.
      refreshingRuntime.value = false;
      invalidateInventory();
      scheduleRefetch();
    },
  },
);

// The parent consumes the navbar's Deploy response for the overview. Use that
// same record here so commit details appear as soon as Deploy returns.
watch(
  () => props.site.latest_deployment,
  (deployment) => {
    if (!deployment || deployment.site_id !== props.siteId) return;
    liveUpdateVersion++;
    if (props.site.zero_downtime_deployment) {
      invalidateInventory();
      scheduleRefetch();
    }
    const index = deployments.value.findIndex((d) => d.id === deployment.id);
    if (index >= 0) {
      const existing = deployments.value[index];
      deployments.value[index] = {
        ...existing,
        ...deployment,
        // Status-only placeholders must not erase metadata already fetched.
        commit_data: { ...existing.commit_data, ...deployment.commit_data },
        task_id: deployment.task_id || existing.task_id,
      };
    } else {
      deployments.value.unshift({ ...deployment });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  disposed = true;
  if (deployFetchTimeout) clearTimeout(deployFetchTimeout);
  if (inventoryRetryTimeout) clearTimeout(inventoryRetryTimeout);
});
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  installing: "bg-blue-500 animate-pulse",
  running: "bg-blue-500 animate-pulse",
  finished: "bg-green-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t("site.status.pending"),
  installing: t("site.status.deploying"),
  running: t("site.status.running"),
  finished: t("site.status.finished"),
  completed: t("site.status.completed"),
  failed: t("site.status.failed"),
}));

const inProgressStatuses = new Set(["pending", "installing", "running"]);
const isInProgress = (status: string) => inProgressStatuses.has(status);

const hasActiveDeployment = computed(() => {
  return deployments.value.some((d) => isInProgress(d.status));
});

// Only the server's current symlink and retained directories establish which
// release is live and safe to select. Successful history is not proof of either.
const liveDeploymentId = computed(() => {
  if (releaseInventory.value?.status !== "available") return;
  const active = releaseInventory.value.releases.find(
    (release) => release.active,
  );
  return deployments.value.find((deployment) =>
    active?.deployment_ids.includes(deployment.id),
  )?.id;
});

const canRollback = (deployment: Deployment) =>
  canEdit.value &&
  props.site.zero_downtime_deployment &&
  releaseInventory.value?.status === "available" &&
  releaseInventory.value.releases.some(
    (release) =>
      release.rollback_available &&
      !release.active &&
      release.deployment_id === deployment.id,
  );

const canStartRollback = (deployment: Deployment) =>
  canRollback(deployment) &&
  !hasActiveDeployment.value &&
  !rollingBackId.value &&
  !refreshingRuntime.value;

const releaseUnavailable = (deployment: Deployment) =>
  props.site.zero_downtime_deployment &&
  releaseInventory.value?.status === "available" &&
  deployment.status === "finished" &&
  !releaseInventory.value.releases.some((release) =>
    release.deployment_ids.includes(deployment.id),
  );

const inventoryMessage = computed(() => {
  if (
    !props.site.zero_downtime_deployment ||
    releaseInventory.value?.status === "available"
  )
    return "";
  if (!releaseInventory.value) return t("site.deployments.checkingReleases");
  if (releaseInventory.value.status === "busy")
    return t("site.deployments.releasesBusy");
  if (releaseInventory.value.status === "unsupported")
    return t("site.deployments.releasesUnsupported");
  return t("site.deployments.releasesUnavailable");
});

const fetchReleaseInventory = async () => {
  invalidateInventory();
  if (!props.site.zero_downtime_deployment || disposed) return;
  const fetchId = latestInventoryFetchId;
  const context = contextKey.value;
  try {
    const response = await $api<{ data: SiteReleaseInventory }>(
      `/servers/${props.serverId}/sites/${props.siteId}/releases`,
    );
    if (
      disposed ||
      fetchId !== latestInventoryFetchId ||
      context !== contextKey.value
    )
      return;
    releaseInventory.value = response.data;
  } catch {
    if (
      disposed ||
      fetchId !== latestInventoryFetchId ||
      context !== contextKey.value
    )
      return;
    releaseInventory.value = {
      status: "unavailable",
      active_release: null,
      releases: [],
      checked_at: "",
    };
  }
  if (
    releaseInventory.value?.status === "unavailable" ||
    releaseInventory.value?.status === "busy"
  ) {
    inventoryRetryTimeout = setTimeout(
      () => {
        inventoryRetryTimeout = null;
        void fetchReleaseInventory();
      },
      releaseInventory.value.status === "busy" ? 3000 : 30000,
    );
  }
};

const canRefreshRuntime = computed(
  () =>
    canEdit.value &&
    props.site.zero_downtime_deployment &&
    Boolean(props.site.php_version),
);

const handleRefreshRuntime = async () => {
  if (
    !canRefreshRuntime.value ||
    refreshingRuntime.value ||
    hasActiveDeployment.value ||
    releaseInventory.value?.status === "busy" ||
    rollingBackId.value
  )
    return;
  const context = contextKey.value;
  refreshingRuntime.value = true;
  try {
    await $api(
      `/servers/${props.serverId}/sites/${props.siteId}/runtime/refresh`,
      { method: "POST" },
    );
    // A queue receipt does not establish that PHP has reloaded. Socket events
    // report the outcome; reconnect reconciles an interrupted connection.
    if (!disposed && context === contextKey.value) {
      invalidateInventory();
      scheduleRefetch();
    }
  } catch (error) {
    if (disposed || context !== contextKey.value) return;
    refreshingRuntime.value = false;
    const err = error as { data?: { message?: string } };
    toast.error(
      err.data?.message || t("site.deployments.runtimeRefreshFailed"),
    );
  }
};

const fetchDeployments = async () => {
  const fetchId = ++latestFetchId;
  const requestVersion = liveUpdateVersion;
  const context = contextKey.value;
  try {
    const data = await $api<{ data: Deployment[] }>(
      `/servers/${props.serverId}/sites/${props.siteId}/deployments`,
    );
    if (disposed || fetchId !== latestFetchId || context !== contextKey.value)
      return;
    // A list request started before Deploy returned must not erase its new row.
    if (requestVersion !== liveUpdateVersion) {
      scheduleRefetch();
      return;
    }
    deployments.value = data.data;
  } catch {
    if (disposed || fetchId !== latestFetchId || context !== contextKey.value)
      return;
    toast.error(t("site.deployments.loadFailed"));
  } finally {
    if (!disposed && fetchId === latestFetchId) isLoading.value = false;
  }
};

const refreshState = async () => {
  await Promise.allSettled([fetchDeployments(), fetchReleaseInventory()]);
};

watch(contextKey, () => {
  liveUpdateVersion++;
  latestFetchId++;
  deployments.value = [];
  isLoading.value = true;
  rollingBackId.value = null;
  refreshingRuntime.value = false;
  notifiedRollbackWarnings.clear();
  invalidateInventory();
  scheduleRefetch();
});
watch(
  () => props.site.zero_downtime_deployment,
  () => {
    void fetchReleaseInventory();
  },
);

const handleRollback = async (deployment: Deployment) => {
  if (!canStartRollback(deployment) || !confirmationDialog.value) return;
  const context = contextKey.value;

  const result = await confirmationDialog.value.show({
    title: t("site.deployments.rollbackTitle"),
    description: t("site.deployments.rollbackDescription"),
    confirmText: t("site.deployments.confirmRollback"),
    cancelText: t("site.common.cancel"),
  });

  if (
    !result.ok ||
    context !== contextKey.value ||
    !canStartRollback(deployment)
  )
    return;
  await fetchReleaseInventory();
  if (disposed || context !== contextKey.value || !canStartRollback(deployment))
    return;

  rollingBackId.value = deployment.id;
  try {
    await $api(
      `/servers/${props.serverId}/sites/${props.siteId}/rollback/${deployment.id}`,
      {
        method: "POST",
      },
    );
    if (disposed || context !== contextKey.value) return;
    toast.success(t("site.deployments.rollbackStarted"));
    await refreshState();
  } catch (error) {
    if (disposed || context !== contextKey.value) return;
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("site.deployments.rollbackFailed"));
  } finally {
    if (context === contextKey.value) rollingBackId.value = null;
  }
};

const getCommitHeading = (message: string | undefined): string => {
  if (!message) return "";
  return message.split("\n")[0];
};

const appUrl = useRequestURL();
const deployWebhookUrl = computed(
  () => `${appUrl.origin}/deploy/${props.siteId}/${props.site.deploy_token}`,
);

const isRegenerating = ref(false);

const handleRegenerateToken = async () => {
  if (!canManageTeam.value || !confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.deployments.regenerateTitle"),
    description: t("site.deployments.regenerateDescription"),
    confirmText: t("site.deployments.regenerate"),
    cancelText: t("site.common.cancel"),
  });

  if (!result.ok || !canManageTeam.value) return;

  isRegenerating.value = true;
  try {
    const data = await $api<{ data: Site }>(
      `/servers/${props.serverId}/sites/${props.siteId}/deploy-token/regenerate`,
      {
        method: "POST",
      },
    );
    emit("update:site", data.data);
    toast.success(t("site.deployments.tokenRegenerated"));
  } catch {
    toast.error(t("site.deployments.tokenRegenerateFailed"));
  } finally {
    isRegenerating.value = false;
  }
};

const copyToClipboard = (text: string) => {
  if (typeof window !== "undefined") {
    window.navigator.clipboard.writeText(text);
    toast.success(t("site.common.copied"));
  }
};

onMounted(refreshState);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("site.deployments.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("site.deployments.description") }}
        </p>
      </div>
      <Button
        v-if="canRefreshRuntime"
        variant="outline"
        size="sm"
        :title="t('site.deployments.runtimeRefreshDescription')"
        :disabled="
          refreshingRuntime ||
          hasActiveDeployment ||
          releaseInventory?.status === 'busy' ||
          !!rollingBackId
        "
        @click="handleRefreshRuntime"
      >
        <Icon
          :name="refreshingRuntime ? 'lucide:loader-2' : 'lucide:rotate-cw'"
          :class="['mr-1 block size-4', { 'animate-spin': refreshingRuntime }]"
        />
        {{
          t(
            refreshingRuntime
              ? "site.deployments.runtimeRefreshing"
              : "site.deployments.runtimeRefresh",
          )
        }}
      </Button>
    </div>

    <p
      v-if="inventoryMessage"
      role="status"
      class="mb-4 text-sm text-muted-foreground"
    >
      {{ inventoryMessage }}
    </p>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <div
        v-if="canEdit && site.deploy_token"
        class="mb-4 rounded-lg border bg-card p-4"
      >
        <p class="mb-2 text-sm text-muted-foreground">
          {{ t("site.deployments.webhookDescription") }}
        </p>
        <div class="flex flex-row flex-wrap items-center gap-2">
          <code
            class="flex-1 break-all rounded bg-muted px-2 py-1 text-sm text-muted-foreground"
          >
            {{ deployWebhookUrl }}
          </code>
          <Button
            variant="ghost"
            size="sm"
            :title="t('site.common.copy')"
            @click="copyToClipboard(deployWebhookUrl)"
          >
            <Icon name="lucide:copy" class="block size-4" />
          </Button>
          <Button
            v-if="canManageTeam"
            variant="ghost"
            size="sm"
            :title="t('site.deployments.regenerate')"
            :disabled="isRegenerating"
            @click="handleRegenerateToken"
          >
            <Icon
              v-if="isRegenerating"
              name="lucide:loader-2"
              class="block size-4 animate-spin"
            />
            <Icon v-else name="lucide:refresh-cw" class="block size-4" />
          </Button>
        </div>
      </div>

      <div
        v-if="deployments.length === 0"
        class="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card py-12"
      >
        <Icon name="lucide:rocket" class="h-8 w-8 text-muted-foreground" />
        <span class="text-base text-muted-foreground">{{
          t("site.deployments.empty")
        }}</span>
      </div>

      <div v-else class="rounded-lg border bg-card">
        <div
          v-for="deployment in deployments"
          :key="deployment.id"
          class="flex items-center justify-between gap-2 border-b p-4 last:border-b-0"
        >
          <div class="flex flex-col">
            <span
              class="flex items-center gap-2 font-medium capitalize text-foreground"
            >
              <Badge
                v-if="deployment.commit_data?.rollback_to"
                variant="outline"
                class="gap-1 border-amber-600 text-amber-600"
              >
                <Icon name="lucide:history" class="block size-3" />
                {{ t("site.deployments.rollback") }}
              </Badge>
              <Badge
                v-if="deployment.id === liveDeploymentId"
                variant="outline"
              >
                {{ t("site.deployments.liveRelease") }}
              </Badge>
              {{ statusLabels[deployment.status] || deployment.status }}
              <span
                :class="[
                  'size-2.5 rounded-full',
                  statusColors[deployment.status] || 'bg-gray-500',
                ]"
              />
            </span>
            <div class="flex flex-wrap gap-2">
              <span class="text-sm text-muted-foreground">
                {{
                  deployment.user?.name ||
                  deployment.commit_data?.name ||
                  t("site.common.unknown")
                }}
              </span>
              <span
                v-if="deployment.commit_data?.sha"
                class="font-mono text-sm text-muted-foreground"
              >
                {{ deployment.commit_data.sha.substring(0, 6) }}
              </span>
            </div>

            <span
              v-if="deployment.commit_data?.rollback_to"
              class="text-sm text-muted-foreground"
            >
              {{ t("site.deployments.rolledBack") }}
            </span>
            <span
              v-else-if="deployment.commit_data?.message"
              class="text-sm text-muted-foreground"
            >
              {{ getCommitHeading(deployment.commit_data.message) }}
            </span>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="text-sm capitalize text-muted-foreground">
              <SharedDateTooltip :date="deployment.created_at" />
            </div>
            <div class="flex flex-row items-center gap-2">
              <Button
                v-if="canRollback(deployment)"
                variant="outline"
                size="sm"
                :disabled="
                  hasActiveDeployment || !!rollingBackId || refreshingRuntime
                "
                @click="handleRollback(deployment)"
              >
                <Icon
                  v-if="rollingBackId === deployment.id"
                  name="lucide:loader-2"
                  class="mr-1 block size-4 animate-spin"
                />
                <Icon
                  v-else
                  name="lucide:rotate-ccw"
                  class="mr-1 block size-4"
                />
                {{ t("site.deployments.rollback") }}
              </Button>
              <span
                v-if="releaseUnavailable(deployment)"
                class="text-sm text-muted-foreground"
              >
                {{ t("site.deployments.releaseUnavailable") }}
              </span>
              <SiteDeploymentLogs
                v-if="deployment.task_id"
                :server-id="serverId"
                :task-id="deployment.task_id"
                :commit-message="
                  getCommitHeading(deployment.commit_data?.message)
                "
                :commit-sha="deployment.commit_data?.sha?.substring(0, 6)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

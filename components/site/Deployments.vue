<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Site, Deployment } from "~/types";

interface Props {
  serverId: string;
  siteId: string;
  site: Site;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  "update:site": [site: Site];
}>();

// Get current team for WebSocket channel
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

// Terminal events trigger a single full refetch (commit data, finished_at,
// task_id all need the canonical server response). Non-terminal events
// (deployment.started, deployment.progress, rollback.started) are applied
// in-place from the event payload — saves a network round-trip per event.
const TERMINAL_DEPLOYMENT_EVENTS = new Set([
  "deployment.finished",
  "deployment.failed",
  "deployment.timeout",
  "deployment.rollback.completed",
  "deployment.rollback.failed",
]);

// Debounced refetch for terminal events.
let deployFetchTimeout: ReturnType<typeof setTimeout> | null = null;
const scheduleRefetch = () => {
  if (deployFetchTimeout) clearTimeout(deployFetchTimeout);
  deployFetchTimeout = setTimeout(() => fetchDeployments(), 300);
};

// Synthesise a placeholder deployment from a WebSocket event payload.
// Used when a `deployment.started` arrives for a deploy we didn't trigger
// from this tab — we want the row to appear immediately rather than wait
// for the terminal-event refetch.
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

useDeploymentEvents(teamId, (data, event) => {
  if (data.site_id !== props.siteId) return;
  if (typeof data.deployment_id !== "string") return;

  const isTerminal = TERMINAL_DEPLOYMENT_EVENTS.has(event);

  // Apply the status to the matching row (or prepend a synthesized one).
  // This keeps the list visually in sync with `deployment.started` and
  // every `deployment.progress` tick without a refetch per event.
  if (typeof data.status === "string") {
    const idx = deployments.value.findIndex((d) => d.id === data.deployment_id);
    if (idx >= 0) {
      deployments.value[idx].status = data.status;
    } else if (event === "deployment.started") {
      deployments.value.unshift(
        synthesizePending(data.deployment_id, data.status),
      );
    }
  }

  // Terminal events: refetch to pick up commit_data, task_id, finished_at —
  // fields the broadcast doesn't carry.
  if (isTerminal) {
    scheduleRefetch();
  }
});

const deployments = ref<Deployment[]>([]);
const isLoading = ref(true);
const rollingBackId = ref<string | null>(null);
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

const secondFinishedIndex = computed(() => {
  let count = 0;
  return deployments.value.findIndex((d) => {
    if (d.status === "finished") count++;
    return count === 2;
  });
});

const canRollback = (deployment: Deployment, index: number) => {
  if (!props.site.zero_downtime_deployment) return false;
  if (deployment.status !== "finished") return false;
  // Only allow rollback to the second most recent finished deployment (the last successful one before current)
  if (index !== secondFinishedIndex.value) return false;
  return true;
};

const fetchDeployments = async () => {
  try {
    const data = await $api<{ data: Deployment[] }>(
      `/servers/${props.serverId}/sites/${props.siteId}/deployments`,
    );
    deployments.value = data.data;
  } catch {
    toast.error(t("site.deployments.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const handleRollback = async (deployment: Deployment) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.deployments.rollbackTitle"),
    description: t("site.deployments.rollbackDescription"),
    confirmText: t("site.deployments.confirmRollback"),
    cancelText: t("site.common.cancel"),
  });

  if (!result.ok) return;

  rollingBackId.value = deployment.id;
  try {
    await $api(
      `/servers/${props.serverId}/sites/${props.siteId}/deployments/${deployment.id}/rollback`,
      {
        method: "POST",
      },
    );
    toast.success(t("site.deployments.rollbackStarted"));
    await fetchDeployments();
  } catch {
    toast.error(t("site.deployments.rollbackFailed"));
  } finally {
    rollingBackId.value = null;
  }
};

const getCommitHeading = (message: string | undefined): string => {
  if (!message) return "";
  return message.split("\n")[0];
};

const deployWebhookUrl = computed(() => {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBase.replace(/\/api\/?$/, "");
  return `${baseUrl}/deploy/${props.siteId}/${props.site.deploy_token}`;
});

const isRegenerating = ref(false);

const handleRegenerateToken = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.deployments.regenerateTitle"),
    description: t("site.deployments.regenerateDescription"),
    confirmText: t("site.deployments.regenerate"),
    cancelText: t("site.common.cancel"),
  });

  if (!result.ok) return;

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

onMounted(fetchDeployments);
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
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <div class="mb-4 rounded-lg border bg-card p-4">
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
          v-for="(deployment, index) in deployments"
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
                v-if="canRollback(deployment, index)"
                variant="outline"
                size="sm"
                :disabled="
                  hasActiveDeployment || rollingBackId === deployment.id
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

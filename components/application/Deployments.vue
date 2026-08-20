<script setup lang="ts">
import { reactive, toRefs } from "vue";
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Checkbox } from "~/components/ui/checkbox";
import {
  dockerService,
  type DockerApplication,
  type DockerDeployment,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const { t } = useI18n();

interface DeploymentState {
  deployments: DockerDeployment[];
  isLoading: boolean;
  isDeploying: boolean;
  logSheetOpen: boolean;
  logSheetTaskId: string;
  logSheetTitle: string;
  logSheetSubtitle: string;
  stepsSheetOpen: boolean;
  stepsDeploymentId: string;
  liveNow: number;
  deleteTarget: DockerDeployment | null;
  deleteOpen: boolean;
  alsoDeleteGitHub: boolean;
  deleting: boolean;
}

const state = reactive({
  deployments: [],
  isLoading: true,
  isDeploying: false,
  logSheetOpen: false,
  logSheetTaskId: "",
  logSheetTitle: "",
  logSheetSubtitle: "",
  stepsSheetOpen: false,
  stepsDeploymentId: "",
  liveNow: Date.now(),
  deleteTarget: null,
  deleteOpen: false,
  alsoDeleteGitHub: false,
  deleting: false,
}) as DeploymentState;

const {
  deployments,
  isLoading,
  isDeploying,
  logSheetOpen,
  logSheetTaskId,
  logSheetTitle,
  logSheetSubtitle,
  stepsSheetOpen,
  stepsDeploymentId,
  liveNow,
  deleteTarget,
  deleteOpen,
  alsoDeleteGitHub,
  deleting,
} = toRefs(state);

const openSteps = (d: DockerDeployment) => {
  stepsDeploymentId.value = d.id;
  stepsSheetOpen.value = true;
};

const fetchDeployments = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.applications.listDeployments(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    deployments.value = res.data;
  } catch {
    if (!silent) toast.error(t("workload.deployments.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const triggerDeploy = async () => {
  isDeploying.value = true;
  try {
    const res = await dockerService.applications.deploy(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    deployments.value = [res.data, ...deployments.value];
    toast.success(t("workload.deployments.started"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.deployments.startFailed"));
  } finally {
    isDeploying.value = false;
  }
};

const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
let refetchTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleRefetch = () => {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => fetchDeployments(true), 300);
};

const isMine = (data: {
  application_id?: string;
  deployment_id?: string;
  target_id?: string;
  target_type?: string;
}): boolean => {
  if (data.application_id === props.application.id) return true;
  if (
    data.target_type === "application" &&
    data.target_id === props.application.id
  ) {
    return true;
  }
  return false;
};

useDockerApplicationEvents(teamId, (data) => {
  if (!isMine(data)) return;
  scheduleRefetch();
});
useDeploymentEvents(teamId, (data) => {
  if (!isMine(data)) return;
  scheduleRefetch();
});

const statusDotClass = (status: string): string => {
  switch (status) {
    case "pending":
      return "bg-yellow-500";
    case "building":
    case "deploying":
      return "bg-blue-500 animate-pulse";
    case "success":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "cancelled":
      return "bg-zinc-500";
    default:
      return "bg-gray-500";
  }
};

const statusLabel = (status: string): string => {
  switch (status) {
    case "pending":
      return t("workload.status.pending");
    case "building":
      return t("workload.status.building");
    case "deploying":
      return t("workload.status.deploying");
    case "success":
      return t("workload.status.finished");
    case "failed":
      return t("workload.status.failed");
    case "cancelled":
      return t("workload.status.cancelled");
    default:
      return status;
  }
};

const isInProgress = (status: string): boolean =>
  status === "pending" || status === "building" || status === "deploying";

const hasActiveDeployment = computed(() =>
  deployments.value.some((d) => isInProgress(d.status)),
);

let elapsedTimer: ReturnType<typeof setInterval> | null = null;

const startElapsedTimer = () => {
  if (elapsedTimer || typeof window === "undefined") return;
  liveNow.value = Date.now();
  elapsedTimer = setInterval(() => {
    liveNow.value = Date.now();
  }, 1000);
};

const stopElapsedTimer = () => {
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
};

watch(
  hasActiveDeployment,
  (active) => {
    if (active) startElapsedTimer();
    else stopElapsedTimer();
  },
  { immediate: true },
);

onUnmounted(stopElapsedTimer);

const elapsedLabel = (deployment: DockerDeployment): string => {
  if (!isInProgress(deployment.status)) return "";
  const start = new Date(
    deployment.created_at || deployment.started_at || "",
  ).getTime();
  if (Number.isNaN(start)) return "";
  const secs = Math.max(0, Math.floor((liveNow.value - start) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0)
    return t("workload.duration.hms", { hours: h, minutes: m, seconds: s });
  if (m > 0) return t("workload.duration.ms", { minutes: m, seconds: s });
  return t("workload.duration.seconds", { seconds: s });
};

const canRemoveFromGitHub = computed(
  () =>
    deleteTarget.value?.trigger_source === "github_actions" &&
    !!deleteTarget.value?.gha_run_url,
);

const openDelete = (d: DockerDeployment) => {
  deleteTarget.value = d;
  alsoDeleteGitHub.value = false;
  deleteOpen.value = true;
};

const confirmDelete = async () => {
  const d = deleteTarget.value;
  if (!d) return;
  deleting.value = true;
  try {
    await dockerService.applications.deleteDeployment(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      d.id,
      canRemoveFromGitHub.value && alsoDeleteGitHub.value,
    );
    deployments.value = deployments.value.filter((x) => x.id !== d.id);
    toast.success(t("workload.deployments.deleted"));
    deleteOpen.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.deployments.deleteFailed"));
  } finally {
    deleting.value = false;
  }
};

const commitHeading = (msg?: string | null): string => {
  if (!msg) return "";
  return msg.split("\n")[0];
};

const shortSha = (sha?: string | null): string => {
  if (!sha) return "";
  return sha.substring(0, 7);
};

type FailureSummary = { step: string; detail: string };
const failureSummary = (raw?: string | null): FailureSummary | null => {
  if (!raw) return null;
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  let step = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^::LAUNCH::deploy_step::([a-z0-9_]+)/);
    if (m) {
      step = m[1].replace(/_/g, " ");
      break;
    }
  }

  const noise =
    /^(WARNING!|Configure a credential|See https?:\/\/|Login Succeeded|\+ |::LAUNCH::|\s*$)/i;
  let detail = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!noise.test(lines[i])) {
      detail = lines[i];
      break;
    }
  }
  if (!detail) detail = lines[lines.length - 1];

  if (!step && !detail) return null;
  return { step, detail };
};

const openLogs = (d: DockerDeployment) => {
  if (!d.task_id) return;
  logSheetTaskId.value = d.task_id;
  const parts: string[] = [];
  if (d.commit_sha) parts.push(shortSha(d.commit_sha));
  const subject = commitHeading(d.commit_msg);
  if (subject) parts.push(subject);
  if (parts.length === 0 && d.image_ref) parts.push(d.image_ref);
  logSheetSubtitle.value = parts.join(" · ");
  logSheetTitle.value = t("workload.deployments.logTitleWithStatus", {
    status: statusLabel(d.status),
  });
  logSheetOpen.value = true;
};

onMounted(fetchDeployments);
</script>

<template>
  <div>
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">
          {{ t("workload.deployments.title") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("workload.deployments.applicationDescription") }}
        </p>
      </div>
      <Button :disabled="isDeploying" @click="triggerDeploy">
        <Icon
          v-if="isDeploying"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:rocket" class="mr-2 h-4 w-4" />
        {{ t("workload.deployments.deployNow") }}
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <div
        v-if="deployments.length === 0"
        class="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card py-12"
      >
        <Icon name="lucide:rocket" class="h-8 w-8 text-muted-foreground" />
        <span class="text-base text-muted-foreground">
          {{ t("workload.deployments.emptyTitle") }}
        </span>
        <p class="max-w-md px-4 text-center text-xs text-muted-foreground">
          {{ t("workload.deployments.applicationEmptyDescription") }}
        </p>
      </div>

      <div v-else class="rounded-lg border bg-card">
        <div
          v-for="d in deployments"
          :key="d.id"
          class="flex items-center justify-between gap-2 border-b p-4 last:border-b-0"
        >
          <div class="flex min-w-0 flex-col">
            <span
              class="flex items-center gap-2 font-medium capitalize text-foreground"
            >
              <Badge
                v-if="d.action && d.action !== 'deploy'"
                variant="outline"
                class="gap-1 capitalize"
              >
                <Icon name="lucide:rotate-cw" class="block size-3" />
                {{ t(`workload.deployments.action.${d.action}`, d.action) }}
              </Badge>
              {{ statusLabel(d.status) }}
              <span
                :class="['size-2.5 rounded-full', statusDotClass(d.status)]"
              />
            </span>

            <div class="mt-0.5 flex flex-wrap items-center gap-2">
              <span
                v-if="d.image_ref"
                class="font-mono text-sm text-muted-foreground"
              >
                {{ d.image_ref }}
              </span>
              <span
                v-if="d.commit_sha"
                class="font-mono text-sm text-muted-foreground"
              >
                {{ shortSha(d.commit_sha) }}
              </span>
              <a
                v-if="d.trigger_source === 'github_actions' && d.gha_run_url"
                :href="d.gha_run_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                @click.stop
              >
                <Icon name="simple-icons:github" class="h-3 w-3" />
                {{ t("workload.deployments.viaGitHubActions") }}
                <Icon name="lucide:external-link" class="h-3 w-3" />
              </a>
            </div>

            <span
              v-if="d.commit_msg"
              class="truncate text-sm text-muted-foreground"
            >
              {{ commitHeading(d.commit_msg) }}
            </span>
            <span
              v-else-if="d.status === 'failed' && failureSummary(d.error)?.step"
              class="mt-0.5 inline-flex w-fit items-center rounded-full bg-red-500/10 px-1.5 py-0.5 font-mono text-xs text-red-600 dark:text-red-400"
              :title="d.error || ''"
            >
              {{
                t("workload.deployments.failedAt", {
                  step: failureSummary(d.error)?.step,
                })
              }}
            </span>
          </div>

          <div class="flex shrink-0 flex-col items-end gap-2">
            <div class="text-sm text-muted-foreground">
              <span
                v-if="isInProgress(d.status)"
                class="font-medium tabular-nums text-blue-600 dark:text-blue-400"
              >
                {{ elapsedLabel(d) }}
              </span>
              <SharedDateTooltip
                v-else
                :date="d.created_at || d.started_at || new Date().toISOString()"
              />
            </div>
            <div class="flex flex-row items-center gap-2">
              <Button
                v-if="d.trigger_source === 'github_actions'"
                variant="outline"
                size="sm"
                @click="openSteps(d)"
              >
                <Icon
                  name="simple-icons:githubactions"
                  class="mr-2 block size-4"
                />
                {{ t("workload.deployments.steps") }}
              </Button>
              <Button
                v-if="d.task_id"
                variant="outline"
                size="sm"
                @click="openLogs(d)"
              >
                <Icon name="lucide:scroll-text" class="mr-2 block size-4" />
                {{ t("workload.deployments.viewLogs") }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:text-destructive"
                :disabled="isInProgress(d.status)"
                :title="
                  isInProgress(d.status)
                    ? t('workload.deployments.cannotDeleteRunning')
                    : t('workload.deployments.deleteTitle')
                "
                @click="openDelete(d)"
              >
                <Icon name="lucide:trash-2" class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <Dialog v-model:open="deleteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t("workload.deployments.deleteTitle") }}</DialogTitle>
          <DialogDescription>
            {{ t("workload.deployments.deleteDescription") }}
          </DialogDescription>
        </DialogHeader>
        <label
          v-if="canRemoveFromGitHub"
          class="flex items-start gap-3 rounded-md border p-3 text-sm"
        >
          <Checkbox v-model="alsoDeleteGitHub" class="mt-0.5" />
          <span>
            <span class="font-medium">
              {{ t("workload.deployments.removeFromGitHub") }}
            </span>
            <span class="block text-muted-foreground">
              {{ t("workload.deployments.removeFromGitHubDescription") }}
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="deleting"
            @click="deleteOpen = false"
          >
            {{ t("workload.actions.cancel") }}
          </Button>
          <Button
            variant="destructive"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <Icon
              v-if="deleting"
              name="lucide:loader-2"
              class="mr-2 size-4 animate-spin"
            />
            {{ t("workload.actions.delete") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Sheet v-model:open="logSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-4xl flex flex-col overflow-hidden outline-none"
      >
        <SheetHeader class="shrink-0">
          <SheetTitle>
            {{ logSheetTitle || t("workload.deployments.logsTitle") }}
          </SheetTitle>
          <SheetDescription v-if="logSheetSubtitle">
            {{ logSheetSubtitle }}
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-1 flex-col min-h-0">
          <ServerLogViewer
            v-if="logSheetOpen && logSheetTaskId"
            :server-id="application.server_id"
            entity="task"
            :entity-id="logSheetTaskId"
            :no-timestamp="true"
            hide-options
            container-class-name="h-full rounded-b-lg"
          />
        </div>
      </SheetContent>
    </Sheet>

    <Sheet v-model:open="stepsSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-xl flex flex-col overflow-hidden outline-none"
      >
        <SheetHeader class="shrink-0">
          <SheetTitle>{{ t("workload.deployments.stepsTitle") }}</SheetTitle>
          <SheetDescription>
            {{ t("workload.deployments.stepsDescription") }}
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-1 flex-col min-h-0 overflow-y-auto pr-1">
          <SharedGhaStepsTimeline
            v-if="stepsSheetOpen && stepsDeploymentId"
            kind="application"
            :server-id="application.server_id"
            :project-id="application.project_id"
            :workload-id="application.id"
            :deployment-id="stepsDeploymentId"
            :team-id="teamId"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

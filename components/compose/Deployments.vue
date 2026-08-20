<script setup lang="ts">
import { reactive, toRefs } from "vue";
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
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
  type DockerCompose,
  type DockerDeployment,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();

interface ComposeDeploymentsState {
  deployments: DockerDeployment[];
  isLoading: boolean;
  isDeploying: boolean;
  isReloading: boolean;
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

const state = reactive<ComposeDeploymentsState>({
  deployments: [],
  isLoading: true,
  isDeploying: false,
  isReloading: false,
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
});

const {
  deployments,
  isLoading,
  isDeploying,
  isReloading,
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
    const res = await dockerService.composes.listDeployments(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    deployments.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load deployments");
  } finally {
    isLoading.value = false;
  }
};

const triggerDeploy = async () => {
  isDeploying.value = true;
  try {
    const res = await dockerService.composes.deploy(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    deployments.value = [res.data, ...deployments.value];
    toast.success("Deployment started");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to start deployment");
  } finally {
    isDeploying.value = false;
  }
};

const triggerReload = async () => {
  isReloading.value = true;
  try {
    await dockerService.composes.reload(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    toast.success("Reload started — applying current env");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to reload");
  } finally {
    isReloading.value = false;
  }
};

const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const channel = computed(() => `team.${teamId.value}`);
let refetchTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleRefetch = () => {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => fetchDeployments(true), 300);
};
useChannelEvents(
  channel,
  [
    "docker.compose.deploying",
    "docker.compose.deployed",
    "docker.compose.failed",
    "docker.compose.updated",
  ],
  (data) => {
    if (data.compose_id !== props.compose.id) return;
    scheduleRefetch();
  },
);

useDeploymentEvents(teamId, (data) => {
  if (
    data.compose_id !== props.compose.id &&
    !(data.target_type === "compose" && data.target_id === props.compose.id)
  ) {
    return;
  }
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
      return "Pending";
    case "building":
      return "Building";
    case "deploying":
      return "Deploying";
    case "success":
      return "Finished";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
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
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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
    await dockerService.composes.deleteDeployment(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      d.id,
      canRemoveFromGitHub.value && alsoDeleteGitHub.value,
    );
    deployments.value = deployments.value.filter((x) => x.id !== d.id);
    toast.success("Deployment deleted");
    deleteOpen.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete deployment");
  } finally {
    deleting.value = false;
  }
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
  logSheetTitle.value = `Deployment · ${statusLabel(d.status)}`;
  logSheetSubtitle.value = d.started_at
    ? new Date(d.started_at).toLocaleString()
    : "";
  logSheetOpen.value = true;
};

onMounted(fetchDeployments);
</script>

<template>
  <div>
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Deployments</h3>
        <p class="text-sm text-muted-foreground">
          <code class="font-mono text-xs">docker compose up -d</code>
          history. Most recent first.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          :disabled="isReloading || isDeploying"
          title="Re-up the stack with the current env, no rebuild — applies saved env changes fast"
          @click="triggerReload"
        >
          <Icon
            :name="isReloading ? 'lucide:loader-2' : 'lucide:refresh-cw'"
            :class="['mr-2 h-4 w-4', isReloading && 'animate-spin']"
          />
          Reload
        </Button>
        <Button :disabled="isDeploying || isReloading" @click="triggerDeploy">
          <Icon
            v-if="isDeploying"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:rocket" class="mr-2 h-4 w-4" />
          Deploy now
        </Button>
      </div>
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
        <span class="text-base text-muted-foreground">No deployments yet</span>
        <p class="max-w-md px-4 text-center text-xs text-muted-foreground">
          Click <span class="font-medium">Deploy now</span> to bring the stack
          up on the server.
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
              {{ statusLabel(d.status) }}
              <span
                :class="['size-2.5 rounded-full', statusDotClass(d.status)]"
              />
            </span>

            <span
              v-if="d.status === 'failed' && failureSummary(d.error)?.step"
              class="mt-0.5 inline-flex w-fit items-center rounded-full bg-red-500/10 px-1.5 py-0.5 font-mono text-xs text-red-600 dark:text-red-400"
              :title="d.error || ''"
            >
              Failed at {{ failureSummary(d.error)?.step }}
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
                Steps
              </Button>
              <Button
                v-if="d.task_id"
                variant="outline"
                size="sm"
                @click="openLogs(d)"
              >
                <Icon name="lucide:scroll-text" class="mr-2 block size-4" />
                View Logs
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:text-destructive"
                :disabled="isInProgress(d.status)"
                :title="
                  isInProgress(d.status)
                    ? 'Cannot delete a running deployment'
                    : 'Delete deployment'
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
          <DialogTitle>Delete deployment</DialogTitle>
          <DialogDescription>
            This removes the deployment record and its logs from Launch. This
            can't be undone.
          </DialogDescription>
        </DialogHeader>
        <label
          v-if="canRemoveFromGitHub"
          class="flex items-start gap-3 rounded-md border p-3 text-sm"
        >
          <Checkbox v-model="alsoDeleteGitHub" class="mt-0.5" />
          <span>
            <span class="font-medium">Also remove from GitHub Actions</span>
            <span class="block text-muted-foreground">
              Deletes the linked workflow run from the repo's Actions tab.
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="deleting"
            @click="deleteOpen = false"
          >
            Cancel
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
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Sheet v-model:open="logSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-4xl flex flex-col overflow-hidden outline-none"
      >
        <SheetHeader class="shrink-0">
          <SheetTitle>{{ logSheetTitle || "Deployment logs" }}</SheetTitle>
          <SheetDescription v-if="logSheetSubtitle">
            {{ logSheetSubtitle }}
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-1 flex-col min-h-0">
          <ServerLogViewer
            v-if="logSheetOpen && logSheetTaskId"
            :server-id="compose.server_id"
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
          <SheetTitle>Deployment steps</SheetTitle>
          <SheetDescription>
            Live GitHub Actions workflow progress for this deployment.
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-1 flex-col min-h-0 overflow-y-auto pr-1">
          <SharedGhaStepsTimeline
            v-if="stepsSheetOpen && stepsDeploymentId"
            kind="compose"
            :server-id="compose.server_id"
            :project-id="compose.project_id"
            :workload-id="compose.id"
            :deployment-id="stepsDeploymentId"
            :team-id="teamId"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

<script setup lang="ts">
import {
  dockerService,
  type DockerDeploymentGhaSteps,
  type DockerDeploymentGhaJob,
  type DockerDeploymentGhaStep,
} from "~/services/dockerService";
import { useDeploymentGhaStepsEvents } from "~/composables/useChannelEvents";

/**
 * Live GitHub Actions step timeline for a single deployment (#87).
 *
 * Fetches the current run's jobs/steps once on mount, then keeps them
 * live by subscribing to the deployment.gha_steps WS event (filtered by
 * deployment_id). Works for both application and compose deployments —
 * compose simply renders one job per built service.
 */
interface Props {
  kind: "application" | "compose";
  serverId: string;
  projectId: string;
  workloadId: string;
  deploymentId: string;
  teamId: string;
}
const props = defineProps<Props>();

const data = ref<DockerDeploymentGhaSteps | null>(null);
const loading = ref(true);
const errored = ref(false);

const fetchSteps = async () => {
  try {
    const svc =
      props.kind === "application"
        ? dockerService.applications.getDeploymentGhaSteps
        : dockerService.composes.getDeploymentGhaSteps;
    const res = await svc(
      props.serverId,
      props.projectId,
      props.workloadId,
      props.deploymentId,
    );
    data.value = res.data;
    errored.value = false;
  } catch {
    errored.value = true;
  } finally {
    loading.value = false;
  }
};

onMounted(fetchSteps);

// Live updates: the poller broadcasts the full job/step snapshot each
// tick, so we replace wholesale when the event is for this deployment.
useDeploymentGhaStepsEvents(
  computed(() => props.teamId),
  (payload) => {
    const p = payload as unknown as DockerDeploymentGhaSteps;
    if (p?.deployment_id !== props.deploymentId) return;
    data.value = p;
    loading.value = false;
  },
);

const jobs = computed<DockerDeploymentGhaJob[]>(() => data.value?.jobs ?? []);
const runUrl = computed(() => data.value?.run_url ?? "");
const runStatus = computed(() => data.value?.run_status ?? "pending");

const isWaiting = computed(
  () => !loading.value && !errored.value && jobs.value.length === 0,
);

// Per-step visual mapping.
type StepVisual = { icon: string; spin: boolean; cls: string };
const stepVisual = (step: DockerDeploymentGhaStep): StepVisual => {
  if (step.status === "in_progress") {
    return {
      icon: "lucide:loader-circle",
      spin: true,
      cls: "text-blue-500",
    };
  }
  if (step.status === "completed") {
    switch (step.conclusion) {
      case "success":
        return { icon: "lucide:check", spin: false, cls: "text-green-500" };
      case "failure":
      case "cancelled":
      case "timed_out":
        return { icon: "lucide:x", spin: false, cls: "text-red-500" };
      case "skipped":
        return { icon: "lucide:minus", spin: false, cls: "text-muted-foreground" };
      default:
        return { icon: "lucide:check", spin: false, cls: "text-green-500" };
    }
  }
  // queued / pending
  return { icon: "lucide:circle", spin: false, cls: "text-muted-foreground/50" };
};

const jobStatusLabel = (job: DockerDeploymentGhaJob): string => {
  if (job.status === "completed") return job.conclusion || "completed";
  return job.status;
};

const stepDurationLabel = (step: DockerDeploymentGhaStep): string => {
  if (!step.started_at || !step.completed_at) return "";
  const ms =
    new Date(step.completed_at).getTime() -
    new Date(step.started_at).getTime();
  if (ms < 0) return "";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header: overall run status + GitHub link -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm">
        <Icon name="simple-icons:githubactions" class="size-4" />
        <span class="font-medium">GitHub Actions</span>
        <span
          class="rounded-full px-2 py-0.5 text-xs capitalize"
          :class="{
            'bg-blue-500/10 text-blue-600 dark:text-blue-400':
              runStatus === 'in_progress',
            'bg-green-500/10 text-green-600 dark:text-green-400':
              runStatus === 'completed',
            'bg-muted text-muted-foreground':
              runStatus === 'queued' || runStatus === 'pending',
          }"
        >
          {{ runStatus.replace("_", " ") }}
        </span>
      </div>
      <a
        v-if="runUrl"
        :href="runUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        View run
        <Icon name="lucide:external-link" class="size-3" />
      </a>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center gap-2 py-6 text-sm text-muted-foreground"
    >
      <Icon name="lucide:loader-circle" class="size-4 animate-spin" />
      Loading steps…
    </div>

    <!-- Errored -->
    <div
      v-else-if="errored"
      class="flex items-center gap-2 py-6 text-sm text-muted-foreground"
    >
      <Icon name="lucide:triangle-alert" class="size-4" />
      Couldn't load the workflow steps.
      <button class="underline hover:text-foreground" @click="fetchSteps">
        Retry
      </button>
    </div>

    <!-- Waiting for the run to start -->
    <div
      v-else-if="isWaiting"
      class="flex items-center gap-2 py-6 text-sm text-muted-foreground"
    >
      <Icon name="lucide:loader-circle" class="size-4 animate-spin" />
      Waiting for the GitHub Actions run to start…
    </div>

    <!-- Jobs + steps -->
    <div v-else class="flex flex-col gap-5">
      <div v-for="(job, ji) in jobs" :key="ji" class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ job.name }}</span>
          <span class="text-xs capitalize text-muted-foreground">
            {{ jobStatusLabel(job) }}
          </span>
        </div>
        <ul class="flex flex-col">
          <li
            v-for="(step, si) in job.steps"
            :key="si"
            class="flex items-center gap-3 py-1"
          >
            <Icon
              :name="stepVisual(step).icon"
              class="size-4 shrink-0"
              :class="[
                stepVisual(step).cls,
                { 'animate-spin': stepVisual(step).spin },
              ]"
            />
            <span
              class="flex-1 truncate text-sm"
              :class="{
                'text-foreground': step.status === 'in_progress',
                'text-muted-foreground': step.status !== 'in_progress',
              }"
            >
              {{ step.name }}
            </span>
            <span
              v-if="stepDurationLabel(step)"
              class="shrink-0 font-mono text-xs text-muted-foreground"
            >
              {{ stepDurationLabel(step) }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

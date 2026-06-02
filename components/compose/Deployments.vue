<script setup lang="ts">
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
  dockerService,
  type DockerCompose,
  type DockerDeployment,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();

// Card-per-row list — same shape components/application/Deployments.vue
// uses. The compose-specific bits are: there's no commit_sha or
// image_ref to surface (compose stacks are multi-service, those are
// per-service), and the "verb" is always `docker compose up -d`
// rather than docker run. Everything else (status pill + dot, View
// Logs sheet, debounced refetch on WS event) is identical.

const deployments = ref<DockerDeployment[]>([]);
const isLoading = ref(true);
const isDeploying = ref(false);

const logSheetOpen = ref(false);
const logSheetTaskId = ref<string>("");
const logSheetTitle = ref<string>("");
const logSheetSubtitle = ref<string>("");

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
    // Prepend so the user sees the row immediately; the WS event will
    // overwrite it with the canonical server copy.
    deployments.value = [res.data, ...deployments.value];
    toast.success("Deployment started");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to start deployment");
  } finally {
    isDeploying.value = false;
  }
};

// Reload re-ups the stack WITHOUT a rebuild — reuses the on-host images
// and applies the current .env, so saved env changes take effect fast.
// Build-time changes still need Deploy. Reload is a lightweight,
// toast-only action: the backend records NO deployment row and streams
// NO build logs, so there's nothing to prepend to the history list —
// we just show a toast and let the WS status events drive the badge.
const isReloading = ref(false);
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

// WS sync — debounced terminal-refetch pattern application
// Deployments uses. Filter on compose_id so a sibling stack's
// lifecycle doesn't refresh ours.
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

// Row-level deployment lifecycle (same rationale as
// components/application/Deployments.vue): GHA-triggered deploys
// surface their progress on the per-deployment event stream
// (deployment.started / .finished / .failed), NOT on the
// docker.compose.* one. Subscribe to both so the row turns
// green / red without a manual refresh.
useDeploymentEvents(teamId, (data) => {
  if (
    data.compose_id !== props.compose.id &&
    !(data.target_type === "compose" && data.target_id === props.compose.id)
  ) {
    return;
  }
  scheduleRefetch();
});

// Status palette mirrors application Deployments.vue. The dot is what
// users actually scan for, so we pick saturated colors and reserve
// the animate-pulse for in-flight states.
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

// See components/application/Deployments.vue#failureSummary for the
// full rationale. Same helper, same `::LAUNCH::deploy_step::` marker
// parsing — keeps the two views consistent (a customer scanning an
// app row and a compose row gets the same shape of error chip).
type FailureSummary = { step: string; detail: string };
const failureSummary = (raw?: string | null): FailureSummary | null => {
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
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
  // No image_ref / commit_sha on compose deployments — subtitle is
  // the relative time string so the sheet header still names the
  // run.
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
          Click <span class="font-medium">Deploy now</span> to bring the
          stack up on the server.
        </p>
      </div>

      <!--
        Card-per-row list. Same shape application Deployments.vue
        uses — left side is status + secondary info, right side is
        timestamp + actions. divide-y inside a bordered card so
        adjacent rows share a hairline divider.
      -->
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

            <!--
              Just a small step pill on failure — same treatment as
              components/application/Deployments.vue. The full
              transcript is one click away in View Logs.
            -->
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
              <SharedDateTooltip
                :date="d.created_at || d.started_at || new Date().toISOString()"
              />
            </div>
            <div class="flex flex-row items-center gap-2">
              <Button
                v-if="d.task_id"
                variant="outline"
                size="sm"
                @click="openLogs(d)"
              >
                <Icon
                  name="lucide:scroll-text"
                  class="mr-2 block size-4"
                />
                View Logs
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!--
      Logs sheet — same slide-in surface application Deployments uses.
      Streams the live taskrunner output (or replays the file if the
      task already finished). Mounting only when open keeps the WS
      off until the user explicitly opens it.
    -->
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
  </div>
</template>

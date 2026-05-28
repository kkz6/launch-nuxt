<script setup lang="ts">
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
  dockerService,
  type DockerApplication,
  type DockerDeployment,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

// Same shape as components/site/Deployments.vue. Card-per-row layout
// instead of a table — status pill + dot on the left, relative date
// + View Logs / Deploy actions on the right. Live updates via
// useDockerApplicationEvents: terminal events trigger a debounced
// refetch (so commit / task_id / finished_at land), in-flight events
// patch the row in-place without a network round-trip.

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
    const res = await dockerService.applications.listDeployments(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
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
    const res = await dockerService.applications.deploy(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    // Prepend so the user sees the row immediately; the WS terminal
    // event will overwrite it with the canonical server copy.
    deployments.value = [res.data, ...deployments.value];
    toast.success("Deployment started");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to start deployment");
  } finally {
    isDeploying.value = false;
  }
};

// WS sync — same debounced terminal-refetch pattern site
// Deployments uses. Filter on application_id so a sibling app's
// deploy doesn't refresh ours.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
let refetchTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleRefetch = () => {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => fetchDeployments(true), 300);
};

// Two parallel event streams feed this view:
//
//   1) `docker.application.*` on the team channel — fired by the
//      service layer when the workload's overall lifecycle moves
//      (created / deploying / deployed / failed / gha_synced …).
//      These are the "an application thing happened" events.
//
//   2) `deployment.*` on the same team channel — fired by the
//      deploy_application job for the *row-level* deployment
//      lifecycle (started / progress / finished / failed / timeout).
//      Critically, the GHA-initiated webhook path enqueues a
//      deploy_application job whose terminal `.finished` / `.failed`
//      events ride this stream, NOT the docker.application stream.
//      Without this second subscription, GHA-triggered deployments
//      land silently and the user has to manually refresh to see the
//      row turn green / red.
const isMine = (
  data: { application_id?: string; deployment_id?: string; target_id?: string; target_type?: string },
): boolean => {
  if (data.application_id === props.application.id) return true;
  // deployment events carry target_type + target_id rather than a
  // typed application_id — match either shape.
  if (data.target_type === "application" && data.target_id === props.application.id) {
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

// Status palette — mirrors site Deployments.vue. The dot is what
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

// Single-line summary for the secondary row. Image source apps
// show the image ref; git source apps show the commit SHA + first
// line of the message. Each is optional — the function returns
// what's available.
const commitHeading = (msg?: string | null): string => {
  if (!msg) return "";
  return msg.split("\n")[0];
};

const shortSha = (sha?: string | null): string => {
  if (!sha) return "";
  return sha.substring(0, 7);
};

const openLogs = (d: DockerDeployment) => {
  if (!d.task_id) return;
  logSheetTaskId.value = d.task_id;
  // Build a useful subtitle from whatever metadata the row has.
  // Image-source apps get the image ref; git-source apps get
  // <sha> · <commit subject>.
  const parts: string[] = [];
  if (d.commit_sha) parts.push(shortSha(d.commit_sha));
  const subject = commitHeading(d.commit_msg);
  if (subject) parts.push(subject);
  if (parts.length === 0 && d.image_ref) parts.push(d.image_ref);
  logSheetSubtitle.value = parts.join(" · ");
  logSheetTitle.value = `Deployment · ${statusLabel(d.status)}`;
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
          Build + run history. Most recent first.
        </p>
      </div>
      <Button :disabled="isDeploying" @click="triggerDeploy">
        <Icon
          v-if="isDeploying"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:rocket" class="mr-2 h-4 w-4" />
        Deploy now
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
        <span class="text-base text-muted-foreground">No deployments yet</span>
        <p class="max-w-md px-4 text-center text-xs text-muted-foreground">
          Click <span class="font-medium">Deploy now</span> to pull the
          image and start the container on the server.
        </p>
      </div>

      <!--
        Card-per-row list. Same shape as site Deployments.vue — left
        side is status + secondary info, right side is timestamp +
        actions. divide-y inside a bordered card so adjacent rows
        share a hairline divider.
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
              <Badge
                v-if="d.action && d.action !== 'deploy'"
                variant="outline"
                class="gap-1 capitalize"
              >
                <Icon name="lucide:rotate-cw" class="block size-3" />
                {{ d.action }}
              </Badge>
              {{ statusLabel(d.status) }}
              <span
                :class="['size-2.5 rounded-full', statusDotClass(d.status)]"
              />
            </span>

            <div class="mt-0.5 flex flex-wrap items-center gap-2">
              <!-- Image source: just the image ref. Git source: the
                   commit SHA. Either / both may be present. -->
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
              <!--
                Slice G of the GHA-builds feature. Show a small badge
                when this deployment was initiated by a GitHub Actions
                workflow notify, linking to the run page on github.com.
                Manual + webhook auto-deploys carry no badge — they
                already telegraph their origin via task_id presence.
              -->
              <a
                v-if="d.trigger_source === 'github_actions' && d.gha_run_url"
                :href="d.gha_run_url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 rounded-md border border-input bg-background px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                @click.stop
              >
                <Icon name="simple-icons:github" class="h-3 w-3" />
                via GitHub Actions
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
              v-else-if="d.error && d.status === 'failed'"
              class="line-clamp-2 text-sm text-red-600 dark:text-red-400"
              :title="d.error"
            >
              {{ d.error }}
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
      Logs sheet — same slide-in surface site DeploymentLogs uses.
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
  </div>
</template>

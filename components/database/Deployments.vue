<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerDatabase,
  type DockerDatabaseLifecycleAction,
  type DockerDeployment,
} from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

// Lifecycle-history rows. Same polymorphic table the application +
// compose Deployments tabs read from — target_type=database. action
// carries the verb (create / start / restart / stop / rm); status
// transitions pending → deploying → success/failed.
const deployments = ref<DockerDeployment[]>([]);
const isLoading = ref(true);
const lifecycleInFlight = ref<DockerDatabaseLifecycleAction | null>(null);

const fetchDeployments = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.databases.listDeployments(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    deployments.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load deployment history");
  } finally {
    isLoading.value = false;
  }
};

const lifecycle = async (action: DockerDatabaseLifecycleAction) => {
  if (lifecycleInFlight.value) return;
  lifecycleInFlight.value = action;
  try {
    await dockerService.databases.lifecycle(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      action,
    );
    toast.success(`${cap(action)} queued`);
    // Refetch immediately so the pending row appears; the WS will
    // then flip its status as the worker runs.
    void fetchDeployments(true);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || `Failed to ${action}`);
  } finally {
    lifecycleInFlight.value = null;
  }
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const statusBadge = (status: string): string => {
  switch (status) {
    case "success":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "pending":
    case "building":
    case "deploying":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "cancelled":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const actionLabel = (a?: string | null): string => {
  if (!a) return "Deploy";
  return cap(a);
};

const actionIcon = (a?: string | null): string => {
  switch (a) {
    case "create":
      return "lucide:rocket";
    case "start":
      return "lucide:play";
    case "stop":
      return "lucide:square";
    case "restart":
      return "lucide:rotate-cw";
    case "rm":
      return "lucide:trash-2";
    default:
      return "lucide:terminal";
  }
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

const duration = (d: DockerDeployment): string => {
  if (!d.started_at) return "—";
  const start = new Date(d.started_at).getTime();
  const end = d.finished_at ? new Date(d.finished_at).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const expanded = ref<Set<string>>(new Set());
const toggleError = (id: string) => {
  if (expanded.value.has(id)) {
    expanded.value.delete(id);
  } else {
    expanded.value.add(id);
  }
  expanded.value = new Set(expanded.value);
};

// Live-stream the task's SSH output via the existing server-task logs
// websocket. Same pattern site deployments use (SiteDeploymentLogs.vue).
const logSheetOpen = ref(false);
const logTaskId = ref<string>("");
const logActionLabel = ref<string>("");
const openLogs = (d: DockerDeployment) => {
  if (!d.task_id) {
    toast.error("Logs aren't available for this row yet");
    return;
  }
  logTaskId.value = d.task_id;
  logActionLabel.value = actionLabel(d.action);
  logSheetOpen.value = true;
};

// Subscribe to lifecycle broadcasts so the table updates in real time
// without polling. Both the worker's docker.database.deployment.* events
// (the new ones) AND the legacy docker.database.{starting,running,
// failed,lifecycle_done} events trigger refetches — the row's task_id
// only appears once the worker has dispatched the SSH task, and we
// want the View Logs button to light up as soon as that happens.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const channel = computed(() => `team.${teamId.value}`);
useChannelEvents(
  channel,
  [
    "docker.database.deployment.started",
    "docker.database.deployment.running",
    "docker.database.deployment.succeeded",
    "docker.database.deployment.failed",
    "docker.database.starting",
    "docker.database.running",
    "docker.database.failed",
    "docker.database.lifecycle_done",
  ],
  (data) => {
    // Filter to this database — sibling databases on the same team
    // shouldn't trigger us.
    if (data.database_id && data.database_id !== props.database.id) return;
    if (data.id && data.id !== props.database.id && !data.database_id) {
      // Legacy events use "id" for the database id.
      return;
    }
    void fetchDeployments(true);
  },
);

onMounted(fetchDeployments);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Deployments</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Every lifecycle action (create, start, restart, stop) records
          a row here. Click <span class="font-medium">View logs</span>
          to see the SSH output for that run.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="database.status !== 'running'"
          variant="outline"
          :disabled="lifecycleInFlight !== null"
          @click="lifecycle('start')"
        >
          <Icon name="lucide:play" class="mr-2 h-4 w-4" />
          Start
        </Button>
        <Button
          v-if="database.status === 'running'"
          variant="outline"
          :disabled="lifecycleInFlight !== null"
          @click="lifecycle('stop')"
        >
          <Icon name="lucide:square" class="mr-2 h-4 w-4" />
          Stop
        </Button>
        <Button
          :disabled="lifecycleInFlight !== null"
          @click="lifecycle('restart')"
        >
          <Icon
            v-if="lifecycleInFlight === 'restart'"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:rotate-cw" class="mr-2 h-4 w-4" />
          Restart
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="deployments.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:history" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No deployment history yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Restart the database to capture a fresh entry — every action
        from here on records a row with full SSH logs.
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"
        >
          <tr>
            <th class="px-4 py-3">Action</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Started</th>
            <th class="px-4 py-3">Duration</th>
            <th class="px-4 py-3 text-right">Logs</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="d in deployments" :key="d.id">
            <tr class="border-t align-top">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <Icon
                    :name="actionIcon(d.action)"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <span class="font-medium">{{ actionLabel(d.action) }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                  :class="statusBadge(d.status)"
                >
                  {{ d.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ formatDate(d.started_at) }}
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ duration(d) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-if="d.task_id"
                    variant="ghost"
                    size="sm"
                    @click="openLogs(d)"
                  >
                    <Icon name="lucide:scroll-text" class="mr-1.5 h-4 w-4" />
                    View logs
                  </Button>
                  <Button
                    v-if="d.error"
                    variant="ghost"
                    size="sm"
                    @click="toggleError(d.id)"
                  >
                    <Icon
                      :name="
                        expanded.has(d.id)
                          ? 'lucide:chevron-up'
                          : 'lucide:chevron-down'
                      "
                      class="h-4 w-4"
                    />
                  </Button>
                </div>
              </td>
            </tr>
            <tr
              v-if="expanded.has(d.id) && d.error"
              class="border-t bg-muted/20"
            >
              <td colspan="5" class="px-4 py-3">
                <pre
                  class="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 font-mono text-xs"
                >{{ d.error }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!--
      Log sheet — same v-model:open + ServerLogViewer entity="task"
      shape SiteDeploymentLogs uses. We mount it conditionally so the
      WebSocket only opens when the user actually clicks a row.
    -->
    <Sheet v-model:open="logSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-4xl flex flex-col overflow-hidden outline-none"
      >
        <SheetHeader class="shrink-0">
          <SheetTitle>{{ logActionLabel }} logs</SheetTitle>
          <SheetDescription>
            Live SSH output from the worker. Container logs (post-start)
            are on the Logs tab.
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-col flex-1 min-h-0">
          <ServerLogViewer
            v-if="logSheetOpen && logTaskId"
            :server-id="props.database.server_id"
            entity="task"
            :entity-id="logTaskId"
            :no-timestamp="true"
            hide-options
            container-class-name="h-full rounded-b-lg"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

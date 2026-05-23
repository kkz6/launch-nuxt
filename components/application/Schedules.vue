<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  dockerService,
  type DockerApplication,
  type DockerSchedule,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

// Mirrors components/server/ShowSchedulers.vue (PHP-site cron jobs):
// SharedDataTable + Create/Edit dialog reused for both modes via a
// selectedScheduler ref. We don't have a "user" column (docker
// schedules run via `docker exec`, no per-user concept) so the
// columns reduce to Frequency / Command / Last run / Status, with
// View Logs + Edit + Delete actions. The `enabled` flag stays in the
// model (Edit dialog can flip it) but no inline toggle column — PHP-
// side ShowSchedulers.vue doesn't have one either, and the user
// flagged the divergence.
const schedules = ref<DockerSchedule[]>([]);
const isLoading = ref(true);

const selectedScheduleForEdit = ref<DockerSchedule | null>(null);
const isEditDialogOpen = ref(false);

const selectedScheduleForLogs = ref<DockerSchedule | null>(null);
const isLogDialogOpen = ref(false);

// Subscribe to docker.application.schedule.* events so the row's
// Last Run / Status / Last Task cells update live when a tick runs
// without polling. Same broadcast pattern the Deployments subtab
// uses; filtered to the current application_id so a sibling app's
// schedule doesn't refetch ours.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerApplicationEvents(teamId, (data) => {
  if (data.application_id !== props.application.id) return;
  fetchSchedules();
});

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

// Friendly labels for the common cron presets — same wording the
// PHP-site CreateScheduler dialog uses. Falls back to the raw
// expression for custom rows.
const frequencyLabels: Record<string, string> = {
  "* * * * *": "Every Minute",
  "*/5 * * * *": "Every 5 Minutes",
  "*/15 * * * *": "Every 15 Minutes",
  "*/30 * * * *": "Every 30 Minutes",
  "0 * * * *": "Hourly",
  "0 0 * * *": "Daily",
  "0 2 * * *": "Daily at 2 AM",
  "0 3 * * *": "Daily at 3 AM",
  "0 0 * * 0": "Weekly",
  "0 0 1 * *": "Monthly",
};

const formatFrequency = (s: DockerSchedule) => {
  if (s.cron && frequencyLabels[s.cron]) return frequencyLabels[s.cron];
  return s.cron || "—";
};

const fetchSchedules = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.listSchedules(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    schedules.value = res.data;
  } catch {
    toast.error("Failed to load schedulers");
  } finally {
    isLoading.value = false;
  }
};

const editSchedule = (s: DockerSchedule) => {
  selectedScheduleForEdit.value = s;
  isEditDialogOpen.value = true;
};

const viewLogs = (s: DockerSchedule) => {
  // Open the dialog unconditionally. When `last_task_id` is empty
  // (scheduler hasn't ticked yet) the dialog renders an empty state
  // instead of mounting ServerLogViewer. Keeping the button always
  // enabled avoids the "blurred / disabled" look the user flagged on
  // brand-new schedulers — same UX shape PHP-side ShowSchedulers
  // uses, where View Logs is always live.
  selectedScheduleForLogs.value = s;
  isLogDialogOpen.value = true;
};

// Pause/resume lives in the Edit dialog now — the PHP-side
// ShowSchedulers.vue doesn't carry an inline toggle column either, so
// we keep parity instead of mixing list patterns across the product.

const deleteSchedule = async (s: DockerSchedule) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Scheduler",
    description:
      "This action cannot be undone. This will permanently delete the scheduled task.",
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the command to confirm deletion:",
    inputVerificationText: s.command,
  });
  if (!result.ok) {
    toast.info("Cancelled");
    return;
  }
  try {
    await dockerService.applications.deleteSchedule(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      s.id,
    );
    schedules.value = schedules.value.filter((x) => x.id !== s.id);
    toast.success("Scheduler deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete scheduler");
  }
};

const handleScheduleUpdated = () => {
  isEditDialogOpen.value = false;
  selectedScheduleForEdit.value = null;
  fetchSchedules();
};

watch(isEditDialogOpen, (open) => {
  if (!open) selectedScheduleForEdit.value = null;
});

onMounted(fetchSchedules);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Edit dialog. Only mounts when a scheduler is selected so
         form state stays out of the DOM otherwise. Reuses the same
         CreateSchedule component the header + empty-state buttons
         render in create mode. -->
    <ApplicationCreateSchedule
      v-if="selectedScheduleForEdit"
      v-model:open="isEditDialogOpen"
      :application="application"
      :schedule="selectedScheduleForEdit"
      @updated="handleScheduleUpdated"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Schedulers</h3>
        <p class="text-sm text-muted-foreground">
          Cron-style commands that run inside the application's container.
        </p>
      </div>
      <ApplicationCreateSchedule
        v-if="schedules.length > 0"
        :application="application"
        @created="fetchSchedules"
      />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <SharedDataTable
        :data="schedules"
        :columns="[
          { key: 'frequency', label: 'Frequency', width: '25%' },
          { key: 'command', label: 'Command', width: '35%' },
          { key: 'last_run_at', label: 'Last run', width: '20%' },
          { key: 'last_status', label: 'Status', width: '20%' },
        ]"
        empty-title="No scheduled tasks found"
        empty-description="Add a recurring command to run inside the container"
        empty-icon="lucide:clock"
      >
        <template #empty>
          <ApplicationCreateSchedule
            :application="application"
            @created="fetchSchedules"
          />
        </template>

        <template #cell-frequency="{ row }">
          <span class="text-sm">{{ formatFrequency(row) }}</span>
          <p class="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {{ row.cron }}
          </p>
        </template>

        <template #cell-command="{ row }">
          <code class="rounded bg-muted px-2 py-1 font-mono text-xs">
            {{ row.command }}
          </code>
        </template>

        <template #cell-last_run_at="{ row }">
          <SharedDateTooltip v-if="row.last_run_at" :date="row.last_run_at" />
          <span v-else class="text-muted-foreground">—</span>
        </template>

        <template #cell-last_status="{ row }">
          <span
            v-if="row.last_status"
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="
              row.last_status === 'success'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : row.last_status === 'failed'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                  : 'bg-muted text-muted-foreground'
            "
          >
            {{ row.last_status }}
          </span>
          <span v-else class="text-muted-foreground">—</span>
        </template>

        <template #actions="{ item }">
          <Button
            variant="ghost"
            size="icon"
            title="View latest run logs"
            @click="viewLogs(item)"
          >
            <Icon name="lucide:scroll-text" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            @click="editSchedule(item)"
          >
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            class="hover:bg-destructive/90 hover:text-white"
            @click="deleteSchedule(item)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </template>
      </SharedDataTable>
    </template>

    <!--
      Log viewer dialog. The taskrunner persists each schedule run
      as a server-tasks row with a log file on the host; the API
      streams that file over the WS at entity="task" :entity-id=
      last_task_id. Same surface the Deployments subtab uses for
      deploy logs — Mounts only when open so we don't open a WS for
      every row in the table.
    -->
    <Dialog v-model:open="isLogDialogOpen">
      <DialogContent
        class="flex h-[85vh] flex-col overflow-hidden sm:max-w-7xl"
      >
        <DialogHeader class="shrink-0">
          <DialogTitle>Scheduler logs</DialogTitle>
          <DialogDescription class="font-mono text-xs">
            {{ selectedScheduleForLogs?.command }}
          </DialogDescription>
        </DialogHeader>
        <div class="mt-2 flex min-h-0 flex-1 flex-col">
          <ServerLogViewer
            v-if="isLogDialogOpen && selectedScheduleForLogs?.last_task_id"
            :server-id="application.server_id"
            entity="task"
            :entity-id="selectedScheduleForLogs.last_task_id"
            :no-timestamp="true"
            hide-options
            container-class-name="h-full rounded-md border"
          />
          <!--
            Empty state for schedulers that haven't ticked yet. We
            persist one log file per run (keyed by task_id), so until
            the asynq poller fires there's nothing to stream. The
            dialog stays open so the user can confirm the command and
            wait for the next tick.
          -->
          <div
            v-else
            class="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-card py-12"
          >
            <Icon
              name="lucide:clock"
              class="h-8 w-8 text-muted-foreground"
            />
            <span class="text-base text-muted-foreground">
              No runs yet
            </span>
            <p class="max-w-md px-4 text-center text-xs text-muted-foreground">
              Logs appear here after the first tick. The poller checks
              every minute and dispatches when the cron expression
              matches.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

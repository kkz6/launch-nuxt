<script setup lang="ts">
import { reactive, toRefs } from "vue";
import { toast } from "vue-sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  dockerService,
  type DockerDatabase,
  type DockerDatabaseBackup,
  type DockerDatabaseBackupRun,
} from "~/services/dockerService";
import type { StorageProviderRecord } from "~/types";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

interface BackupState {
  backup: DockerDatabaseBackup | null;
  runs: DockerDatabaseBackupRun[];
  providers: StorageProviderRecord[];
  loading: boolean;
  runningNow: boolean;
  deleting: boolean;
  dialogOpen: boolean;
  historySheetOpen: boolean;
  logSheetOpen: boolean;
  logSheetTaskId: string;
  logSheetRunId: string;
  logSheetError: string;
  logRefreshNonce: number;
  awaitingRunLogs: boolean;
  restoreDialogOpen: boolean;
  restoreRun: DockerDatabaseBackupRun | null;
  storageProviderId: number | null;
  databaseName: string;
  path: string;
  retention: number;
  cronSchedule: string;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  enabled: boolean;
  saving: boolean;
  liveStep: string;
  liveStepRunId: string;
}

type BufferedRunConsoleEvent = {
  taskId?: string;
  error?: string;
  step?: string;
  terminal?: "succeeded" | "failed";
};

const bufferedRunConsoleEvents = new Map<string, BufferedRunConsoleEvent>();
const terminalToastRunIds = new Set<string>();
const RUN_RECONCILE_INTERVAL_MS = 1000;
const RUN_RECONCILE_MAX_ATTEMPTS = 60;
let activeRunRequestToken = 0;
let pendingManualRunRequestToken: number | null = null;
let loadRequestToken = 0;
let componentUnmounted = false;
let logRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let runReconcileTimer: ReturnType<typeof setTimeout> | undefined;

const state = reactive({
  backup: null,
  runs: [],
  providers: [],
  loading: true,
  runningNow: false,
  deleting: false,
  dialogOpen: false,
  historySheetOpen: false,
  logSheetOpen: false,
  logSheetTaskId: "",
  logSheetRunId: "",
  logSheetError: "",
  logRefreshNonce: 0,
  awaitingRunLogs: false,
  restoreDialogOpen: false,
  restoreRun: null,
  storageProviderId: null,
  databaseName: "",
  path: "",
  retention: 10,
  cronSchedule: "0 3 * * *",
  notifyOnSuccess: false,
  notifyOnFailure: true,
  enabled: true,
  saving: false,
  liveStep: "",
  liveStepRunId: "",
}) as BackupState;

const {
  backup,
  runs,
  providers,
  loading,
  runningNow,
  deleting,
  dialogOpen,
  historySheetOpen,
  logSheetOpen,
  logSheetTaskId,
  logSheetRunId,
  logSheetError,
  logRefreshNonce,
  awaitingRunLogs,
  restoreDialogOpen,
  restoreRun,
  storageProviderId,
  databaseName,
  path,
  retention,
  cronSchedule,
  notifyOnSuccess,
  notifyOnFailure,
  enabled,
  saving,
  liveStep,
  liveStepRunId,
} = toRefs(state);

const cancelLogRefresh = () => {
  if (logRefreshTimer !== undefined) {
    clearTimeout(logRefreshTimer);
    logRefreshTimer = undefined;
  }
};

const cancelRunReconciliation = () => {
  if (runReconcileTimer !== undefined) {
    clearTimeout(runReconcileTimer);
    runReconcileTimer = undefined;
  }
};

const resetLiveStepOwnership = () => {
  liveStep.value = "";
  liveStepRunId.value = "";
};

const invalidateRunConsole = () => {
  activeRunRequestToken++;
  if (pendingManualRunRequestToken === null) {
    bufferedRunConsoleEvents.clear();
  }
  cancelLogRefresh();
  cancelRunReconciliation();
  return activeRunRequestToken;
};

const scheduleLogRefresh = (runId: string) => {
  cancelLogRefresh();
  const requestToken = activeRunRequestToken;
  logRefreshTimer = setTimeout(() => {
    logRefreshTimer = undefined;
    if (
      requestToken !== activeRunRequestToken ||
      !logSheetOpen.value ||
      logSheetRunId.value !== runId
    ) {
      return;
    }
    logRefreshNonce.value++;
  }, 800);
};

watch(logSheetOpen, (open) => {
  if (!open) {
    invalidateRunConsole();
    awaitingRunLogs.value = false;
    logSheetTaskId.value = "";
    logSheetRunId.value = "";
    logSheetError.value = "";
  }
});

onBeforeUnmount(() => {
  componentUnmounted = true;
  pendingManualRunRequestToken = null;
  loadRequestToken++;
  invalidateRunConsole();
  resetLiveStepOwnership();
});

const openRestoreDialog = (run: DockerDatabaseBackupRun) => {
  restoreRun.value = run;
  restoreDialogOpen.value = true;
};

const openRunLogs = (run: DockerDatabaseBackupRun) => {
  if (!run.task_id) return;
  invalidateRunConsole();
  awaitingRunLogs.value = false;
  logSheetRunId.value = run.id;
  logSheetTaskId.value = run.task_id;
  logSheetError.value = "";
  logSheetOpen.value = true;
};
watch(restoreDialogOpen, (isOpen) => {
  if (!isOpen) {
    nextTick(() => {
      restoreRun.value = null;
    });
  }
});

const cronPresets: { label: string; value: string }[] = [
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 03:00 UTC", value: "0 3 * * *" },
  { label: "Weekly (Sun 03:00)", value: "0 3 * * 0" },
  { label: "Monthly (1st 03:00)", value: "0 3 1 * *" },
];

const isConfigured = computed(() => backup.value !== null);
const hasProviders = computed(() => providers.value.length > 0);
const isEditing = computed(() => isConfigured.value);

const canSubmit = computed(() => {
  if (saving.value) return false;
  if (!storageProviderId.value) return false;
  if (cronSchedule.value.trim().length === 0) return false;
  if (retention.value < 1) return false;
  return true;
});

const load = async () => {
  const requestToken = ++loadRequestToken;
  const databaseId = props.database.id;
  const projectId = props.database.project_id;
  const serverId = props.database.server_id;
  loading.value = true;
  try {
    const [cfgRes, runsRes, provRes] = await Promise.all([
      dockerService.databases.getBackup(serverId, projectId, databaseId),
      dockerService.databases.listBackupRuns(serverId, projectId, databaseId),
      $api<{ data: StorageProviderRecord[] }>("/storage-providers"),
    ]);
    if (requestToken !== loadRequestToken || databaseId !== props.database.id) {
      return;
    }
    backup.value = cfgRes.data ?? null;
    runs.value = runsRes.data ?? [];
    providers.value = (provRes.data ?? []).filter((p) => p.provider === "s3");
  } catch (err: unknown) {
    if (requestToken !== loadRequestToken || databaseId !== props.database.id) {
      return;
    }
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load backup configuration");
  } finally {
    if (requestToken === loadRequestToken && databaseId === props.database.id) {
      loading.value = false;
    }
  }
};

onMounted(load);

watch(
  () => props.database.id,
  (databaseId, previousDatabaseId) => {
    if (databaseId === previousDatabaseId) return;
    pendingManualRunRequestToken = null;
    activeRunRequestToken++;
    cancelLogRefresh();
    cancelRunReconciliation();
    bufferedRunConsoleEvents.clear();
    terminalToastRunIds.clear();
    awaitingRunLogs.value = false;
    logSheetTaskId.value = "";
    logSheetRunId.value = "";
    logSheetError.value = "";
    logSheetOpen.value = false;
    resetLiveStepOwnership();
    backup.value = null;
    runs.value = [];
    dialogOpen.value = false;
    historySheetOpen.value = false;
    restoreDialogOpen.value = false;
    restoreRun.value = null;
    void load();
  },
);

const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

const bufferRunConsoleEvent = (
  runId: string,
  data: Record<string, unknown>,
  event: string,
) => {
  const buffered = bufferedRunConsoleEvents.get(runId) ?? {};
  if (data.task_id) buffered.taskId = String(data.task_id);
  if (
    event === "docker.database.backup.run.progress" &&
    data.type === "backup_step"
  ) {
    buffered.step = String(data.value ?? "");
  }
  if (event === "docker.database.backup.run.failed") {
    buffered.terminal = "failed";
    buffered.error =
      String(data.error ?? "").trim() ||
      "Backup failed before log streaming could start.";
  } else if (event === "docker.database.backup.run.succeeded") {
    buffered.terminal = "succeeded";
  }
  bufferedRunConsoleEvents.set(runId, buffered);
};

const takeBufferedRunConsole = (runId: string) => {
  const buffered = bufferedRunConsoleEvents.get(runId);
  bufferedRunConsoleEvents.clear();
  return buffered;
};

const applyBufferedRunConsole = (
  runId: string,
  buffered?: BufferedRunConsoleEvent,
) => {
  if (!buffered) return;
  if (buffered.taskId) {
    logSheetTaskId.value = buffered.taskId;
    logSheetError.value = "";
    awaitingRunLogs.value = false;
    cancelRunReconciliation();
  }
  if (buffered.terminal) {
    awaitingRunLogs.value = false;
    if (buffered.terminal === "failed" && !buffered.taskId) {
      logSheetError.value =
        buffered.error || "Backup failed before log streaming could start.";
    }
    if (buffered.taskId) {
      scheduleLogRefresh(runId);
    }
  }
};

const applyBufferedRunProgress = (
  runId: string,
  buffered?: BufferedRunConsoleEvent,
) => {
  if (!buffered) return;
  if (buffered.terminal) {
    if (liveStepRunId.value === runId) resetLiveStepOwnership();
    return;
  }
  if (buffered.step !== undefined) {
    liveStepRunId.value = runId;
    liveStep.value = buffered.step;
  }
};

const applyRunSnapshotToConsole = (
  runId: string,
  run: DockerDatabaseBackupRun,
) => {
  const taskId = String(run.task_id ?? "");
  if (taskId) {
    logSheetTaskId.value = taskId;
    logSheetError.value = "";
    awaitingRunLogs.value = false;
    cancelRunReconciliation();
  }

  const status = String(run.status ?? "").toLowerCase();
  const terminal =
    status === "success" || status === "finished"
      ? "succeeded"
      : status === "failed" ||
          status === "cancelled" ||
          status === "canceled" ||
          status === "timeout" ||
          status === "timed_out"
        ? "failed"
        : undefined;
  if (!terminal) return undefined;

  awaitingRunLogs.value = false;
  cancelRunReconciliation();
  if (liveStepRunId.value === runId) resetLiveStepOwnership();
  if (terminal === "failed") {
    logSheetError.value =
      String(run.error ?? "").trim() ||
      (logSheetTaskId.value
        ? ""
        : "Backup failed before log streaming could start.");
  } else {
    logSheetError.value = "";
  }
  if (logSheetTaskId.value) scheduleLogRefresh(runId);
  return terminal;
};

const ownsRunReconciliation = (runId: string, requestToken: number) =>
  !componentUnmounted &&
  requestToken === activeRunRequestToken &&
  logSheetOpen.value &&
  awaitingRunLogs.value &&
  logSheetRunId.value === runId;

const scheduleRunReconciliation = (
  runId: string,
  requestToken: number,
  attempt = 0,
) => {
  cancelRunReconciliation();
  if (!ownsRunReconciliation(runId, requestToken)) {
    return;
  }
  if (attempt >= RUN_RECONCILE_MAX_ATTEMPTS) {
    awaitingRunLogs.value = false;
    logSheetError.value =
      "Live output is not available yet. Follow this backup in Active actions.";
    return;
  }
  runReconcileTimer = setTimeout(() => {
    runReconcileTimer = undefined;
    void reconcileRunConsole(runId, requestToken, attempt + 1);
  }, RUN_RECONCILE_INTERVAL_MS);
};

async function reconcileRunConsole(
  runId: string,
  requestToken: number,
  attempt: number,
) {
  if (!ownsRunReconciliation(runId, requestToken)) return;
  try {
    const response = await dockerService.databases.listBackupRuns(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    if (!ownsRunReconciliation(runId, requestToken)) return;

    const snapshots = response.data ?? [];
    runs.value = snapshots;
    const snapshot = snapshots.find((run) => run.id === runId);
    if (snapshot) {
      const terminal = applyRunSnapshotToConsole(runId, snapshot);
      if (terminal) {
        toastRunTerminal(
          runId,
          terminal,
          String(snapshot.error ?? "").trim(),
          Boolean(logSheetTaskId.value),
        );
        return;
      }
    }
  } catch {
    if (!ownsRunReconciliation(runId, requestToken)) return;
  }
  scheduleRunReconciliation(runId, requestToken, attempt);
}

const toastRunTerminal = (
  runId: string,
  terminal: "succeeded" | "failed",
  error: string | undefined,
  showLogHint: boolean,
) => {
  if (runId && terminalToastRunIds.has(runId)) return;
  if (runId) terminalToastRunIds.add(runId);
  if (terminal === "succeeded") {
    toast.success("Backup completed");
    return;
  }
  toast.error(
    showLogHint
      ? "Backup failed — check the log console for details"
      : error || "Backup failed before log streaming could start",
  );
};

useDockerBackupEvents(teamId, (data, event) => {
  if (String(data.database_id ?? "") !== props.database.id) return;

  const eventRunId = String(data.run_id ?? "");
  const eventSource = String(data.source ?? "");
  if (
    event === "docker.database.backup.configured" ||
    event === "docker.database.backup.deleted"
  ) {
    resetLiveStepOwnership();
  }
  const waitingForResponse =
    logSheetOpen.value && awaitingRunLogs.value && !logSheetRunId.value;
  const isPendingManualCandidate =
    pendingManualRunRequestToken !== null &&
    Boolean(eventRunId) &&
    (!eventSource || eventSource === "manual");
  if (isPendingManualCandidate) {
    bufferRunConsoleEvent(eventRunId, data, event);
  }
  const matchesOpenRun =
    logSheetOpen.value &&
    Boolean(logSheetRunId.value) &&
    eventRunId === logSheetRunId.value;
  if (matchesOpenRun && data.task_id) {
    logSheetTaskId.value = String(data.task_id);
    logSheetError.value = "";
    awaitingRunLogs.value = false;
    cancelRunReconciliation();
  }
  if (event === "docker.database.backup.run.progress") {
    if (data.type !== "backup_step" || !eventRunId) return;
    if (pendingManualRunRequestToken !== null || waitingForResponse) return;

    const activeManualRunId =
      logSheetOpen.value && awaitingRunLogs.value ? logSheetRunId.value : "";
    if (activeManualRunId) {
      if (eventRunId === activeManualRunId) {
        liveStepRunId.value = eventRunId;
        liveStep.value = String(data.value ?? "");
      }
      return;
    }

    if (!liveStepRunId.value || liveStepRunId.value === eventRunId) {
      liveStepRunId.value = eventRunId;
      liveStep.value = String(data.value ?? "");
    }
    return;
  }
  if (
    event === "docker.database.backup.run.succeeded" ||
    event === "docker.database.backup.run.failed"
  ) {
    if (eventRunId && liveStepRunId.value === eventRunId) {
      resetLiveStepOwnership();
    }
    if (matchesOpenRun) {
      awaitingRunLogs.value = false;
      cancelRunReconciliation();
      if (
        event === "docker.database.backup.run.failed" &&
        !logSheetTaskId.value
      ) {
        logSheetError.value =
          String(data.error ?? "").trim() ||
          "Backup failed before log streaming could start.";
      }
    }
    if (matchesOpenRun && logSheetTaskId.value) {
      scheduleLogRefresh(eventRunId);
    }
    if (!isPendingManualCandidate) {
      toastRunTerminal(
        eventRunId,
        event === "docker.database.backup.run.succeeded"
          ? "succeeded"
          : "failed",
        String(data.error ?? "").trim(),
        matchesOpenRun && Boolean(logSheetTaskId.value),
      );
    }
  }
  load();
});

const openDialog = () => {
  if (backup.value) {
    storageProviderId.value = backup.value.storage_provider_id;
    databaseName.value = backup.value.database_name ?? "";
    path.value = backup.value.path ?? "";
    retention.value = backup.value.retention ?? 10;
    cronSchedule.value = backup.value.cron_schedule ?? "0 3 * * *";
    notifyOnSuccess.value = backup.value.notify_on_success;
    notifyOnFailure.value = backup.value.notify_on_failure;
    enabled.value = backup.value.enabled;
  } else {
    storageProviderId.value = providers.value[0]?.id ?? null;
    databaseName.value = "";
    path.value = "";
    retention.value = 10;
    cronSchedule.value = "0 3 * * *";
    notifyOnSuccess.value = false;
    notifyOnFailure.value = true;
    enabled.value = true;
  }
  dialogOpen.value = true;
};

const saveConfig = async () => {
  if (!storageProviderId.value) {
    toast.error("Select a storage provider");
    return;
  }
  saving.value = true;
  try {
    const res = await dockerService.databases.configureBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      {
        storage_provider_id: storageProviderId.value,
        database_name: databaseName.value.trim() || undefined,
        path: path.value.trim() || undefined,
        retention: retention.value,
        notify_on_success: notifyOnSuccess.value,
        notify_on_failure: notifyOnFailure.value,
        cron_schedule: cronSchedule.value.trim() || undefined,
        enabled: enabled.value,
      },
    );
    backup.value = res.data;
    resetLiveStepOwnership();
    toast.success(
      isEditing.value
        ? "Backup configuration updated"
        : "Backup configuration created",
    );
    dialogOpen.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save backup configuration");
  } finally {
    saving.value = false;
  }
};

const runNow = async () => {
  if (!isConfigured.value) return;
  runningNow.value = true;
  const requestedDatabaseId = props.database.id;
  const runRequestToken = invalidateRunConsole();
  resetLiveStepOwnership();
  logSheetTaskId.value = "";
  logSheetRunId.value = "";
  logSheetError.value = "";
  pendingManualRunRequestToken = runRequestToken;
  awaitingRunLogs.value = true;
  logSheetOpen.value = true;
  try {
    const res = await dockerService.databases.runBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    const runId = String(res.data.id ?? "");
    if (!runId)
      throw new Error("Backup started without a valid run identifier");
    const ownsPendingRequest = pendingManualRunRequestToken === runRequestToken;
    if (ownsPendingRequest) pendingManualRunRequestToken = null;
    const isCurrentDatabase = requestedDatabaseId === props.database.id;

    const ownsOpenConsole =
      ownsPendingRequest &&
      isCurrentDatabase &&
      runRequestToken === activeRunRequestToken &&
      logSheetOpen.value;
    const buffered = ownsPendingRequest
      ? takeBufferedRunConsole(runId)
      : undefined;
    if (ownsPendingRequest && isCurrentDatabase) {
      applyBufferedRunProgress(runId, buffered);
    }
    let responseTerminal: "succeeded" | "failed" | undefined;
    if (ownsOpenConsole) {
      logSheetRunId.value = runId;
      responseTerminal = applyRunSnapshotToConsole(runId, res.data);
      applyBufferedRunConsole(runId, buffered);
      if (!buffered?.terminal && responseTerminal) {
        toastRunTerminal(
          runId,
          responseTerminal,
          String(res.data.error ?? "").trim(),
          Boolean(logSheetTaskId.value),
        );
      }
    }
    if (buffered?.terminal) {
      toastRunTerminal(
        runId,
        buffered.terminal,
        buffered.error,
        ownsOpenConsole && Boolean(buffered.taskId),
      );
    }

    if (
      ownsOpenConsole &&
      runRequestToken === activeRunRequestToken &&
      logSheetOpen.value &&
      !buffered?.terminal &&
      !responseTerminal
    ) {
      toast.success("Backup triggered — running in the background");
      if (awaitingRunLogs.value) {
        scheduleRunReconciliation(runId, runRequestToken);
      }
    }

    if (!componentUnmounted) await load();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string };
    const message = e.data?.message || e.message || "Failed to run backup";
    const ownsPendingRequest = pendingManualRunRequestToken === runRequestToken;
    if (ownsPendingRequest) {
      pendingManualRunRequestToken = null;
      bufferedRunConsoleEvents.clear();
    }
    if (
      ownsPendingRequest &&
      requestedDatabaseId === props.database.id &&
      runRequestToken === activeRunRequestToken &&
      logSheetOpen.value
    ) {
      awaitingRunLogs.value = false;
      logSheetRunId.value = "";
      logSheetTaskId.value = "";
      logSheetError.value = message;
      cancelLogRefresh();
    }
    toast.error(message);
    if (!componentUnmounted) await load();
  } finally {
    runningNow.value = false;
  }
};

const deleteConfig = async () => {
  if (!isConfigured.value) return;
  if (
    !window.confirm(
      "Delete this backup configuration? Past run history is preserved for audit.",
    )
  ) {
    return;
  }
  deleting.value = true;
  try {
    await dockerService.databases.deleteBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    backup.value = null;
    resetLiveStepOwnership();
    toast.success("Backup configuration deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete backup configuration");
  } finally {
    deleting.value = false;
  }
};

const applyPreset = (value: string) => {
  cronSchedule.value = value;
};

const formatBytes = (n?: number | null) => {
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const formatTimeAgo = (s?: string | null) => {
  if (!s) return "—";
  try {
    return formatDistanceToNow(new Date(s), { addSuffix: true });
  } catch {
    return s;
  }
};

const runStatusConfig: Record<
  string,
  { icon: string; label: string; class: string }
> = {
  success: {
    icon: "lucide:check-circle-2",
    label: "Finished",
    class:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  triggered: {
    icon: "lucide:loader-2",
    label: "Triggered",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  running: {
    icon: "lucide:loader-2",
    label: "Running",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  failed: {
    icon: "lucide:alert-circle",
    label: "Failed",
    class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  pending: {
    icon: "lucide:clock",
    label: "Pending",
    class:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
};

const providerLabel = (p: StorageProviderRecord) => {
  return p.label || `${p.provider.toUpperCase()} #${p.id}`;
};

const currentProviderLabel = computed(() => {
  if (!backup.value) return "";
  const p = providers.value.find(
    (x) => x.id === backup.value!.storage_provider_id,
  );
  return p ? providerLabel(p) : `#${backup.value.storage_provider_id}`;
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h2 class="text-base font-semibold">Backups</h2>
        <p class="text-xs text-muted-foreground">
          Scheduled snapshots that upload to a saved storage provider.
          Credentials live on the provider — never duplicated here.
        </p>
      </div>

      <Button
        v-if="!isConfigured"
        size="sm"
        :disabled="!hasProviders"
        @click="openDialog"
      >
        <Icon name="lucide:plus" class="mr-2 h-3.5 w-3.5" />
        Create Backup
      </Button>
    </div>

    <SharedEmptyState
      v-if="!loading && !hasProviders"
      icon="lucide:cloud-off"
      title="No storage providers configured"
      description="Add an S3-compatible destination under Settings → Connections to enable database backups."
    >
      <NuxtLink to="/settings/connections">
        <Button size="sm" variant="outline">
          <Icon name="lucide:external-link" class="mr-2 h-3.5 w-3.5" />
          Go to Connections
        </Button>
      </NuxtLink>
    </SharedEmptyState>

    <SharedEmptyState
      v-else-if="!loading && !isConfigured"
      icon="lucide:database-backup"
      title="No backup configured"
      description="Use the Create Backup button above to pick a storage provider and schedule. Snapshots upload on the cron you choose."
    />

    <Card v-else-if="!loading && isConfigured">
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon
            name="lucide:database-backup"
            class="h-4 w-4 text-muted-foreground"
          />
          Backup Configuration
          <span
            class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="
              backup!.enabled
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300'
            "
          >
            {{ backup!.enabled ? "Active" : "Paused" }}
          </span>
          <span
            v-if="liveStep"
            class="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400"
          >
            <Icon name="lucide:loader-2" class="h-3 w-3 animate-spin" />
            {{ liveStep }}…
          </span>
        </CardTitle>
        <CardDescription class="text-xs">
          Snapshots upload to the linked storage provider on the cron schedule.
          Run a backup now, view past runs, or edit the schedule with the
          buttons below.
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <dl class="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[140px_1fr]">
          <dt class="text-muted-foreground">Storage provider</dt>
          <dd class="font-medium">{{ currentProviderLabel }}</dd>
          <dt class="text-muted-foreground">Database</dt>
          <dd class="break-all font-mono text-[11px]">
            {{ backup!.database_name || props.database.name }}
            <span
              v-if="!backup!.database_name"
              class="ml-1 text-muted-foreground"
            >
              (default)
            </span>
          </dd>
          <dt class="text-muted-foreground">Path</dt>
          <dd class="break-all font-mono text-[11px]">
            {{ backup!.path || "(bucket root)" }}
          </dd>
          <dt class="text-muted-foreground">Schedule</dt>
          <dd class="font-mono text-[11px]">
            {{ backup!.cron_schedule || "—" }}
          </dd>
          <dt class="text-muted-foreground">Retention</dt>
          <dd>{{ backup!.retention }} runs</dd>
          <dt class="text-muted-foreground">Notifications</dt>
          <dd class="space-x-2">
            <span v-if="backup!.notify_on_failure" class="text-[11px]"
              >on failure</span
            >
            <span v-if="backup!.notify_on_success" class="text-[11px]"
              >on success</span
            >
            <span
              v-if="!backup!.notify_on_failure && !backup!.notify_on_success"
              class="text-[11px] text-muted-foreground"
            >
              none
            </span>
          </dd>
          <dt class="text-muted-foreground">Recent runs</dt>
          <dd>
            <span class="text-xs">
              {{ runs.length }} {{ runs.length === 1 ? "run" : "runs" }}
            </span>
            <button
              v-if="runs.length > 0"
              type="button"
              class="ml-2 text-[11px] text-primary underline-offset-2 hover:underline"
              @click="historySheetOpen = true"
            >
              View history
            </button>
          </dd>
        </dl>

        <div class="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" :disabled="runningNow" @click="runNow">
            <Icon
              :name="runningNow ? 'lucide:loader-2' : 'lucide:play'"
              :class="['mr-1.5 h-3.5 w-3.5', runningNow && 'animate-spin']"
            />
            Run now
          </Button>
          <Button size="sm" variant="outline" @click="historySheetOpen = true">
            <Icon name="lucide:history" class="mr-1.5 h-3.5 w-3.5" />
            View History
          </Button>
          <Button size="sm" variant="outline" @click="openDialog">
            <Icon name="lucide:pencil" class="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            :disabled="deleting"
            @click="deleteConfig"
          >
            <Icon
              :name="deleting ? 'lucide:loader-2' : 'lucide:trash-2'"
              :class="['mr-1.5 h-3.5 w-3.5', deleting && 'animate-spin']"
            />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle class="text-base">
            {{
              isEditing
                ? "Edit Backup Configuration"
                : "Create Backup Configuration"
            }}
          </DialogTitle>
          <DialogDescription class="text-xs">
            Configure scheduled backups for this database. Snapshots upload to
            your selected storage provider.
          </DialogDescription>
        </DialogHeader>

        <form class="grid gap-3 py-1" @submit.prevent="saveConfig">
          <div class="space-y-1">
            <Label for="bk-provider" class="text-xs">Storage Provider</Label>
            <Select
              :model-value="storageProviderId?.toString() || ''"
              @update:model-value="
                (v) => (storageProviderId = v ? Number(v) : null)
              "
            >
              <SelectTrigger id="bk-provider" class="h-9 text-sm">
                <SelectValue placeholder="Select storage provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in providers"
                  :key="p.id"
                  :value="String(p.id)"
                >
                  {{ providerLabel(p) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[11px] text-muted-foreground">
              S3 / R2 / B2 / MinIO connections from
              <strong>Settings → Connections</strong>.
            </p>
          </div>

          <div class="space-y-1">
            <Label for="bk-dbname" class="text-xs">
              Database Name
              <span class="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="bk-dbname"
              v-model="databaseName"
              class="h-9 font-mono text-sm"
              :placeholder="props.database.name"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              Which database inside the engine to back up. Leave empty to back
              up the database created with this row (<span class="font-mono">{{
                props.database.name
              }}</span
              >). Set this if you've manually created additional databases on
              the engine and want to target one of them instead.
            </p>
          </div>

          <div class="space-y-1">
            <Label for="bk-path" class="text-xs">Backup Path</Label>
            <Input
              id="bk-path"
              v-model="path"
              class="h-9 text-sm"
              placeholder="e.g. prod/databases"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              Sub-folder under the provider's bucket. Empty = bucket root.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <Label class="text-xs">Schedule Preset</Label>
              <Select @update:model-value="(v) => applyPreset(String(v))">
                <SelectTrigger class="h-9 text-sm">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in cronPresets"
                    :key="p.value"
                    :value="p.value"
                  >
                    {{ p.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1">
              <Label for="bk-cron" class="text-xs">Cron Expression</Label>
              <Input
                id="bk-cron"
                v-model="cronSchedule"
                class="h-9 font-mono text-sm"
                placeholder="0 3 * * *"
                autocomplete="off"
              />
            </div>
          </div>

          <div class="space-y-1">
            <Label for="bk-retention" class="text-xs">
              Retention
              <span class="text-muted-foreground">
                (number of backups to keep)
              </span>
            </Label>
            <Input
              id="bk-retention"
              v-model.number="retention"
              type="number"
              min="1"
              class="h-9 text-sm"
            />
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label class="text-xs">Notifications</Label>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="bk-notify-failure"
                  v-model:checked="notifyOnFailure"
                />
                <Label for="bk-notify-failure" class="text-xs font-normal">
                  Notify on failure
                </Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox
                  id="bk-notify-success"
                  v-model:checked="notifyOnSuccess"
                />
                <Label for="bk-notify-success" class="text-xs font-normal">
                  Notify on success
                </Label>
              </div>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs">Status</Label>
              <div class="flex items-center gap-2">
                <Checkbox id="bk-enabled" v-model:checked="enabled" />
                <Label for="bk-enabled" class="text-xs font-normal">
                  Enable backup
                </Label>
              </div>
              <p class="text-[11px] text-muted-foreground">
                Off keeps the config but pauses the scheduler.
              </p>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="saving"
            @click="dialogOpen = false"
          >
            Cancel
          </Button>
          <Button size="sm" :disabled="!canSubmit" @click="saveConfig">
            <Icon
              v-if="saving"
              name="lucide:loader-2"
              class="mr-2 h-3.5 w-3.5 animate-spin"
            />
            {{ isEditing ? "Update Backup" : "Create Backup" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Sheet v-model:open="historySheetOpen">
      <SheetContent class="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Backup History</SheetTitle>
          <SheetDescription>
            Past backup runs for <strong>{{ props.database.name }}</strong
            >, most recent first.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea class="mt-4 h-[calc(100vh-140px)] pr-4">
          <div
            v-if="runs.length === 0"
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <Icon
              name="lucide:history"
              class="mb-4 h-10 w-10 text-muted-foreground"
            />
            <p class="text-sm text-muted-foreground">No backup runs yet</p>
            <p class="mt-1 text-xs text-muted-foreground">
              Use the Actions menu → Run now to trigger one.
            </p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="r in runs"
              :key="r.id"
              class="space-y-2 rounded-lg border p-3"
            >
              <div class="flex items-center justify-between">
                <span
                  class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :class="
                    (runStatusConfig[r.status] || runStatusConfig.pending).class
                  "
                >
                  <Icon
                    :name="
                      (runStatusConfig[r.status] || runStatusConfig.pending)
                        .icon
                    "
                    :class="[
                      'h-3 w-3',
                      r.status === 'running' && 'animate-spin',
                    ]"
                  />
                  {{
                    (runStatusConfig[r.status] || runStatusConfig.pending).label
                  }}
                </span>
                <span class="text-[11px] text-muted-foreground">
                  {{ formatTimeAgo(r.started_at || r.created_at) }}
                </span>
              </div>

              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">Size</span>
                <span class="font-medium">{{ formatBytes(r.size_bytes) }}</span>
              </div>

              <div
                v-if="r.object_key"
                class="break-all font-mono text-[10px] text-muted-foreground"
              >
                {{ r.object_key }}
              </div>

              <div
                v-if="r.error"
                class="mt-1 break-all rounded bg-destructive/10 p-2 font-mono text-[10px] text-destructive"
              >
                {{ r.error }}
              </div>

              <div
                v-if="r.task_id || (r.status === 'success' && r.object_key)"
                class="flex justify-end gap-2 pt-1"
              >
                <Button
                  v-if="r.task_id"
                  size="sm"
                  variant="ghost"
                  class="h-7 px-2 text-[11px]"
                  @click="openRunLogs(r)"
                >
                  <Icon name="lucide:scroll-text" class="mr-1.5 h-3 w-3" />
                  View Logs
                </Button>
                <Button
                  v-if="r.status === 'success' && r.object_key"
                  size="sm"
                  variant="outline"
                  class="h-7 px-2 text-[11px]"
                  @click="openRestoreDialog(r)"
                >
                  <Icon name="lucide:rotate-ccw" class="mr-1.5 h-3 w-3" />
                  Restore
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>

    <DatabaseRestoreBackupDialog
      v-model:open="restoreDialogOpen"
      :source-database="props.database"
      :run="restoreRun"
    />

    <Sheet v-model:open="logSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-3xl flex flex-col overflow-hidden outline-none"
      >
        <SheetHeader class="shrink-0">
          <SheetTitle>Backup Logs</SheetTitle>
          <SheetDescription>
            Dump &amp; upload output for this backup run.
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-1 flex-col min-h-0">
          <ServerLogViewer
            v-if="logSheetOpen && logSheetTaskId"
            :key="`${logSheetTaskId}-${logRefreshNonce}`"
            :server-id="props.database.server_id"
            entity="task"
            :entity-id="logSheetTaskId"
            :no-timestamp="true"
            hide-options
            container-class-name="h-full rounded-b-lg"
          />
          <div
            v-else-if="logSheetOpen && logSheetError"
            class="flex flex-1 items-center justify-center px-6 text-center"
          >
            <div class="max-w-lg space-y-2 text-destructive">
              <Icon name="lucide:circle-alert" class="mx-auto h-5 w-5" />
              <p class="text-sm font-medium">Backup output unavailable</p>
              <p class="whitespace-pre-wrap break-words text-xs">
                {{ logSheetError }}
              </p>
            </div>
          </div>
          <div
            v-else-if="logSheetOpen"
            class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
            Starting backup… waiting for output.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

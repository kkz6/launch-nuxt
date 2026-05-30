<script setup lang="ts">
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

// Server state ------------------------------------------------------
const backup = ref<DockerDatabaseBackup | null>(null);
const runs = ref<DockerDatabaseBackupRun[]>([]);
const providers = ref<StorageProviderRecord[]>([]);
const loading = ref(true);
const runningNow = ref(false);
const deleting = ref(false);

// Dialog + sheet open flags ----------------------------------------
const dialogOpen = ref(false);
const historySheetOpen = ref(false);
// Live-logs sheet (ServerLogViewer entity="task") for a single run.
const logSheetOpen = ref(false);
const logSheetTaskId = ref("");
// Bumped when the viewed run finishes, to remount the log viewer so it
// re-fetches the final stored output — covers very fast runs where the
// live tail attaches after the task's log file is already gone.
const logRefreshNonce = ref(0);
// True between clicking "Run now" and the run.started event arriving:
// the sheet is open but we don't have the task id yet, so it shows a
// "starting…" state and auto-attaches the live stream once it lands.
const awaitingRunLogs = ref(false);
watch(logSheetOpen, (open) => {
  if (!open) awaitingRunLogs.value = false;
});
// Restore-from-snapshot dialog state. Held here (rather than inside
// the dialog component) so the history sheet's per-row Restore button
// can both open it AND tell it which run to operate on. Reset when
// closed so a stale `restoreRun` value doesn't leak between opens.
const restoreDialogOpen = ref(false);
const restoreRun = ref<DockerDatabaseBackupRun | null>(null);
const openRestoreDialog = (run: DockerDatabaseBackupRun) => {
  restoreRun.value = run;
  restoreDialogOpen.value = true;
};

const openRunLogs = (run: DockerDatabaseBackupRun) => {
  if (!run.task_id) return;
  logSheetTaskId.value = run.task_id;
  logSheetOpen.value = true;
};
watch(restoreDialogOpen, (isOpen) => {
  if (!isOpen) {
    // Don't clear restoreRun synchronously — the dialog's close
    // transition still needs the data to render its body. nextTick
    // is enough to wait out the unmount.
    nextTick(() => {
      restoreRun.value = null;
    });
  }
});

// Form state — seeded when dialog opens, discarded on cancel -------
const storageProviderId = ref<number | null>(null);
// Optional in-engine database override. Empty string means "use the
// database the row was provisioned with" — that's the historical
// behaviour and what we want for backwards-compat with existing
// configs created before this field existed.
const databaseName = ref("");
const path = ref("");
const retention = ref<number>(10);
const cronSchedule = ref("0 3 * * *");
const notifyOnSuccess = ref(false);
const notifyOnFailure = ref(true);
const enabled = ref(true);
const saving = ref(false);

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
  loading.value = true;
  try {
    const [cfgRes, runsRes, provRes] = await Promise.all([
      dockerService.databases.getBackup(
        props.database.server_id,
        props.database.project_id,
        props.database.id,
      ),
      dockerService.databases.listBackupRuns(
        props.database.server_id,
        props.database.project_id,
        props.database.id,
      ),
      $api<{ data: StorageProviderRecord[] }>("/storage-providers"),
    ]);
    backup.value = cfgRes.data ?? null;
    runs.value = runsRes.data ?? [];
    providers.value = (provRes.data ?? []).filter(
      (p) => p.provider === "s3",
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load backup configuration");
  } finally {
    loading.value = false;
  }
};

onMounted(load);

// Live updates. "Run now" is async — the worker dumps + uploads in the
// background and emits run events over the team channel. Refresh the
// history when a run for THIS database starts / finishes, and surface
// the current step (dumping / uploading / done) live from progress
// markers so the user sees motion instead of a frozen "triggered" pill.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const liveStep = ref("");

useDockerBackupEvents(teamId, (data, event) => {
  if (String(data.database_id ?? "") !== props.database.id) return;
  // Attach the just-opened live console to the run we triggered, as
  // soon as the worker reports its task id (run.started carries it).
  if (awaitingRunLogs.value && data.task_id) {
    logSheetTaskId.value = String(data.task_id);
    awaitingRunLogs.value = false;
  }
  if (event === "docker.database.backup.run.progress") {
    if (data.type === "backup_step") liveStep.value = String(data.value ?? "");
    return;
  }
  if (
    event === "docker.database.backup.run.succeeded" ||
    event === "docker.database.backup.run.failed"
  ) {
    liveStep.value = "";
    // Run finished — if its log console is open, remount the viewer so
    // it re-fetches the final stored output (a fast run's live tail may
    // have attached after the on-disk log file was already gone).
    if (logSheetOpen.value && logSheetTaskId.value) {
      setTimeout(() => logRefreshNonce.value++, 800);
    }
  }
  // started / succeeded / failed → re-pull so the pills + history update.
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
        // Send undefined for blank input so the backend treats it as
        // "clear the override" rather than persisting an empty string.
        // The backend also normalises whitespace-only values to nil,
        // belt-and-braces.
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
  try {
    const res = await dockerService.databases.runBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    // Async now: the API returns a "triggered" run immediately; the
    // worker dumps + uploads in the background and the run flips to
    // running → success/failed live over WebSocket (see the
    // useDockerBackupEvents subscription below).
    runs.value = [res.data, ...runs.value].slice(0, 50);
    toast.success("Backup triggered — running in the background");
    // Mirror the deployment UX: pop the live log console open right
    // away so the dump → upload streams as it happens, instead of
    // making the user dig into View History. The task id arrives a
    // beat later on the run.started event (handled in the WS
    // subscription below), which attaches the live stream.
    logSheetTaskId.value = "";
    awaitingRunLogs.value = true;
    logSheetOpen.value = true;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to run backup");
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

// Format helpers ----------------------------------------------------
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

// Status pill styling — mirrors the existing
// ServerSettingsBackupHistorySheet shape so the look matches across
// the platform's backup features.
const runStatusConfig: Record<string, { icon: string; label: string; class: string }> = {
  success: {
    icon: "lucide:check-circle-2",
    label: "Finished",
    class: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
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
    class: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
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
    <!--
      ─── Header row ──────────────────────────────────────────────
      Title + description on the left, primary action on the right.
      When not configured: [Create Backup] button. When configured:
      single [Actions ▾] dropdown with Run now / View History /
      Edit / Delete — mirrors the existing PHP server-backup UI.
    -->
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h2 class="text-base font-semibold">Backups</h2>
        <p class="text-xs text-muted-foreground">
          Scheduled snapshots that upload to a saved storage provider.
          Credentials live on the provider — never duplicated here.
        </p>
      </div>

      <!--
        Not configured → primary "Create Backup" button. When
        configured, the actions live inline inside the card below
        (Run now / View History / Edit / Delete) rather than a
        separate top-right dropdown.
      -->
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

    <!-- ─── No providers — shared empty state ────────────────────── -->
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

    <!--
      ─── Providers exist but no backup yet ───────────────────────
      The header row above already carries the [Create Backup]
      action, so the empty state stays purely informational — no
      duplicate button inside it.
    -->
    <SharedEmptyState
      v-else-if="!loading && !isConfigured"
      icon="lucide:database-backup"
      title="No backup configured"
      description="Use the Create Backup button above to pick a storage provider and schedule. Snapshots upload on the cron you choose."
    />

    <!-- ─── Summary card — current configuration ───────────────── -->
    <Card v-else-if="!loading && isConfigured">
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:database-backup" class="h-4 w-4 text-muted-foreground" />
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
          Snapshots upload to the linked storage provider on the cron
          schedule. Run a backup now, view past runs, or edit the
          schedule with the buttons below.
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <dl class="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[140px_1fr]">
          <dt class="text-muted-foreground">Storage provider</dt>
          <dd class="font-medium">{{ currentProviderLabel }}</dd>
          <!--
            Effective target database — what the dump command actually
            runs against. Falls back to the row's name when no override
            is set (matches what the backend computes via
            EffectiveDatabaseName). Shown so the user can verify their
            backup targets the right DB without opening the dialog.
          -->
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
          <dd class="font-mono text-[11px]">{{ backup!.cron_schedule || "—" }}</dd>
          <dt class="text-muted-foreground">Retention</dt>
          <dd>{{ backup!.retention }} runs</dd>
          <dt class="text-muted-foreground">Notifications</dt>
          <dd class="space-x-2">
            <span v-if="backup!.notify_on_failure" class="text-[11px]">on failure</span>
            <span v-if="backup!.notify_on_success" class="text-[11px]">on success</span>
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

        <!--
          Inline actions — kept inside the card (instead of a separate
          top-right Actions dropdown) so everything for this backup
          lives in one place. Run now + View History are primary
          affordances; Edit and Delete sit to the right.
        -->
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

    <!--
      ─── Create / Edit Dialog ──────────────────────────────────────
      Same tight sizing as the Advanced tab: text-base title,
      text-xs labels, h-9 inputs, [11px] help text, size="sm" footer
      buttons. Mirrors the PHP CreateBackup field set minus the
      "Databases to Include" multi-select (each docker DB has its
      own backup row, so the database is implicit in the URL).
    -->
    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle class="text-base">
            {{ isEditing ? "Edit Backup Configuration" : "Create Backup Configuration" }}
          </DialogTitle>
          <DialogDescription class="text-xs">
            Configure scheduled backups for this database. Snapshots
            upload to your selected storage provider.
          </DialogDescription>
        </DialogHeader>

        <form class="grid gap-3 py-1" @submit.prevent="saveConfig">
          <div class="space-y-1">
            <Label for="bk-provider" class="text-xs">Storage Provider</Label>
            <Select
              :model-value="storageProviderId?.toString() || ''"
              @update:model-value="(v) => (storageProviderId = v ? Number(v) : null)"
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

          <!--
            Database name — optional override. By default a docker DB
            row tracks ONE logical database inside the engine (the one
            provisioned when the row was created), and the dump
            command targets it via `pg_dump <db>` / `mysqldump <db>`.
            If the user manually created extra databases inside the
            engine, this field lets them point the backup at one of
            those instead. Empty = today's behaviour.

            Note for Mongo / Redis: the dump commands don't currently
            scope by database name (Mongo dumps everything via
            --archive; Redis dumps the whole RDB), so the override is
            effectively a no-op for those engines. We still allow it
            so the row is consistent across engines.
          -->
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
              Which database inside the engine to back up. Leave empty
              to back up the database created with this row
              (<span class="font-mono">{{ props.database.name }}</span>).
              Set this if you've manually created additional databases
              on the engine and want to target one of them instead.
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

    <!--
      ─── Run History Sheet ────────────────────────────────────────
      Mirrors components/server/settings/BackupHistorySheet.vue —
      right-side sheet with scrolling list of run cards (status pill +
      relative time + size + error). Opens from the Actions dropdown's
      "View History" item or the inline "View history" link in the
      summary card.
    -->
    <Sheet v-model:open="historySheetOpen">
      <SheetContent class="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Backup History</SheetTitle>
          <SheetDescription>
            Past backup runs for <strong>{{ props.database.name }}</strong>,
            most recent first.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea class="mt-4 h-[calc(100vh-140px)] pr-4">
          <div
            v-if="runs.length === 0"
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <Icon name="lucide:history" class="mb-4 h-10 w-10 text-muted-foreground" />
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
                  :class="(runStatusConfig[r.status] || runStatusConfig.pending).class"
                >
                  <Icon
                    :name="(runStatusConfig[r.status] || runStatusConfig.pending).icon"
                    :class="[
                      'h-3 w-3',
                      r.status === 'running' && 'animate-spin',
                    ]"
                  />
                  {{ (runStatusConfig[r.status] || runStatusConfig.pending).label }}
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

              <!--
                Restore action — only rendered for successful runs
                with an object_key (failed / running rows aren't
                restorable, and a row missing its object_key is a
                bug to investigate, not a snapshot to replay).
                Sits at the bottom of the row card so users see the
                pill / time / size context FIRST and only reach
                "Restore" after they've identified the right run.
              -->
              <div
                v-if="r.task_id || (r.status === 'success' && r.object_key)"
                class="flex justify-end gap-2 pt-1"
              >
                <!--
                  View Logs — streams the run's dump/upload output live
                  while running (and replays it after) via the same
                  task-logs websocket deployments use. Shown whenever the
                  run has a linked task.
                -->
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

    <!--
      Restore-from-snapshot dialog. Mounted at the page level (rather
      than inside the Sheet) so its z-index isn't trapped under the
      Sheet's portal — Sheet → Dialog stacking gets messy fast in
      reka-ui. The dialog reads `restoreRun` to decide which snapshot
      it's operating on; setting it to null on close (via watch above)
      keeps the dialog body from rendering stale data after the
      transition completes.
    -->
    <DatabaseRestoreBackupDialog
      v-model:open="restoreDialogOpen"
      :source-database="props.database"
      :run="restoreRun"
    />

    <!--
      Live backup logs. Streams the run's dump → upload output via the
      task-logs websocket (ServerLogViewer entity="task") — live while
      the run is in flight, replayed from the stored output afterwards.
    -->
    <Sheet v-model:open="logSheetOpen">
      <SheetContent class="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Backup Logs</SheetTitle>
          <SheetDescription>
            Dump &amp; upload output for this backup run.
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 h-[calc(100vh-140px)]">
          <ServerLogViewer
            v-if="logSheetOpen && logSheetTaskId"
            :key="`${logSheetTaskId}-${logRefreshNonce}`"
            :server-id="props.database.server_id"
            entity="task"
            :entity-id="logSheetTaskId"
          />
          <div
            v-else-if="logSheetOpen"
            class="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
            Starting backup… waiting for output.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

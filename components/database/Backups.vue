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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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

// Form state — seeded when dialog opens, discarded on cancel -------
const storageProviderId = ref<number | null>(null);
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

const openDialog = () => {
  if (backup.value) {
    storageProviderId.value = backup.value.storage_provider_id;
    path.value = backup.value.path ?? "";
    retention.value = backup.value.retention ?? 10;
    cronSchedule.value = backup.value.cron_schedule ?? "0 3 * * *";
    notifyOnSuccess.value = backup.value.notify_on_success;
    notifyOnFailure.value = backup.value.notify_on_failure;
    enabled.value = backup.value.enabled;
  } else {
    storageProviderId.value = providers.value[0]?.id ?? null;
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
    runs.value = [res.data, ...runs.value].slice(0, 50);
    toast.success(
      res.data.status === "success"
        ? "Backup completed"
        : `Backup queued (status: ${res.data.status})`,
    );
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
        Top-right control:
          - not configured  →  plain primary "Create Backup" button
          - configured      →  Actions dropdown (Run now / View
                               History / Edit / Delete)
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

      <DropdownMenu v-else>
        <DropdownMenuTrigger as-child>
          <Button size="sm" variant="outline">
            <Icon name="lucide:settings-2" class="mr-2 h-3.5 w-3.5" />
            Actions
            <Icon name="lucide:chevron-down" class="ml-2 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem :disabled="runningNow" @select="runNow">
            <Icon
              :name="runningNow ? 'lucide:loader-2' : 'lucide:play'"
              :class="['mr-2 h-3.5 w-3.5', runningNow && 'animate-spin']"
            />
            Run now
          </DropdownMenuItem>
          <DropdownMenuItem @select="historySheetOpen = true">
            <Icon name="lucide:history" class="mr-2 h-3.5 w-3.5" />
            View History
          </DropdownMenuItem>
          <DropdownMenuItem @select="openDialog">
            <Icon name="lucide:pencil" class="mr-2 h-3.5 w-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="text-destructive focus:bg-destructive/10 focus:text-destructive"
            :disabled="deleting"
            @select="deleteConfig"
          >
            <Icon
              :name="deleting ? 'lucide:loader-2' : 'lucide:trash-2'"
              :class="['mr-2 h-3.5 w-3.5', deleting && 'animate-spin']"
            />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
        </CardTitle>
        <CardDescription class="text-xs">
          Snapshots upload to the linked storage provider on the cron
          schedule. Use the Actions menu to run a backup now or view
          past runs.
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <dl class="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[140px_1fr]">
          <dt class="text-muted-foreground">Storage provider</dt>
          <dd class="font-medium">{{ currentProviderLabel }}</dd>
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
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  </div>
</template>

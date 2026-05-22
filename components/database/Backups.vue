<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type ConfigureDockerBackupData,
  type DockerDatabase,
  type DockerDatabaseBackup,
  type DockerDatabaseBackupRun,
} from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

const backup = ref<DockerDatabaseBackup | null>(null);
const runs = ref<DockerDatabaseBackupRun[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isRunning = ref(false);

const form = reactive({
  provider: "s3" as const,
  endpoint: "",
  bucket: "",
  region: "",
  path_prefix: "",
  access_key: "",
  secret_key: "",
  cron_schedule: "0 3 * * *",
  enabled: true,
});

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchAll = async () => {
  isLoading.value = true;
  try {
    const [bRes, rRes] = await Promise.all([
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
    ]);
    backup.value = bRes.data;
    if (backup.value) {
      form.endpoint = backup.value.endpoint ?? "";
      form.bucket = backup.value.bucket;
      form.region = backup.value.region ?? "";
      form.path_prefix = backup.value.path_prefix ?? "";
      form.cron_schedule = backup.value.cron_schedule ?? "0 3 * * *";
      form.enabled = backup.value.enabled;
      form.access_key = backup.value.access_key;
      // secret_key not re-fetched — user must re-enter to update.
    }
    runs.value = rRes.data;
  } catch {
    toast.error("Failed to load backup config");
  } finally {
    isLoading.value = false;
  }
};

const save = async () => {
  if (!form.bucket.trim() || !form.access_key.trim()) {
    toast.error("Bucket and access key are required");
    return;
  }
  if (!form.secret_key.trim() && !backup.value?.has_secret_key) {
    toast.error("Secret key is required");
    return;
  }
  const payload: ConfigureDockerBackupData = {
    provider: "s3",
    bucket: form.bucket.trim(),
    access_key: form.access_key.trim(),
    secret_key:
      form.secret_key.trim() ||
      // Backend treats absent secret as "no change" — but we always send
      // a value so the validator is happy. Re-use the placeholder for
      // existing backups when the user didn't retype.
      "********-keep-existing",
    enabled: form.enabled,
    ...(form.endpoint.trim() ? { endpoint: form.endpoint.trim() } : {}),
    ...(form.region.trim() ? { region: form.region.trim() } : {}),
    ...(form.path_prefix.trim() ? { path_prefix: form.path_prefix.trim() } : {}),
    ...(form.cron_schedule.trim() ? { cron_schedule: form.cron_schedule.trim() } : {}),
  };

  isSaving.value = true;
  try {
    const res = await dockerService.databases.configureBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      payload,
    );
    backup.value = res.data;
    form.secret_key = "";
    toast.success("Backup config saved");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save backup config");
  } finally {
    isSaving.value = false;
  }
};

const disableBackup = async () => {
  if (!confirmationDialog.value || !backup.value) return;
  const result = await confirmationDialog.value.show({
    title: "Disable backups",
    description:
      "Remove the backup configuration? Past snapshots in S3 are NOT deleted.",
    confirmText: "Disable",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.databases.deleteBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    backup.value = null;
    runs.value = [];
    toast.success("Backups disabled");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to disable");
  }
};

const runNow = async () => {
  isRunning.value = true;
  try {
    const res = await dockerService.databases.runBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    runs.value = [res.data, ...runs.value];
    toast.success("Backup completed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Backup failed");
  } finally {
    isRunning.value = false;
  }
};

const restoreRun = async (run: DockerDatabaseBackupRun) => {
  if (!confirmationDialog.value || run.status !== "success") return;
  const result = await confirmationDialog.value.show({
    title: "Restore this snapshot",
    description: `This overwrites the current data in ${props.database.name} with the snapshot from ${run.started_at}. Cannot be undone.`,
    confirmText: "Restore",
    cancelText: "Cancel",
    destructive: true,
    inputVerificationText: props.database.name,
    helpText: "Type the database name to confirm:",
  });
  if (!result.ok) return;
  try {
    await dockerService.databases.restoreBackup(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      run.id,
    );
    toast.success("Restore complete");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Restore failed");
  }
};

const fmtSize = (n: number | null | undefined): string => {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—";

const statusBadge = (status: string): string => {
  switch (status) {
    case "success":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "running":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  }
};

onMounted(fetchAll);
</script>

<template>
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <section class="rounded-lg border bg-card p-6">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-xl font-semibold">Backup configuration</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Where backups upload to. Any S3-compatible service works
            (AWS S3, Cloudflare R2, Backblaze B2, MinIO).
          </p>
        </div>
        <Button
          v-if="backup"
          variant="outline"
          @click="disableBackup"
        >
          <Icon name="lucide:x" class="mr-2 h-4 w-4" />
          Disable
        </Button>
      </div>

      <form class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" @submit.prevent="save">
        <div class="space-y-1">
          <Label for="bk-bucket">Bucket</Label>
          <Input id="bk-bucket" v-model="form.bucket" autocomplete="off" />
        </div>
        <div class="space-y-1">
          <Label for="bk-region">Region (optional)</Label>
          <Input id="bk-region" v-model="form.region" autocomplete="off" />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <Label for="bk-endpoint">Endpoint (optional)</Label>
          <Input
            id="bk-endpoint"
            v-model="form.endpoint"
            placeholder="https://s3.us-west-002.backblazeb2.com"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            Leave blank for AWS S3. Required for R2, B2, MinIO, etc.
          </p>
        </div>
        <div class="space-y-1">
          <Label for="bk-prefix">Path prefix (optional)</Label>
          <Input
            id="bk-prefix"
            v-model="form.path_prefix"
            placeholder="prod/databases"
            autocomplete="off"
          />
        </div>
        <div class="space-y-1">
          <Label for="bk-cron">Schedule (cron)</Label>
          <Input id="bk-cron" v-model="form.cron_schedule" autocomplete="off" />
        </div>
        <div class="space-y-1">
          <Label for="bk-ak">Access key</Label>
          <Input id="bk-ak" v-model="form.access_key" autocomplete="off" />
        </div>
        <div class="space-y-1">
          <Label for="bk-sk">Secret key</Label>
          <Input
            id="bk-sk"
            v-model="form.secret_key"
            type="password"
            autocomplete="off"
            :placeholder="backup?.has_secret_key ? '(leave blank to keep existing)' : ''"
          />
        </div>
        <div class="space-y-1 sm:col-span-2">
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input v-model="form.enabled" type="checkbox" class="h-4 w-4" />
            Enabled (scheduled runs will fire on the cron above)
          </label>
        </div>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <Button type="submit" :disabled="isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save backup config
          </Button>
        </div>
      </form>
    </section>

    <section class="rounded-lg border bg-card p-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">History</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            Recent backup runs — most recent first.
          </p>
        </div>
        <Button :disabled="!backup || isRunning" @click="runNow">
          <Icon
            v-if="isRunning"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:upload-cloud" class="mr-2 h-4 w-4" />
          Run backup now
        </Button>
      </div>

      <div
        v-if="!backup"
        class="mt-6 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
      >
        Configure a backup target above to enable scheduled runs.
      </div>
      <div
        v-else-if="runs.length === 0"
        class="mt-6 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
      >
        No backup runs yet. Click "Run backup now" to capture the first
        snapshot.
      </div>
      <div v-else class="mt-4 overflow-hidden rounded-md border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Started</th>
              <th class="px-4 py-3">Finished</th>
              <th class="px-4 py-3">Size</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in runs" :key="run.id" class="border-t">
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                  :class="statusBadge(run.status)"
                >
                  {{ run.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(run.started_at) }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ fmtDate(run.finished_at) }}</td>
              <td class="px-4 py-3 font-mono text-xs">{{ fmtSize(run.size_bytes) }}</td>
              <td class="px-4 py-3 text-right">
                <Button
                  v-if="run.status === 'success'"
                  variant="outline"
                  size="sm"
                  @click="restoreRun(run)"
                >
                  <Icon name="lucide:undo-2" class="mr-2 h-4 w-4" />
                  Restore
                </Button>
                <span v-else-if="run.error" class="text-xs text-rose-600">
                  {{ run.error.split("\n")[0] }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

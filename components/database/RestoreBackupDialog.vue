<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  dockerService,
  type DockerDatabase,
  type DockerDatabaseBackupRun,
} from "~/services/dockerService";

// Restore-from-snapshot dialog. Triggered from the backup history sheet
// (Backups.vue) when the user picks a successful run and clicks
// "Restore". The dialog confirms the action and — critically — lets
// the user pick which database to restore INTO. By default that's the
// source database, but the same-server-same-engine constraint allows
// "restore prod snapshot into staging" with a single dropdown choice.
//
// This is a destructive action: the target database's contents are
// REPLACED with whatever the snapshot contained. The dialog leans on a
// red warning + explicit "Restore" button label to communicate that.

interface Props {
  // The database the restore originated from. Used as the default
  // target + to drive the same-engine filter in the dropdown.
  sourceDatabase: DockerDatabase;
  // The backup run row to restore. The dialog body shows when it
  // was taken + the object key so the user can verify they picked
  // the right snapshot.
  run: DockerDatabaseBackupRun | null;
}

const props = defineProps<Props>();
const open = defineModel<boolean>("open", { default: false });

// All same-engine candidates on the same server — populated lazily
// the first time the dialog opens.
const candidates = ref<DockerDatabase[]>([]);
const loadingCandidates = ref(false);
// Selected target ID. Defaults to the source DB (today's restore
// behaviour); changing the dropdown sends a `target_database_id`
// to the backend.
const selectedTargetId = ref<string>("");
const restoring = ref(false);

// Reset every time the dialog re-opens so a stale selection from a
// previous open doesn't carry over.
watch(open, async (isOpen) => {
  if (!isOpen) return;
  selectedTargetId.value = props.sourceDatabase.id;
  if (candidates.value.length === 0) {
    await loadCandidates();
  }
});

const loadCandidates = async () => {
  loadingCandidates.value = true;
  try {
    const res = await dockerService.databases.listForServer(
      props.sourceDatabase.server_id,
    );
    // Filter to same-engine only — backend would reject cross-engine
    // restores anyway, but hiding them client-side gives a cleaner
    // dropdown UX. The source DB itself always stays in the list
    // (it's the default target).
    candidates.value = (res.data ?? []).filter(
      (d) => d.engine === props.sourceDatabase.engine,
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load candidate databases");
    // Fall back to just the source so the user can still restore in-
    // place even if the listing fails.
    candidates.value = [props.sourceDatabase];
  } finally {
    loadingCandidates.value = false;
  }
};

// Show "Backup taken X ago" so the user has time context without
// needing to read the raw timestamp.
const runTakenAgo = computed(() => {
  const ts = props.run?.finished_at || props.run?.started_at || props.run?.created_at;
  if (!ts) return "an unknown time ago";
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return ts;
  }
});

// Whether the user picked a different target than the source. Drives
// the extra warning copy + the button label change.
const isCrossDatabase = computed(
  () => selectedTargetId.value !== "" && selectedTargetId.value !== props.sourceDatabase.id,
);

const selectedTarget = computed(() =>
  candidates.value.find((d) => d.id === selectedTargetId.value) || null,
);

const handleRestore = async () => {
  if (!props.run) {
    toast.error("No backup run selected");
    return;
  }
  if (!selectedTargetId.value) {
    toast.error("Select a target database");
    return;
  }
  restoring.value = true;
  try {
    // Only send target_database_id when it differs from source — keeps
    // the payload minimal + matches the backend's "empty = today's
    // behaviour" contract.
    const targetOverride =
      selectedTargetId.value !== props.sourceDatabase.id
        ? selectedTargetId.value
        : undefined;
    await dockerService.databases.restoreBackup(
      props.sourceDatabase.server_id,
      props.sourceDatabase.project_id,
      props.sourceDatabase.id,
      props.run.id,
      targetOverride,
    );
    toast.success(
      isCrossDatabase.value
        ? `Restored snapshot into ${selectedTarget.value?.name ?? "target"}`
        : "Database restored from snapshot",
    );
    open.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Restore failed");
  } finally {
    restoring.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="text-base">Restore Backup</DialogTitle>
        <DialogDescription class="text-xs">
          Replay this snapshot into a database. The target's current
          contents will be replaced — this can't be undone.
        </DialogDescription>
      </DialogHeader>

      <!--
        Run summary card — small but important so users can verify
        they're about to restore the RIGHT snapshot before pulling
        the trigger. Shows object key (truncated, font-mono) +
        when it was taken.
      -->
      <div
        v-if="run"
        class="rounded-md border bg-muted/40 p-3 text-xs"
      >
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="font-medium text-foreground">Snapshot</span>
          <span class="text-muted-foreground">{{ runTakenAgo }}</span>
        </div>
        <code
          v-if="run.object_key"
          class="block break-all font-mono text-[10px] text-muted-foreground"
        >
          {{ run.object_key }}
        </code>
      </div>

      <!--
        Target database picker. Defaults to the source row; user can
        swap to any same-engine database on the same server. The
        cross-database warning under the dropdown only renders when
        the selection actually differs — keeps the dialog calm for
        the common case (restore in place).
      -->
      <div class="space-y-1.5">
        <Label for="restore-target" class="text-xs">Restore into</Label>
        <Select
          :model-value="selectedTargetId"
          @update:model-value="(v) => (selectedTargetId = String(v))"
        >
          <SelectTrigger id="restore-target" class="h-9 text-sm">
            <SelectValue placeholder="Select target database" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="d in candidates"
              :key="d.id"
              :value="d.id"
            >
              <span class="flex items-center gap-2">
                <span class="font-medium">{{ d.name }}</span>
                <span
                  v-if="d.id === sourceDatabase.id"
                  class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                >
                  source
                </span>
              </span>
            </SelectItem>
            <SelectItem
              v-if="candidates.length === 0 && !loadingCandidates"
              value="__empty__"
              disabled
            >
              No same-engine databases on this server
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-[11px] text-muted-foreground">
          Only {{ sourceDatabase.engine }} databases on this server are
          listed. Defaults to the source.
        </p>
      </div>

      <!--
        Inline warning. Always-on (red) so the user can't miss that
        this is destructive. The text adapts to whether they're
        restoring in-place vs into a different DB — the cross-DB case
        adds "this will overwrite <staging>" which is the most useful
        bit of confirmation for the prod → staging workflow.
      -->
      <div
        class="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400"
      >
        <p class="flex items-start gap-2">
          <Icon name="lucide:alert-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <template v-if="isCrossDatabase">
              This will <strong>replace</strong> the contents of
              <code class="font-mono">{{ selectedTarget?.name }}</code>
              with the snapshot from
              <code class="font-mono">{{ sourceDatabase.name }}</code>.
              Any data currently in
              <code class="font-mono">{{ selectedTarget?.name }}</code>
              will be lost.
            </template>
            <template v-else>
              This will <strong>replace</strong> the current contents
              of <code class="font-mono">{{ sourceDatabase.name }}</code>
              with the snapshot's data. Any changes since the snapshot
              was taken will be lost.
            </template>
          </span>
        </p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          size="sm"
          variant="outline"
          :disabled="restoring"
          @click="open = false"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          :disabled="restoring || !run || !selectedTargetId"
          @click="handleRestore"
        >
          <Icon
            v-if="restoring"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          <Icon
            v-else
            name="lucide:rotate-ccw"
            class="mr-2 h-3.5 w-3.5"
          />
          {{ isCrossDatabase ? "Restore into target" : "Restore" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

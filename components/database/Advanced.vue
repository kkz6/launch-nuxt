<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  dockerService,
  type DockerDatabase,
} from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  deleted: [];
}>();

type RestartPolicy = "no" | "on-failure" | "always" | "unless-stopped";

// All advanced-form state lives in this single block. Each Card binds
// to the relevant ref(s); on save the whole bundle is PATCHed back so
// the worker dispatches a single `docker update` instead of N round-
// trips for partial edits. Empty string = "leave unchanged".
const restartPolicy = ref<RestartPolicy>(
  ((props.database.build_config?.restart_policy as RestartPolicy) ||
    "unless-stopped") as RestartPolicy,
);
const cpuLimit = ref<string>(
  (props.database.build_config?.cpu_limit as string) || "",
);
const memoryLimit = ref<string>(
  (props.database.build_config?.memory_limit as string) || "",
);
const cpuReservation = ref<string>(
  (props.database.build_config?.cpu_reservation as string) || "",
);
const memoryReservation = ref<string>(
  (props.database.build_config?.memory_reservation as string) || "",
);
const runtimeSaving = ref(false);

// Public Access lives in the Connection dialog (navbar Actions →
// Connection info), next to the External tab it unlocks. That's
// where the user naturally asks "how do I enable external access?"
// — keeping the toggle adjacent to the answer beats stashing it on
// Advanced.

const rebuildLoading = ref(false);
const deleteLoading = ref(false);

// Re-seed when the parent refetches (status events, rebuild lands).
watch(
  () => props.database,
  (db) => {
    restartPolicy.value =
      ((db.build_config?.restart_policy as RestartPolicy) ||
        "unless-stopped") as RestartPolicy;
    cpuLimit.value = (db.build_config?.cpu_limit as string) || "";
    memoryLimit.value = (db.build_config?.memory_limit as string) || "";
    cpuReservation.value = (db.build_config?.cpu_reservation as string) || "";
    memoryReservation.value =
      (db.build_config?.memory_reservation as string) || "";
  },
  { deep: true },
);

// Single save for the merged Container Runtime card — covers both
// the resources fields and the restart policy. Backend treats empty
// strings as clears, so partial edits work.
const saveRuntime = async () => {
  runtimeSaving.value = true;
  try {
    await dockerService.databases.updateAdvanced(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      {
        restart_policy: restartPolicy.value,
        cpu_limit: cpuLimit.value.trim(),
        memory_limit: memoryLimit.value.trim(),
        cpu_reservation: cpuReservation.value.trim(),
        memory_reservation: memoryReservation.value.trim(),
      },
    );
    toast.success("Container runtime update queued");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update container runtime");
  } finally {
    runtimeSaving.value = false;
  }
};

// Copy-to-clipboard for the volume name — handy for `docker volume
// inspect <name>` debugging when ssh'd onto the host.
const copyVolumeName = async () => {
  if (!props.database.volume_name) return;
  try {
    await navigator.clipboard.writeText(props.database.volume_name);
    toast.success("Volume name copied to clipboard");
  } catch {
    toast.error("Couldn't access clipboard");
  }
};

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const rebuildDatabase = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Rebuild Database",
    description: `This will permanently delete all data in "${props.database.name}" and recreate the container from scratch with the same image and credentials. There is no undo.`,
    confirmText: "Rebuild Database",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the database name to confirm rebuild:",
    inputVerificationText: props.database.name,
  });
  if (!result.ok) return;

  rebuildLoading.value = true;
  try {
    await dockerService.databases.rebuild(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    toast.success("Database rebuild queued");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to rebuild database");
  } finally {
    rebuildLoading.value = false;
  }
};

const deleteDatabase = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Database",
    description:
      props.database.status === "running"
        ? `"${props.database.name}" is currently running. Deleting it will stop and remove the container. The data volume is preserved unless you tick the box below.`
        : `Are you sure you want to delete "${props.database.name}"? The data volume is preserved unless you tick the box below.`,
    confirmText: "Delete Database",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the database name to confirm deletion:",
    inputVerificationText: props.database.name,
    // Opt-in data wipe. Off by default — the launch-db-<id>-data
    // volume survives unless the user explicitly ticks the box. When
    // ticked, the rm lifecycle script appends a `docker volume rm`
    // for the deterministic data volume name after the container is
    // gone.
    checkbox: {
      label: "Also delete the data volume (database state will be lost)",
      checked: false,
    },
  });
  if (!result.ok) return;
  const removeVolumes = !!result.checkbox?.checked;

  deleteLoading.value = true;
  try {
    await dockerService.databases.delete(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      { removeVolumes },
    );
    toast.success(
      removeVolumes
        ? "Database + data volume deletion queued"
        : "Database deletion queued (data volume preserved)",
    );
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to delete database");
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <!--
    Grouped-cards layout:
      1. Storage         — read-only data volume info
      2. Container Runtime — resources + restart policy combined
                            → PATCH /advanced (docker update)
      3. Danger Zone     — Rebuild + Delete, destructive border tint

    "Public Access" lives in the Connection dialog now (navbar
    Actions → Connection info) so it sits next to the Internal /
    External tabs it unlocks. Old shape: a card here + a separate
    External tab in the dialog — required tab-hopping to reason
    about. New shape: one place, one mental model.
  -->
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- ─── Storage ───────────────────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:hard-drive" class="h-4 w-4 text-muted-foreground" />
          Storage
        </CardTitle>
        <CardDescription class="text-xs">
          Named volume bound at the engine's data directory so data
          survives recreates. Use Rebuild Database below to wipe it.
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <div
          v-if="props.database.volume_name && props.database.data_path"
          class="space-y-2.5 rounded-md border bg-muted/30 p-3"
        >
          <div class="flex items-center justify-between">
            <Badge variant="secondary" class="h-5 font-mono text-[10px] uppercase">
              Volume
            </Badge>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              @click="copyVolumeName"
            >
              <Icon name="lucide:copy" class="h-3 w-3" />
              Copy name
            </button>
          </div>
          <dl class="grid gap-1.5 text-xs sm:grid-cols-[100px_1fr]">
            <dt class="text-muted-foreground">Volume name</dt>
            <dd class="break-all font-mono text-[11px]">
              {{ props.database.volume_name }}
            </dd>
            <dt class="text-muted-foreground">Mount path</dt>
            <dd class="break-all font-mono text-[11px]">
              {{ props.database.data_path }}
            </dd>
          </dl>
        </div>
        <p v-else class="text-xs text-muted-foreground">
          No data volume metadata available for this engine.
        </p>
      </CardContent>
    </Card>

    <!-- ─── Container Runtime ─────────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:sliders-horizontal" class="h-4 w-4 text-muted-foreground" />
          Container Runtime
        </CardTitle>
        <CardDescription class="text-xs">
          Resource caps + reservations and the restart policy. Applied
          live via <code>docker update</code> — no recreate.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-4 p-4 pt-0">
        <!-- Resources block -->
        <div class="space-y-2">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resources
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <Label for="db-memory-limit" class="text-xs">Memory Limit</Label>
              <Input
                id="db-memory-limit"
                v-model="memoryLimit"
                class="h-9 text-sm"
                placeholder="e.g. 512m, 1g"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                Hard ceiling (<code>-m</code>). Empty = unlimited.
              </p>
            </div>

            <div class="space-y-1">
              <Label for="db-memory-reservation" class="text-xs">Memory Reservation</Label>
              <Input
                id="db-memory-reservation"
                v-model="memoryReservation"
                class="h-9 text-sm"
                placeholder="e.g. 256m"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                Soft floor (<code>--memory-reservation</code>).
              </p>
            </div>

            <div class="space-y-1">
              <Label for="db-cpu-limit" class="text-xs">CPU Limit</Label>
              <Input
                id="db-cpu-limit"
                v-model="cpuLimit"
                class="h-9 text-sm"
                placeholder="e.g. 0.5, 2"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                CPUs (<code>--cpus</code>). Empty = unlimited.
              </p>
            </div>

            <div class="space-y-1">
              <Label for="db-cpu-reservation" class="text-xs">CPU Reservation</Label>
              <Input
                id="db-cpu-reservation"
                v-model="cpuReservation"
                class="h-9 text-sm"
                placeholder="e.g. 1024"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                CPU shares (1024 = baseline).
              </p>
            </div>
          </div>
        </div>

        <!-- Restart policy block -->
        <div class="space-y-2">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Restart Policy
          </div>
          <div class="space-y-1 sm:max-w-md">
            <Select v-model="restartPolicy">
              <SelectTrigger id="db-restart" class="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unless-stopped">
                  Unless stopped (default)
                </SelectItem>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="on-failure">On failure</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[11px] text-muted-foreground">
              Whether the container restarts after the docker daemon
              (or host) reboots.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter class="justify-end border-t bg-muted/30 px-4 py-2">
        <Button size="sm" :disabled="runtimeSaving" @click="saveRuntime">
          <Icon
            v-if="runtimeSaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          Save
        </Button>
      </CardFooter>
    </Card>

    <!-- ─── Danger Zone ───────────────────────────────────────── -->
    <!--
      Subtle destructive-tinted border to set this card apart visually
      from the routine ones above. Title uses the destructive colour
      so a quick scan immediately tags the section as "be careful".
      Each row has a tight label + description + button, divided by a
      hairline so the two destructive actions never visually merge.
    -->
    <Card class="border-destructive/40">
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Icon name="lucide:alert-triangle" class="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription class="text-xs">
          Destructive actions. Both require typing the database name
          to confirm.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-0 divide-y p-4 pt-0">
        <!-- Rebuild row -->
        <div class="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 space-y-0.5">
            <p class="text-sm font-medium">Rebuild Database</p>
            <p class="text-xs text-muted-foreground">
              Wipes the data volume and recreates the container with
              the same image + credentials. All data is lost.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="rebuildLoading"
            class="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            @click="rebuildDatabase"
          >
            <Icon
              v-if="rebuildLoading"
              name="lucide:loader-2"
              class="mr-2 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:refresh-ccw" class="mr-2 h-3.5 w-3.5" />
            Rebuild
          </Button>
        </div>

        <!-- Delete row -->
        <div class="flex flex-col gap-2 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 space-y-0.5">
            <p class="text-sm font-medium">Delete Database</p>
            <p class="text-xs text-muted-foreground">
              Permanently delete this database. The data volume is
              preserved on the host until cleaned up manually.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            :disabled="deleteLoading"
            class="shrink-0"
            @click="deleteDatabase"
          >
            <Icon
              v-if="deleteLoading"
              name="lucide:loader-2"
              class="mr-2 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:trash-2" class="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

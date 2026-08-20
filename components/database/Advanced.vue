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
import { dockerService, type DockerDatabase } from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  deleted: [];
}>();
const { t } = useI18n();

// Role gating — the Danger Zone (rebuild / delete) is admin/owner only.
const { canDelete } = useCan();

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
    restartPolicy.value = ((db.build_config?.restart_policy as RestartPolicy) ||
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
    toast.success(t("workload.database.advanced.runtimeQueued"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.runtime.saveFailed"));
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
    toast.success(t("workload.database.advanced.volumeCopied"));
  } catch {
    toast.error(
      t("workload.copy.failed", {
        label: t("workload.database.advanced.volumeName"),
      }),
    );
  }
};

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const rebuildDatabase = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("workload.database.advanced.rebuildTitle"),
    description: t("workload.database.advanced.rebuildConfirmation", {
      name: props.database.name,
    }),
    confirmText: t("workload.database.advanced.rebuildTitle"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    helpText: t("workload.database.advanced.rebuildHelp"),
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
    toast.success(t("workload.database.advanced.rebuildQueued"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.database.advanced.rebuildFailed"),
    );
  } finally {
    rebuildLoading.value = false;
  }
};

const deleteDatabase = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("workload.database.delete.title"),
    description:
      props.database.status === "running"
        ? t("workload.database.advanced.deleteRunningDescription", {
            name: props.database.name,
          })
        : t("workload.database.advanced.deleteStoppedDescription", {
            name: props.database.name,
          }),
    confirmText: t("workload.database.delete.title"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    helpText: t("workload.database.delete.confirmHelp"),
    inputVerificationText: props.database.name,
    // Opt-in data wipe. Off by default — the launch-db-<id>-data
    // volume survives unless the user explicitly ticks the box. When
    // ticked, the rm lifecycle script appends a `docker volume rm`
    // for the deterministic data volume name after the container is
    // gone.
    checkbox: {
      label: t("workload.database.delete.volumeLabel"),
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
        ? t("workload.database.delete.queuedWithVolume")
        : t("workload.database.delete.queuedPreserved"),
    );
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.database.delete.failed"));
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
          <Icon
            name="lucide:hard-drive"
            class="h-4 w-4 text-muted-foreground"
          />
          {{ t("workload.database.advanced.storage") }}
        </CardTitle>
        <CardDescription class="text-xs">
          {{ t("workload.database.advanced.storageDescription") }}
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <div
          v-if="props.database.volume_name && props.database.data_path"
          class="space-y-2.5 rounded-md border bg-muted/30 p-3"
        >
          <div class="flex items-center justify-between">
            <Badge
              variant="secondary"
              class="h-5 font-mono text-[10px] uppercase"
            >
              {{ t("workload.database.advanced.volume") }}
            </Badge>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              @click="copyVolumeName"
            >
              <Icon name="lucide:copy" class="h-3 w-3" />
              {{ t("workload.database.advanced.copyName") }}
            </button>
          </div>
          <dl class="grid gap-1.5 text-xs sm:grid-cols-[100px_1fr]">
            <dt class="text-muted-foreground">
              {{ t("workload.database.advanced.volumeName") }}
            </dt>
            <dd class="break-all font-mono text-[11px]">
              {{ props.database.volume_name }}
            </dd>
            <dt class="text-muted-foreground">
              {{ t("workload.fields.mountPath") }}
            </dt>
            <dd class="break-all font-mono text-[11px]">
              {{ props.database.data_path }}
            </dd>
          </dl>
        </div>
        <p v-else class="text-xs text-muted-foreground">
          {{ t("workload.database.advanced.noVolumeMetadata") }}
        </p>
      </CardContent>
    </Card>

    <!-- ─── Container Runtime ─────────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon
            name="lucide:sliders-horizontal"
            class="h-4 w-4 text-muted-foreground"
          />
          {{ t("workload.runtime.title") }}
        </CardTitle>
        <CardDescription class="text-xs">
          {{ t("workload.database.advanced.runtimeDescriptionBefore") }}
          <code>docker update</code
          >{{ t("workload.database.advanced.runtimeDescriptionAfter") }}
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-4 p-4 pt-0">
        <!-- Resources block -->
        <div class="space-y-2">
          <div
            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {{ t("workload.runtime.resources") }}
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <Label for="db-memory-limit" class="text-xs">
                {{ t("workload.runtime.memoryLimit") }}
              </Label>
              <Input
                id="db-memory-limit"
                v-model="memoryLimit"
                class="h-9 text-sm"
                :placeholder="
                  t('workload.database.advanced.memoryLimitPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                {{ t("workload.runtime.memoryLimitBefore") }}<code>-m</code
                >{{ t("workload.runtime.memoryLimitAfter") }}
              </p>
            </div>

            <div class="space-y-1">
              <Label for="db-memory-reservation" class="text-xs">
                {{ t("workload.runtime.memoryReservation") }}
              </Label>
              <Input
                id="db-memory-reservation"
                v-model="memoryReservation"
                class="h-9 text-sm"
                :placeholder="
                  t('workload.database.advanced.memoryReservationPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                {{ t("workload.runtime.memoryReservationBefore")
                }}<code>--memory-reservation</code
                >{{ t("workload.punctuation.period") }}
              </p>
            </div>

            <div class="space-y-1">
              <Label for="db-cpu-limit" class="text-xs">
                {{ t("workload.runtime.cpuLimit") }}
              </Label>
              <Input
                id="db-cpu-limit"
                v-model="cpuLimit"
                class="h-9 text-sm"
                :placeholder="
                  t('workload.database.advanced.cpuLimitPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                {{ t("workload.runtime.cpuLimitBefore") }}<code>--cpus</code
                >{{ t("workload.runtime.cpuLimitAfter") }}
              </p>
            </div>

            <div class="space-y-1">
              <Label for="db-cpu-reservation" class="text-xs">
                {{ t("workload.runtime.cpuReservation") }}
              </Label>
              <Input
                id="db-cpu-reservation"
                v-model="cpuReservation"
                class="h-9 text-sm"
                :placeholder="
                  t('workload.database.advanced.cpuReservationPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                {{ t("workload.runtime.cpuReservationHelp") }}
              </p>
            </div>
          </div>
        </div>

        <!-- Restart policy block -->
        <div class="space-y-2">
          <div
            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {{ t("workload.runtime.restartPolicy") }}
          </div>
          <div class="space-y-1 sm:max-w-md">
            <Select v-model="restartPolicy">
              <SelectTrigger id="db-restart" class="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unless-stopped">
                  {{ t("workload.runtime.unlessStopped") }}
                </SelectItem>
                <SelectItem value="always">{{
                  t("workload.runtime.always")
                }}</SelectItem>
                <SelectItem value="on-failure">{{
                  t("workload.runtime.onFailure")
                }}</SelectItem>
                <SelectItem value="no">{{
                  t("workload.runtime.no")
                }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[11px] text-muted-foreground">
              {{ t("workload.runtime.restartHelp") }}
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
          {{ t("workload.actions.save") }}
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
    <Card v-if="canDelete" class="border-destructive/40">
      <CardHeader class="p-4">
        <CardTitle
          class="flex items-center gap-2 text-sm font-semibold text-destructive"
        >
          <Icon name="lucide:alert-triangle" class="h-4 w-4" />
          {{ t("workload.danger.title") }}
        </CardTitle>
        <CardDescription class="text-xs">
          {{ t("workload.database.advanced.dangerDescription") }}
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-0 divide-y p-4 pt-0">
        <!-- Rebuild row -->
        <div
          class="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 space-y-0.5">
            <p class="text-sm font-medium">
              {{ t("workload.database.advanced.rebuildTitle") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.database.advanced.rebuildDescription") }}
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
            {{ t("workload.database.advanced.rebuild") }}
          </Button>
        </div>

        <!-- Delete row -->
        <div
          class="flex flex-col gap-2 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 space-y-0.5">
            <p class="text-sm font-medium">
              {{ t("workload.database.delete.title") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.database.advanced.deleteDescription") }}
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
            {{ t("workload.actions.delete") }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

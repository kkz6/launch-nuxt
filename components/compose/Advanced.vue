<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { dockerService, type DockerCompose } from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

// Role gating — the Danger Zone (delete stack) is admin/owner only.
const { canDelete } = useCan();

// Rename form moved here from compose/General.vue so General stays
// read-only (info-card grid only, matches application + database
// detail pages). Stack name is the only mutable field today; future
// per-stack knobs (pause toggle, restart-policy override, etc.) will
// live in their own sections above the danger zone.
const name = ref(props.compose.name);
const isSaving = ref(false);

watch(
  () => props.compose.name,
  (n) => {
    name.value = n;
  },
);

const saveSettings = async () => {
  const trimmed = name.value.trim();
  if (!trimmed) {
    toast.error(t("workload.compose.advanced.nameRequired"));
    return;
  }
  isSaving.value = true;
  try {
    await dockerService.composes.update(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      { name: trimmed },
    );
    toast.success(t("workload.compose.advanced.updated"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.compose.advanced.updateFailed"));
  } finally {
    isSaving.value = false;
  }
};

// --- Run Command ---------------------------------------------------------
//
// Free-text override for the docker suffix the deploy script runs.
// Empty = use default (`compose -p <name> -f <file> up -d --build
// --remove-orphans`). Non-empty = run `docker <run_command>`
// verbatim — operator owns the whole tail including the
// `compose ...` shape. Matches dokploy's Run Command feature.
//
// We pull the live default-command preview from the backend so the
// "Default Command (...)" hint shows the actual project-slug /
// compose-file path the deploy job would resolve. Rendered through
// the same code path as the deploy script so they can't drift.

const runCommand = ref(props.compose.run_command || "");
const isSavingRunCommand = ref(false);
const defaultRunCommand = ref<string>("");

watch(
  () => props.compose.run_command,
  (cmd) => {
    runCommand.value = cmd || "";
  },
);

const fetchDefaultCommand = async () => {
  try {
    const res = await dockerService.composes.getDefaultCommand(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    defaultRunCommand.value = res.data?.command || "";
  } catch {
    // Silent: the input + Save still work. The hint just won't
    // populate, which is a minor UX miss not worth a toast.
    defaultRunCommand.value = "";
  }
};

onMounted(fetchDefaultCommand);

const saveRunCommand = async () => {
  isSavingRunCommand.value = true;
  try {
    await dockerService.composes.update(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      // Backend semantics: empty string CLEARS the override (reverts
      // to default), non-empty replaces it. The `?? ""` is belt-and-
      // braces — runCommand is already a string but the model can
      // hold null for the type contract.
      { run_command: runCommand.value },
    );
    toast.success(
      runCommand.value.trim()
        ? t("workload.compose.advanced.runCommandUpdated")
        : t("workload.compose.advanced.runCommandCleared"),
    );
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.compose.advanced.runCommandFailed"),
    );
  } finally {
    isSavingRunCommand.value = false;
  }
};

// Compose Advanced mirrors components/application/Advanced.vue —
// houses the destructive operations for the stack. General stays
// read-only-ish (rename + info); Advanced owns Delete with the
// opt-in named-volume cleanup.
//
// Future expansion candidates that map to this surface (NOT in
// this slice):
//   - Per-stack restart policy override (overrides whatever the
//     YAML declares)
//   - Pause / unpause toggle (`docker compose pause`)
//   - Reset to inline YAML from a git source (or vice versa)

const deleteLoading = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// --- Traefik dynamic-config card -----------------------------------
//
// Mirrors the application Advanced → Traefik card. Read-only by
// default; Modify opens the editor for emergency tweaks. The
// SyncComposeTraefikConfig job regenerates this file from compose
// domain rows on every domain mutation + after each successful
// deploy, so hand-edits survive until something triggers a re-render
// — same caveat the application card spells out.

const traefikFilename = ref("");
const traefikContent = ref("");
const traefikContentOnDisk = ref("");
const traefikLoading = ref(true);
const traefikSaving = ref(false);
const traefikEditing = ref(false);

const traefikDirty = computed(
  () => traefikContent.value !== traefikContentOnDisk.value,
);

const fetchTraefikConfig = async () => {
  traefikLoading.value = true;
  try {
    const res = await dockerService.composes.getTraefikConfig(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    traefikFilename.value = res.data.filename;
    traefikContent.value = res.data.content;
    traefikContentOnDisk.value = res.data.content;
  } catch {
    traefikFilename.value = "";
    traefikContent.value = "";
    traefikContentOnDisk.value = "";
  } finally {
    traefikLoading.value = false;
  }
};

const beginModifyTraefik = () => {
  traefikEditing.value = true;
};

const cancelModifyTraefik = () => {
  traefikContent.value = traefikContentOnDisk.value;
  traefikEditing.value = false;
};

const saveTraefikConfig = async () => {
  traefikSaving.value = true;
  try {
    const res = await dockerService.composes.updateTraefikConfig(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      traefikContent.value,
    );
    traefikContentOnDisk.value = res.data.content;
    traefikFilename.value = res.data.filename;
    traefikEditing.value = false;
    toast.success(t("workload.traefik.saved"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.traefik.saveFailed"));
  } finally {
    traefikSaving.value = false;
  }
};

onMounted(fetchTraefikConfig);

const deleteCompose = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("workload.compose.delete.title"),
    description: t("workload.compose.advanced.deleteConfirmation", {
      name: props.compose.name,
    }),
    confirmText: t("workload.compose.advanced.deleteStack"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    helpText: t("workload.compose.delete.confirmHelp"),
    inputVerificationText: props.compose.name,
    // Opt-in volume cleanup. Off by default so a misclicked Delete
    // preserves persistent data; the user has to explicitly tick the
    // box to wipe state. Backend toggles `docker compose down` ↔
    // `docker compose down -v` on this flag.
    checkbox: {
      label: t("workload.compose.advanced.deleteVolumes"),
      checked: false,
    },
  });
  if (!result.ok) return;
  const removeVolumes = !!result.checkbox?.checked;

  deleteLoading.value = true;
  try {
    await dockerService.composes.delete(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      { removeVolumes },
    );
    toast.success(
      removeVolumes
        ? t("workload.compose.advanced.deleteQueuedWithVolumes")
        : t("workload.compose.advanced.deleteQueuedPreserved"),
    );
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.compose.delete.failed"));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!--
      General section — same Card-primitive sectioned layout the
      application Advanced uses. Holds the rename today; future
      stack-level toggles (pause, restart-policy override) land
      here. Stays read-only-friendly: the Save button greys out
      when there's nothing to apply.
    -->
    <div class="rounded-lg border bg-card p-6">
      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
        >
          <Icon name="lucide:tag" class="h-4 w-4 text-zinc-500" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold">
            {{ t("workload.compose.advanced.general") }}
          </h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ t("workload.compose.advanced.generalDescription") }}
          </p>
        </div>
      </div>

      <div class="mt-5 space-y-4">
        <div class="space-y-2">
          <Label for="compose-name">
            {{ t("workload.compose.general.stackName") }}
          </Label>
          <Input
            id="compose-name"
            v-model="name"
            :placeholder="t('workload.compose.create.namePlaceholder')"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            {{ t("workload.compose.advanced.stackNameBefore") }}
            <code class="font-mono">docker-compose</code
            >{{ t("workload.compose.advanced.stackNameAfter") }}
          </p>
        </div>

        <Button :disabled="isSaving || !name.trim()" @click="saveSettings">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:save" class="mr-2 h-4 w-4" />
          {{ t("workload.actions.saveChanges") }}
        </Button>
      </div>
    </div>

    <!--
      Run Command — free-text override for the docker suffix the
      deploy script runs. Matches dokploy's add-command card shape.
      Trust the operator: anything they type lands as `docker
      <run_command>` verbatim. Default Command hint comes from the
      live backend renderer so the suggestion can't drift from what
      a real deploy would do.
    -->
    <div class="rounded-lg border bg-card p-6">
      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10"
        >
          <Icon name="lucide:terminal" class="h-4 w-4 text-indigo-500" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold">
            {{ t("workload.compose.advanced.runCommand") }}
          </h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ t("workload.compose.advanced.runCommandDescriptionBefore") }}
            <code class="font-mono text-xs">docker</code
            >{{ t("workload.punctuation.period") }}
          </p>
        </div>
      </div>

      <div class="mt-5 space-y-4">
        <Alert
          class="border-amber-500/30 bg-amber-500/[0.06] text-amber-900 dark:text-amber-200"
        >
          <Icon
            name="lucide:triangle-alert"
            class="h-4 w-4 text-amber-600 dark:text-amber-400"
          />
          <AlertDescription class="text-sm">
            {{ t("workload.compose.advanced.runCommandWarningBefore") }}
            <strong>docker</strong>{{ t("workload.punctuation.period") }}
          </AlertDescription>
        </Alert>

        <div class="space-y-2">
          <Label for="compose-run-command">
            {{ t("workload.compose.advanced.command") }}
          </Label>
          <Input
            id="compose-run-command"
            v-model="runCommand"
            placeholder="compose -p my-stack -f docker-compose.yml up -d --build --no-cache"
            class="font-mono text-sm"
            autocomplete="off"
            spellcheck="false"
          />
          <p class="text-xs text-muted-foreground">
            <template v-if="defaultRunCommand">
              {{ t("workload.compose.advanced.defaultCommandBefore")
              }}<code class="font-mono">docker {{ defaultRunCommand }}</code
              >{{ t("workload.compose.advanced.defaultCommandAfter") }}
            </template>
            <template v-else>
              {{ t("workload.compose.advanced.defaultCommandHelp") }}
            </template>
          </p>
        </div>

        <div class="flex justify-end">
          <Button :disabled="isSavingRunCommand" @click="saveRunCommand">
            <Icon
              v-if="isSavingRunCommand"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:save" class="mr-2 h-4 w-4" />
            {{ t("workload.actions.save") }}
          </Button>
        </div>
      </div>
    </div>

    <!--
      Traefik dynamic-config card. Same shape as the application
      Advanced Traefik card — read-only by default, Modify reveals
      the editor + Save/Cancel in the footer. The
      SyncComposeTraefikConfig job populates this file from compose
      domain rows on every domain mutation and after every successful
      deploy, so manual edits get clobbered when domains change.
    -->
    <div class="rounded-lg border bg-card">
      <div class="flex items-start gap-3 p-4">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
        >
          <Icon name="lucide:route" class="h-4 w-4 text-zinc-500" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-base font-semibold">Traefik</h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            {{ t("workload.traefik.composeDescription") }}
            <span
              v-if="traefikFilename"
              class="ml-1 inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
              :title="`/etc/launch/traefik/dynamic/${traefikFilename}`"
            >
              <Icon name="lucide:file-text" class="h-3 w-3" />
              {{ traefikFilename }}
            </span>
          </p>
        </div>
      </div>

      <div class="space-y-2 px-4 pb-3">
        <div
          v-if="traefikLoading"
          class="flex h-72 items-center justify-center rounded-md border bg-muted/30"
        >
          <Icon
            name="lucide:loader-2"
            class="h-5 w-5 animate-spin text-muted-foreground"
          />
        </div>
        <div v-else-if="!traefikContent && !traefikEditing" class="relative">
          <div
            class="flex h-32 flex-col items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground"
          >
            <Icon name="lucide:route-off" class="mb-2 h-5 w-5" />
            {{ t("workload.compose.advanced.traefikEmpty") }}
          </div>
        </div>
        <div v-else class="relative">
          <Button
            v-if="!traefikEditing"
            size="sm"
            class="absolute right-2 top-2 z-10"
            @click="beginModifyTraefik"
          >
            <Icon name="lucide:pencil" class="mr-2 h-3.5 w-3.5" />
            {{ t("workload.traefik.modify") }}
          </Button>
          <SharedCodeEditor
            v-model="traefikContent"
            language="yaml"
            class="h-72 rounded-md border"
            :line-numbers="true"
            :disabled="!traefikEditing"
            placeholder="http:&#10;  routers:&#10;    ..."
          />
        </div>
      </div>

      <div
        v-if="traefikEditing"
        class="flex justify-end gap-2 border-t bg-muted/30 px-4 py-2"
      >
        <Button
          size="sm"
          variant="outline"
          :disabled="traefikSaving"
          @click="cancelModifyTraefik"
        >
          {{ t("workload.actions.cancel") }}
        </Button>
        <Button
          size="sm"
          :disabled="traefikSaving || !traefikDirty"
          @click="saveTraefikConfig"
        >
          <Icon
            v-if="traefikSaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          {{ t("workload.actions.save") }}
        </Button>
      </div>
    </div>

    <!--
      Danger Zone — wrapped in a destructive-tinted card so the
      visual weight matches the action. Mirrors the application
      Advanced danger zone shape.
    -->
    <div
      v-if="canDelete"
      class="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-6"
    >
      <h3 class="text-base font-semibold text-destructive">
        {{ t("workload.danger.title") }}
      </h3>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t("workload.compose.advanced.dangerDescription") }}
      </p>

      <Button
        class="mt-4"
        variant="destructive"
        :disabled="deleteLoading"
        @click="deleteCompose"
      >
        <Icon
          v-if="deleteLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        {{ t("workload.compose.advanced.deleteStack") }}
      </Button>
    </div>
  </div>
</template>

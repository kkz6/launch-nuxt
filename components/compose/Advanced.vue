<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Alert,
  AlertDescription,
} from "~/components/ui/alert";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

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
    toast.error("Stack name is required");
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
    toast.success("Compose stack updated");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update compose stack");
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
        ? "Run command updated"
        : "Run command cleared — using default on next deploy",
    );
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update run command");
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
const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const deleteCompose = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Compose Stack",
    description: `Are you sure you want to delete "${props.compose.name}"? The stack's containers will be torn down on the server.`,
    confirmText: "Delete Stack",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the stack name to confirm deletion:",
    inputVerificationText: props.compose.name,
    // Opt-in volume cleanup. Off by default so a misclicked Delete
    // preserves persistent data; the user has to explicitly tick the
    // box to wipe state. Backend toggles `docker compose down` ↔
    // `docker compose down -v` on this flag.
    checkbox: {
      label: "Also delete named volumes (data will be lost)",
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
        ? "Compose stack + volumes deletion queued"
        : "Compose stack deletion queued (volumes preserved)",
    );
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to delete compose stack");
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
          <h3 class="text-base font-semibold">General</h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Rename the stack. Source + compose body are immutable from
            this page — reconfigure by recreating the stack.
          </p>
        </div>
      </div>

      <div class="mt-5 space-y-4">
        <div class="space-y-2">
          <Label for="compose-name">Stack Name</Label>
          <Input
            id="compose-name"
            v-model="name"
            placeholder="e.g. monitoring, db-stack"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            Used as the <code class="font-mono">docker-compose</code>
            project name on the host.
          </p>
        </div>

        <Button :disabled="isSaving || !name.trim()" @click="saveSettings">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:save" class="mr-2 h-4 w-4" />
          Save Changes
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
          <h3 class="text-base font-semibold">Run Command</h3>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Override the custom command the deploy script runs after
            <code class="font-mono text-xs">docker</code>.
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
            Modifying the default command may affect deployment
            stability, impacting logs and monitoring. Proceed
            carefully and test thoroughly. By default, the command
            starts with <strong>docker</strong>.
          </AlertDescription>
        </Alert>

        <div class="space-y-2">
          <Label for="compose-run-command">Command</Label>
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
              Default Command (<code class="font-mono">docker {{ defaultRunCommand }}</code>)
            </template>
            <template v-else>
              Leave blank to use the default deploy command.
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
            Save
          </Button>
        </div>
      </div>
    </div>

    <!--
      Danger Zone — wrapped in a destructive-tinted card so the
      visual weight matches the action. Mirrors the application
      Advanced danger zone shape.
    -->
    <div class="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-6">
      <h3 class="text-base font-semibold text-destructive">Danger Zone</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Permanently delete this compose stack. Every container the stack
        runs is torn down on the server. Named volumes survive unless
        you opt in via the checkbox in the confirmation.
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
        Delete Stack
      </Button>
    </div>
  </div>
</template>

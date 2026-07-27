<script setup lang="ts">
import { reactive, toRefs } from "vue";
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
const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const { canDelete } = useCan();

interface ComposeAdvancedState {
  name: string;
  isSaving: boolean;
  runCommand: string;
  isSavingRunCommand: boolean;
  defaultRunCommand: string;
  deleteLoading: boolean;
  traefikFilename: string;
  traefikContent: string;
  traefikContentOnDisk: string;
  traefikLoading: boolean;
  traefikSaving: boolean;
  traefikEditing: boolean;
}

const state = reactive<ComposeAdvancedState>({
  name: props.compose.name,
  isSaving: false,
  runCommand: props.compose.run_command || "",
  isSavingRunCommand: false,
  defaultRunCommand: "",
  deleteLoading: false,
  traefikFilename: "",
  traefikContent: "",
  traefikContentOnDisk: "",
  traefikLoading: true,
  traefikSaving: false,
  traefikEditing: false,
});

const {
  name,
  isSaving,
  runCommand,
  isSavingRunCommand,
  defaultRunCommand,
  deleteLoading,
  traefikFilename,
  traefikContent,
  traefikContentOnDisk,
  traefikLoading,
  traefikSaving,
  traefikEditing,
} = toRefs(state);

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

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

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
    toast.success("Traefik config saved — Traefik picks it up automatically.");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save Traefik config");
  } finally {
    traefikSaving.value = false;
  }
};

onMounted(fetchTraefikConfig);

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
            Rename the stack. Source + compose body are immutable from this page
            — reconfigure by recreating the stack.
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
            Modifying the default command may affect deployment stability,
            impacting logs and monitoring. Proceed carefully and test
            thoroughly. By default, the command starts with
            <strong>docker</strong>.
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
              Default Command (<code class="font-mono"
                >docker {{ defaultRunCommand }}</code
              >)
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
            Modify the traefik config, in rare cases you may need to add
            specific config, be careful because modifying incorrectly can break
            traefik and your application.
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
            No Traefik config on this server yet. Add a domain on the Domains
            tab and the platform will write the file — or hit Modify to write it
            yourself.
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
            Modify
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
          Cancel
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
          Save
        </Button>
      </div>
    </div>

    <div
      v-if="canDelete"
      class="rounded-lg border border-destructive/30 bg-destructive/[0.03] p-6"
    >
      <h3 class="text-base font-semibold text-destructive">Danger Zone</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Permanently delete this compose stack. Every container the stack runs is
        torn down on the server. Named volumes survive unless you opt in via the
        checkbox in the confirmation.
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

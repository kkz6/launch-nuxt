<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { dockerService } from "~/services/dockerService";

/**
 * ServerDockerOrphanCleanup — Maintenance panel for cleaning up compose
 * resources left behind by failed/interrupted stack deletes.
 *
 * History: an earlier teardown script silently no-op'd when run without
 * a compose file in cwd, so containers kept running after their DB row
 * was deleted. This panel re-triggers the same label-based cleanup job
 * (driven by the compose project name alone), bypassing the missing
 * DB row entirely.
 *
 * UI follows the General settings shape — flat space-y-6 sections,
 * inline form fields, SharedConfirmationDialog for the destructive
 * confirm step (matches "Delete Server"). NOT in the Containers tab —
 * putting it there would suggest container lifecycle is managed at
 * that level, which it isn't.
 */

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

// Form state
const projectName = ref("");
const projectSlug = ref("");
const composeSlug = ref("");
const removeVolumes = ref(false);
const isSubmitting = ref(false);

// Confirmation dialog ref — same shared component the server-delete
// flow uses. Typed-confirmation guards against accidental clicks.
const confirmationDialog = ref<InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null>(null);

const canSubmit = computed(() => projectName.value.trim().length > 0);

const handleSubmit = async () => {
  if (!canSubmit.value || isSubmitting.value) return;
  if (!confirmationDialog.value) return;

  const name = projectName.value.trim();
  const result = await confirmationDialog.value.show({
    title: "Run Compose Cleanup",
    description: `This will remove every container, network${
      removeVolumes.value ? ", and volume" : ""
    } on the host carrying the label com.docker.compose.project=${name}. The action runs the same job used during a normal stack delete.`,
    confirmText: "Run cleanup",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the project name to confirm:",
    inputVerificationText: name,
  });

  if (!result.ok) return;

  isSubmitting.value = true;
  try {
    await dockerService.host.purgeComposeResources(props.serverId, {
      project_name: name,
      project_slug: projectSlug.value.trim() || undefined,
      compose_slug: composeSlug.value.trim() || undefined,
      remove_volumes: removeVolumes.value,
    });
    toast.success("Cleanup job queued — containers will be removed shortly");
    // Reset the form so a follow-up cleanup doesn't accidentally
    // re-target the previous name.
    projectName.value = "";
    projectSlug.value = "";
    composeSlug.value = "";
    removeVolumes.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to queue cleanup job");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Orphaned compose stacks — the only maintenance action for now -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Orphaned compose stacks</h3>
        <p class="text-sm text-muted-foreground">
          Re-run the compose teardown for a stack that's no longer in the UI
          but whose containers are still running on the host. The same job
          used during a normal stack delete is queued against the project
          name you provide.
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="orphan-project-name">Compose project name</Label>
          <Input
            id="orphan-project-name"
            v-model="projectName"
            placeholder="e.g. myproject-mystack"
            class="font-mono"
          />
          <p class="text-xs text-muted-foreground">
            The value of the
            <code class="rounded bg-muted px-1 py-0.5 text-xs">com.docker.compose.project</code>
            label — visible in the Containers tab.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="orphan-project-slug">
              Project slug
              <span class="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="orphan-project-slug"
              v-model="projectSlug"
              placeholder="e.g. myproject"
              class="font-mono"
            />
          </div>
          <div class="space-y-2">
            <Label for="orphan-compose-slug">
              Compose slug
              <span class="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="orphan-compose-slug"
              v-model="composeSlug"
              placeholder="e.g. mystack"
              class="font-mono"
            />
          </div>
        </div>
        <p class="text-xs text-muted-foreground -mt-2">
          When provided, also removes the stack directory at
          <code class="rounded bg-muted px-1 py-0.5 text-xs">/var/lib/launch/projects/&lt;project&gt;/&lt;compose&gt;</code>
          and the per-stack Traefik config file.
        </p>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>Remove volumes</Label>
            <p class="text-sm text-muted-foreground">
              Also delete named volumes the stack created. Cannot be undone.
            </p>
          </div>
          <Switch v-model="removeVolumes" />
        </div>

        <Button
          variant="destructive"
          :disabled="!canSubmit || isSubmitting"
          @click="handleSubmit"
        >
          <Icon
            v-if="isSubmitting"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:eraser" class="mr-2 h-4 w-4" />
          Run cleanup
        </Button>
      </div>
    </div>
  </div>
</template>

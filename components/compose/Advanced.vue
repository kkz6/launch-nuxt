<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
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
      Danger Zone is the only section here for now. Wrapped in a
      destructive-tinted card so the visual weight matches the action.
      Mirrors components/application/Advanced.vue's Danger Zone shape.
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

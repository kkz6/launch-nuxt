<script setup lang="ts">
import { toast } from "vue-sonner";
import { Separator } from "~/components/ui/separator";
import { dockerService, type DockerProject } from "~/services/dockerService";

interface Props {
  serverId: string;
  project: DockerProject;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const name = ref(props.project.name);
const description = ref(props.project.description ?? "");
const isLoading = ref(false);
const deleteLoading = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

// Keep refs in sync if the parent refetches.
watch(
  () => props.project,
  (p) => {
    name.value = p.name;
    description.value = p.description ?? "";
  },
);

const totalWorkloads = computed(
  () =>
    props.project.applications_count +
    props.project.composes_count +
    props.project.databases_count,
);
const canDelete = computed(() => totalWorkloads.value === 0);

// Per-kind breakdown for the yellow "cannot delete" callout — gives
// the user a precise list of what still has to go before they can
// remove the project.
const workloadSummary = computed(() => {
  const parts: string[] = [];
  const p = props.project;
  if (p.applications_count > 0)
    parts.push(`${p.applications_count} application${p.applications_count === 1 ? "" : "s"}`);
  if (p.composes_count > 0)
    parts.push(`${p.composes_count} compose stack${p.composes_count === 1 ? "" : "s"}`);
  if (p.databases_count > 0)
    parts.push(`${p.databases_count} database${p.databases_count === 1 ? "" : "s"}`);
  return parts.join(", ");
});

const updateProject = async () => {
  const trimmed = name.value.trim();
  if (!trimmed) {
    toast.error("Project name is required");
    return;
  }
  isLoading.value = true;
  try {
    await dockerService.projects.update(props.serverId, props.project.id, {
      name: trimmed,
      description: description.value.trim(),
    });
    toast.success("Project settings updated");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update project");
  } finally {
    isLoading.value = false;
  }
};

const deleteProject = async () => {
  if (!canDelete.value) {
    toast.error(
      `Cannot delete project: remove ${workloadSummary.value} first.`,
    );
    return;
  }
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Delete Project",
    description: `Are you sure you want to delete "${props.project.name}"? This action cannot be undone.`,
    confirmText: "Delete Project",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the project name to confirm deletion:",
    inputVerificationText: props.project.name,
  });
  if (!result.ok) return;

  deleteLoading.value = true;
  try {
    await dockerService.projects.delete(props.serverId, props.project.id);
    toast.success("Project deleted successfully");
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to delete project");
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <!--
    Mirrors components/server/settings/General.vue: top-level space-y-6,
    each section is a heading block + a space-y-4 form column, a single
    Separator before Danger Zone, and the yellow callout for "cannot
    delete" uses the exact same colour ramp. Keep it pixel-close so the
    docker workload pages feel native next to the server settings.
  -->
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Project Information -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Project Information</h3>
        <p class="text-sm text-muted-foreground">
          Update your project name and description.
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="project-name">Project Name</Label>
          <Input
            id="project-name"
            v-model="name"
            placeholder="Enter project name"
          />
        </div>

        <div class="space-y-2">
          <Label for="project-description">Description</Label>
          <Textarea
            id="project-description"
            v-model="description"
            placeholder="Enter a description for your project (optional)"
            :rows="3"
          />
        </div>

        <Button :disabled="isLoading" @click="updateProject">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save Changes
        </Button>
      </div>
    </div>

    <Separator />

    <!-- Danger Zone -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
        <p class="text-sm text-muted-foreground">
          Permanently delete this project. This action cannot be undone.
        </p>
      </div>

      <!--
        Yellow callout reuses the exact tone components/server/settings/
        General.vue uses for "cannot delete server" — so the blocked
        state feels consistent across servers + docker workloads.
      -->
      <div
        v-if="!canDelete"
        class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50"
      >
        <div class="space-y-1">
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Cannot delete project
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            This project has {{ workloadSummary }}. Please delete
            every workload before removing the project.
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        :disabled="!canDelete || deleteLoading"
        @click="deleteProject"
      >
        <Icon
          v-if="deleteLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        Delete Project
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
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

const form = reactive({
  name: props.project.name,
  description: props.project.description ?? "",
});
const isSaving = ref(false);

// Keep the form in sync if the parent refetches.
watch(
  () => props.project,
  (p) => {
    form.name = p.name;
    form.description = p.description ?? "";
  },
);

const isDirty = computed(
  () =>
    form.name.trim() !== props.project.name ||
    form.description.trim() !== (props.project.description ?? ""),
);

const save = async () => {
  const name = form.name.trim();
  if (!name) {
    toast.error("Project name is required");
    return;
  }
  isSaving.value = true;
  try {
    await dockerService.projects.update(props.serverId, props.project.id, {
      name,
      description: form.description.trim(),
    });
    toast.success("Project updated");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update project");
  } finally {
    isSaving.value = false;
  }
};

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const deleteProject = async () => {
  if (!confirmationDialog.value) return;
  const totalWorkloads =
    props.project.applications_count +
    props.project.composes_count +
    props.project.databases_count;
  const result = await confirmationDialog.value.show({
    title: "Delete Project",
    description:
      totalWorkloads > 0
        ? `This project has ${totalWorkloads} workload(s). Deleting it will remove them all.`
        : "This will permanently delete the project.",
    confirmText: "Delete project",
    cancelText: "Cancel",
    destructive: true,
    inputVerificationText: props.project.name,
    helpText: "Type the project name to confirm:",
  });
  if (!result.ok) return;

  try {
    await dockerService.projects.delete(props.serverId, props.project.id);
    toast.success("Project deleted");
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete project");
  }
};
</script>

<template>
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">General</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Rename the project or update its description.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="save">
        <div class="space-y-2">
          <Label for="settings-name">Name</Label>
          <Input
            id="settings-name"
            v-model="form.name"
            placeholder="e.g. acme-prod"
            autocomplete="off"
          />
        </div>
        <div class="space-y-2">
          <Label for="settings-description">Description</Label>
          <Textarea
            id="settings-description"
            v-model="form.description"
            rows="3"
            placeholder="What lives in this project?"
          />
        </div>
        <div class="flex justify-end">
          <Button type="submit" :disabled="!isDirty || isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save changes
          </Button>
        </div>
      </form>
    </section>

    <section
      class="rounded-lg border border-destructive/40 bg-destructive/5 p-6"
    >
      <h3 class="text-lg font-semibold text-destructive">Danger zone</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Deleting the project removes it and every workload it contains.
        This can't be undone.
      </p>
      <div class="mt-4 flex justify-end">
        <Button variant="destructive" @click="deleteProject">
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete project
        </Button>
      </div>
    </section>
  </div>
</template>

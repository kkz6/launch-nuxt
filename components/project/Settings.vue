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

const totalWorkloads = computed(
  () =>
    props.project.applications_count +
    props.project.composes_count +
    props.project.databases_count,
);

const deleteProject = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Project",
    description:
      totalWorkloads.value > 0
        ? `This project has ${totalWorkloads.value} workload(s). Deleting it will remove them all.`
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
    toast.error(e.data?.message || "Failed to update project");
  }
};
</script>

<template>
  <!--
    Settings page intentionally follows the SiteSettings layout: flat
    space-y-6 column, each section is a small h3 + paragraph + form
    block, sections separated by <Separator />, no boxed cards. The
    danger zone gets a destructive-coloured heading but no red panel.
  -->
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium">General</h3>
        <p class="text-sm text-muted-foreground">
          Rename this project or update its description.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="save">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <Label for="settings-name">Name</Label>
            <Input
              id="settings-name"
              v-model="form.name"
              placeholder="e.g. acme-prod"
              autocomplete="off"
            />
          </div>
          <div class="space-y-2 md:row-span-2">
            <Label for="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              v-model="form.description"
              rows="5"
              placeholder="What lives in this project?"
            />
          </div>
        </div>
        <Button type="submit" :disabled="!isDirty || isSaving">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Update settings
        </Button>
      </form>

      <Separator />

      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium text-destructive">Danger zone</h3>
          <p class="text-sm text-muted-foreground">
            {{
              totalWorkloads > 0
                ? `Permanently delete this project and the ${totalWorkloads} workload(s) it contains.`
                : "Permanently delete this project."
            }}
            This action can't be undone.
          </p>
        </div>
        <Button variant="destructive" @click="deleteProject">
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete project
        </Button>
      </div>
    </div>
  </div>
</template>

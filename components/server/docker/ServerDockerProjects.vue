<script setup lang="ts">
import { toast } from "vue-sonner";
import type { Server } from "~/types";
import { dockerService, type DockerProject } from "~/services/dockerService";

interface Props {
  server: Server;
}

const props = defineProps<Props>();

const projects = ref<DockerProject[]>([]);
const isLoading = ref(true);

// Create dialog state. We keep a local form so the dialog is self-contained
// and reset between opens — no zod schema for phase 1 since the only field
// with a non-trivial rule is the server-side uniqueness check.
const createOpen = ref(false);
const isCreating = ref(false);
const form = reactive({ name: "", description: "" });

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchProjects = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.projects.list(props.server.id);
    projects.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load projects");
  } finally {
    isLoading.value = false;
  }
};

const openCreate = () => {
  form.name = "";
  form.description = "";
  createOpen.value = true;
};

const submitCreate = async () => {
  const name = form.name.trim();
  if (!name) {
    toast.error("Project name is required");
    return;
  }

  isCreating.value = true;
  try {
    const res = await dockerService.projects.create(props.server.id, {
      name,
      description: form.description.trim() || undefined,
    });
    // Prepend so the new project is the top card without a full refetch.
    // The WS broadcast (docker.project.created) will also update other open
    // tabs once we wire useDockerProjectEvents in a later phase.
    projects.value = [res.data, ...projects.value];
    toast.success("Project created");
    createOpen.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to create project");
  } finally {
    isCreating.value = false;
  }
};

const deleteProject = async (project: DockerProject) => {
  if (!confirmationDialog.value) return;
  const totalWorkloads =
    project.applications_count + project.composes_count + project.databases_count;
  const result = await confirmationDialog.value.show({
    title: "Delete Project",
    description:
      totalWorkloads > 0
        ? `Are you sure you want to delete "${project.name}"? It still has ${totalWorkloads} workload(s) — they will be removed too.`
        : `Are you sure you want to delete "${project.name}"?`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
    inputVerificationText: project.name,
    helpText: "Type the project name to confirm:",
  });
  if (!result.ok) return;

  try {
    await dockerService.projects.delete(props.server.id, project.id);
    projects.value = projects.value.filter((p) => p.id !== project.id);
    toast.success("Project deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete project");
  }
};

const formatDate = (iso?: string): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
};

onMounted(fetchProjects);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold">Projects</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Group docker workloads — applications, compose stacks, and databases.
        </p>
      </div>
      <Button @click="openCreate">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Project
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="projects.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:folder-tree" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No projects yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Create your first project to start grouping applications, compose
        stacks, and databases on this server.
      </p>
      <Button class="mt-6" @click="openCreate">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Project
      </Button>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="project in projects"
        :key="project.id"
        :to="`/servers/${props.server.id}/projects/${project.id}`"
        class="group block rounded-lg border bg-card p-5 transition hover:border-primary"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold group-hover:text-primary">
              {{ project.name }}
            </h3>
            <p
              v-if="project.description"
              class="mt-1 line-clamp-2 text-sm text-muted-foreground"
            >
              {{ project.description }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="ml-2 shrink-0 opacity-0 transition group-hover:opacity-100"
            @click.prevent="deleteProject(project)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </div>

        <div class="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <Icon name="lucide:box" class="h-3.5 w-3.5" />
            {{ project.applications_count }} app{{ project.applications_count === 1 ? "" : "s" }}
          </span>
          <span class="flex items-center gap-1">
            <Icon name="lucide:layers" class="h-3.5 w-3.5" />
            {{ project.composes_count }} compose
          </span>
          <span class="flex items-center gap-1">
            <Icon name="lucide:database" class="h-3.5 w-3.5" />
            {{ project.databases_count }} db
          </span>
        </div>

        <p class="mt-3 text-xs text-muted-foreground">
          Created {{ formatDate(project.created_at) }}
        </p>
      </NuxtLink>
    </div>

    <Dialog v-model:open="createOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            A project groups docker applications, compose stacks, and
            databases running on this server.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitCreate">
          <div class="space-y-2">
            <Label for="project-name">Name</Label>
            <Input
              id="project-name"
              v-model="form.name"
              placeholder="e.g. acme-prod"
              autocomplete="off"
              required
            />
            <p class="text-xs text-muted-foreground">
              Must be unique on this server.
            </p>
          </div>
          <div class="space-y-2">
            <Label for="project-description">Description (optional)</Label>
            <Textarea
              id="project-description"
              v-model="form.description"
              placeholder="What lives in this project?"
              rows="3"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isCreating"
              @click="createOpen = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isCreating">
              <Icon
                v-if="isCreating"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

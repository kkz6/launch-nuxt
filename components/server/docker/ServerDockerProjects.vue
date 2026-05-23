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

// Click handler that pushes to the project detail page. We don't wrap
// the card in <NuxtLink> because the inner delete button needs its own
// click target — same pattern as pages/servers/index.vue. Returns true
// so the @click is treated as handled; nested @click.prevent.stop on
// the action button does the bubbling guard.
const goToProject = (project: DockerProject) => {
  navigateTo(`/servers/${props.server.id}/projects/${project.id}`);
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

    <!--
      Card layout mirrors pages/servers/index.vue:
      - outer wrapper holds the click handler (cursor-pointer, group)
      - inner div is the visible card with bg-card + hover:bg-muted/50
      - icon block on the left (brand-icon-bg fills on hover via the
        CSS rule at the bottom of this file)
      - name + subtitle stack to the right
      - bottom row pinned via mt-auto: workload stats on the left,
        created date on the right
    -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="project in projects"
        :key="project.id"
        class="group block h-full cursor-pointer"
        @click="goToProject(project)"
      >
        <div
          class="relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <!-- Delete action, top-right. pointer-events-auto so the
               outer card click doesn't swallow it; .stop guards the
               navigateTo path. -->
          <Button
            variant="ghost"
            size="icon"
            class="pointer-events-auto absolute right-3 top-3 z-10 h-7 w-7 text-muted-foreground opacity-0 transition group-hover:opacity-100"
            title="Delete project"
            @click.prevent.stop="deleteProject(project)"
          >
            <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
          </Button>

          <div class="relative flex items-start gap-3">
            <div
              class="brand-icon-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors duration-200"
            >
              <Icon
                name="lucide:folder-tree"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
              />
            </div>
            <div class="min-w-0 flex-1 pr-6">
              <h3 class="truncate font-semibold">{{ project.name }}</h3>
              <p
                v-if="project.description"
                class="line-clamp-1 text-sm text-muted-foreground"
              >
                {{ project.description }}
              </p>
              <p v-else class="text-sm text-muted-foreground">
                No description
              </p>
            </div>
          </div>

          <div class="relative mt-auto flex min-h-7 items-center justify-between pt-4 text-sm">
            <div class="flex items-center gap-4 text-muted-foreground">
              <span class="flex items-center gap-1.5" title="Applications">
                <Icon name="lucide:box" class="h-3.5 w-3.5" />
                {{ project.applications_count }}
              </span>
              <span class="flex items-center gap-1.5" title="Compose stacks">
                <Icon name="lucide:layers" class="h-3.5 w-3.5" />
                {{ project.composes_count }}
              </span>
              <span class="flex items-center gap-1.5" title="Databases">
                <Icon name="lucide:database" class="h-3.5 w-3.5" />
                {{ project.databases_count }}
              </span>
            </div>
            <span class="text-xs text-muted-foreground">
              {{ formatDate(project.created_at) }}
            </span>
          </div>
        </div>
      </div>
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

<style scoped>
/*
  Hover-fill for the icon block, matching the server cards. Uses the
  theme primary as the highlight tone — projects don't have a per-row
  brand colour the way servers do (one per provider), so a single
  shared accent reads cleanly across the grid.
*/
.group:hover .brand-icon-bg {
  background-color: hsl(var(--primary));
}

.group:hover .brand-icon {
  color: hsl(var(--primary-foreground));
}
</style>

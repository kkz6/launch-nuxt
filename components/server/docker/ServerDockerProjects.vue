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

// Bumped by the navbar's New Project button (ServerDockerCreateProject)
// after a successful create. Same convention sitesRefreshKey uses for
// the Sites tab — keeps the navbar action loosely coupled to the page
// component, no event-bus needed.
const refreshKey = useState<number>("dockerProjectsRefreshKey", () => 0);
watch(refreshKey, () => {
  void fetchProjects(true);
});

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
    <!--
      No section heading and no inline "New Project" button — the
      action lives in the navbar (ServerDockerCreateProject) next to
      Terminal / Provision so it's symmetric with how Sites work.
      Empty state below points the user at the navbar action.
    -->


    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <!--
      Empty state mirrors ShowSites.vue: tall card with a single
      icon and a one-line hint. The New Project button is already
      in the toolbar above so we don't repeat it here.
    -->
    <div
      v-else-if="projects.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:folder-tree" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">No projects yet</p>
        <p class="text-sm text-muted-foreground">
          Click on New Project to get started
        </p>
      </div>
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
          <!--
            Delete deliberately omitted from the card. The destructive
            flow lives on the project detail page's Settings subtab,
            same shape as Sites where individual deletion happens
            from the site detail page rather than the index. Keeps
            mis-clicks on a crowded grid from removing infra.
          -->
          <div class="relative flex items-start gap-3">
            <div
              class="brand-icon-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors duration-200"
            >
              <Icon
                name="lucide:folder-tree"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
              />
            </div>
            <div class="min-w-0 flex-1">
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

    <!-- The create dialog lives in ServerDockerCreateProject (mounted
         from the navbar), so nothing more here. -->
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

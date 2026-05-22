<script setup lang="ts">
import { toast } from "vue-sonner";
import { dockerService, type DockerProject } from "~/services/dockerService";
import type { Server } from "~/types";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);

const server = ref<Server | null>(null);
const project = ref<DockerProject | null>(null);
const isLoading = ref(true);

const VALID_TABS = [
  "overview",
  "applications",
  "compose",
  "databases",
  "settings",
] as const;
type TabId = (typeof VALID_TABS)[number];

const initialTab = (): TabId => {
  const q = route.query.tab as string;
  return (VALID_TABS as readonly string[]).includes(q) ? (q as TabId) : "overview";
};
const activeTab = ref<TabId>(initialTab());

watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } });
});

watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && (VALID_TABS as readonly string[]).includes(newTab as string)) {
      activeTab.value = newTab as TabId;
    }
  },
);

const fetchData = async () => {
  try {
    const [s, p] = await Promise.all([
      $api<{ data: Server }>(`/servers/${serverId.value}`),
      dockerService.projects.get(serverId.value, projectId.value),
    ]);
    server.value = s.data;
    project.value = p.data;
    useHead({ title: project.value.name || "Project" });
  } catch {
    toast.error("Project not found");
    navigateTo(`/servers/${serverId.value}`);
    return;
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchData);
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="project && server" class="space-y-6 pb-10">
    <!-- Header. The breadcrumb / nav crumb on Navbar already handles
         "Servers / {server} / {project}", so here we just show the name +
         description. -->
    <div class="flex items-start justify-between">
      <div>
        <NuxtLink
          :to="`/servers/${serverId}?tab=projects`"
          class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Icon name="lucide:arrow-left" class="h-4 w-4" />
          Back to projects
        </NuxtLink>
        <h1 class="text-3xl font-semibold">{{ project.name }}</h1>
        <p
          v-if="project.description"
          class="mt-1 text-sm text-muted-foreground"
        >
          {{ project.description }}
        </p>
      </div>
    </div>

    <!-- Tab bar.  Stays inline (not in Navbar) because the project tabs are
         lightweight — wiring them through Navbar adds two more route guards
         for what is essentially anchor navigation. -->
    <div class="flex gap-6 border-b">
      <button
        v-for="tab in VALID_TABS"
        :key="tab"
        class="border-b-2 px-1 pb-3 text-sm capitalize transition-colors"
        :class="
          activeTab === tab
            ? 'border-primary font-medium text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Tab content.  Phase 1: only Settings (rename/delete) and a stub
         Overview render real UI.  Applications / Compose / Databases use
         the shared ComingSoon component until later phases land. -->
    <div v-if="activeTab === 'overview'">
      <ProjectOverview :project="project" />
    </div>

    <div v-else-if="activeTab === 'applications'">
      <ProjectApplications :server-id="serverId" :project-id="projectId" />
    </div>

    <div v-else-if="activeTab === 'compose'">
      <ProjectComposes :server-id="serverId" :project-id="projectId" />
    </div>

    <div v-else-if="activeTab === 'databases'">
      <ServerDockerComingSoon
        title="Databases"
        description="Spin up managed Postgres, MySQL, MariaDB, Redis, or Mongo containers."
        icon="lucide:database"
      />
    </div>

    <div v-else-if="activeTab === 'settings'">
      <ProjectSettings
        :server-id="serverId"
        :project="project"
        @updated="fetchData"
        @deleted="navigateTo(`/servers/${serverId}?tab=projects`)"
      />
    </div>
  </div>
</template>

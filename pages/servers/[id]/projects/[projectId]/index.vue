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

  <!--
    Page chrome (breadcrumb, name, tab strip, action buttons) is in
    the Navbar — same convention the site detail page uses. The page
    itself just routes the active tab to a content component.
  -->
  <div v-else-if="project && server" class="pb-10">
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
      <ProjectDatabases :server-id="serverId" :project-id="projectId" />
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

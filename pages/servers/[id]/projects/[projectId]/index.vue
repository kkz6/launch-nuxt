<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { dockerService, type DockerProject } from "~/services/dockerService";
import type { Server } from "~/types";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
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
  return (VALID_TABS as readonly string[]).includes(q)
    ? (q as TabId)
    : "overview";
};
const activeTab = ref<TabId>(initialTab());

watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } });
});

watch(
  () => route.query.tab,
  (newTab) => {
    if (
      newTab &&
      (VALID_TABS as readonly string[]).includes(newTab as string)
    ) {
      activeTab.value = newTab as TabId;
    }
  },
);

let resourceRequest = 0;
onScopeDispose(() => {
  resourceRequest++;
});
const fetchData = async (silent = false) => {
  const request = ++resourceRequest;
  try {
    const [s, p] = await Promise.all([
      $api<{ data: Server }>(`/servers/${serverId.value}`),
      dockerService.projects.get(serverId.value, projectId.value),
    ]);
    if (request !== resourceRequest) return;
    server.value = s.data;
    project.value = p.data;
    useHead(() => ({
      title: project.value?.name || t("server.project.fallbackTitle"),
    }));
  } catch (error: unknown) {
    if (request !== resourceRequest) return;
    const status =
      (error as { status?: number; statusCode?: number }).status ||
      (error as { statusCode?: number }).statusCode;
    if (silent && status !== 404) return;
    toast.error(t("server.project.notFound"));
    navigateTo(`/servers/${serverId.value}`);
    return;
  } finally {
    if (request === resourceRequest) isLoading.value = false;
  }
};

onMounted(fetchData);
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const refreshProject = useLiveRefresh(() => fetchData(true));
useChannelEvents(
  computed(() => `team.${teamId.value}`),
  [
    "docker.project.updated",
    "docker.project.deleted",
    "docker.application.created",
    "docker.application.deleted",
    "docker.compose.created",
    "docker.compose.deleted",
    "docker.database.created",
    "docker.database.deleted",
  ],
  (data, event) => {
    if (data.server_id && data.server_id !== serverId.value) return;
    const id =
      data.project_id ||
      (event.startsWith("docker.project.") ? data.id : undefined);
    if (id !== projectId.value) return;
    if (event === "docker.project.deleted") {
      navigateTo(`/servers/${serverId.value}?tab=projects`);
      return;
    }
    refreshProject();
  },
  { onReconnect: refreshProject },
);

// Shared bus the navbar's Environment button flips. Owned by the
// navbar so it's reachable from any project tab; the Dialog renders
// here so it has the project context (server / project ids) without
// the navbar having to know.
const dockerProjectEnvOpen = useState<boolean>(
  "dockerProjectEnvOpen",
  () => false,
);
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <!--
      Page chrome (breadcrumb, name, tab strip, action buttons) is in
      the Navbar — same convention the site detail page uses. The page
      itself just routes the active tab to a content component.
    -->
    <div v-else-if="project && server" class="pb-10">
      <div v-if="activeTab === 'overview'">
        <ProjectOverview :server-id="serverId" :project="project" />
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

    <!--
      Project-level env vars dialog. Triggered by the Environment
      button in the navbar (which flips the `dockerProjectEnvOpen`
      useState bus). Lives here so it has the project context
      without bloating the navbar with project-state fetches.
    -->
    <Dialog v-model:open="dockerProjectEnvOpen">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="text-base">
            {{ t("server.project.environmentTitle") }}
          </DialogTitle>
          <DialogDescription class="text-xs">
            {{ t("server.project.environmentDescriptionBefore") }}
            <code class="rounded bg-muted px-1 py-0.5 text-[11px]" v-pre
              >${{ project.KEY }}</code
            >
            {{ t("server.project.environmentDescriptionAfter") }}
          </DialogDescription>
        </DialogHeader>
        <ProjectEnvironment
          v-if="project"
          :server-id="serverId"
          :project-id="projectId"
        />
      </DialogContent>
    </Dialog>

    <!--
      No Terminal mount at the project level — a project isn't a
      shellable thing. Per-workload Terminal lives on the database /
      application detail pages and opens the container shell.
    -->
  </div>
</template>

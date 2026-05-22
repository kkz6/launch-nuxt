<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();

const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const applicationId = computed(() => route.params.applicationId as string);

const app = ref<DockerApplication | null>(null);
const isLoading = ref(true);

const SUBTABS = [
  { value: "general", label: "General", icon: "lucide:info" },
  { value: "deployments", label: "Deployments", icon: "lucide:git-branch" },
  { value: "environment", label: "Environment", icon: "lucide:key" },
  { value: "domains", label: "Domains", icon: "lucide:globe" },
  { value: "logs", label: "Logs", icon: "lucide:scroll" },
  { value: "volumes", label: "Volumes", icon: "lucide:hard-drive" },
  { value: "schedules", label: "Schedules", icon: "lucide:clock" },
  { value: "advanced", label: "Advanced", icon: "lucide:sliders-horizontal" },
] as const;
type SubTabId = (typeof SUBTABS)[number]["value"];

const validIds = SUBTABS.map((s) => s.value);
const initial = (): SubTabId => {
  const q = route.query.subtab as string;
  return (validIds as readonly string[]).includes(q) ? (q as SubTabId) : "general";
};
const subTab = ref<SubTabId>(initial());
watch(subTab, (v) => {
  router.replace({ query: { ...route.query, subtab: v } });
});

// Header-level "Deploy" button. Flip subtab to Deployments after kick-off
// so the user lands on the live history table.
const isDeploying = ref(false);
const quickDeploy = async () => {
  if (!app.value) return;
  isDeploying.value = true;
  try {
    await dockerService.applications.deploy(
      app.value.server_id,
      app.value.project_id,
      app.value.id,
    );
    subTab.value = "deployments";
    toast.success("Deployment started");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to start deployment");
  } finally {
    isDeploying.value = false;
  }
};

// Reload from the route — keeps the back-button working when navigating
// between sibling applications.
const fetchApp = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.get(
      serverId.value,
      projectId.value,
      applicationId.value,
    );
    app.value = res.data;
    useHead({ title: app.value.name });
  } catch {
    toast.error("Application not found");
    navigateTo(
      `/servers/${serverId.value}/projects/${projectId.value}?tab=applications`,
    );
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchApp);

// Subtabs that have a real implementation in phase 2b/2c. The rest
// still render the ComingSoon placeholder until later slices fill them
// in. Bump entries as each subtab goes live so the routing here stays
// a single source of truth.
const READY_SUBTABS: Record<string, boolean> = {
  general: true,
  deployments: true,
  domains: true,
  logs: true,
  environment: true,
  volumes: true,
};

// Refetch the application when WS events tell us its status changed —
// the header status badge stays accurate without a manual refresh.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

useDockerApplicationEvents(teamId, (data) => {
  if (data.application_id !== applicationId.value) return;
  // Status fields live on the application row; the Deployments tab
  // owns deployment-history refetches.
  if (
    data.status === "running" ||
    data.status === "failed" ||
    data.status === "building" ||
    data.status === "stopped"
  ) {
    void fetchApp();
  }
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="app" class="space-y-6 pb-10">
    <NuxtLink
      :to="`/servers/${serverId}/projects/${projectId}?tab=applications`"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon name="lucide:arrow-left" class="h-4 w-4" />
      Back to project
    </NuxtLink>

    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold">{{ app.name }}</h1>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="{
              'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400':
                app.status === 'running',
              'bg-amber-500/15 text-amber-700 dark:text-amber-400':
                app.status === 'idle' || app.status === 'building',
              'bg-rose-500/15 text-rose-700 dark:text-rose-400':
                app.status === 'failed',
              'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300':
                app.status === 'stopped',
            }"
          >
            {{ app.status }}
          </span>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          Source: {{ app.source_type }}
        </p>
      </div>

      <Button
        :disabled="app.status === 'building' || isDeploying"
        @click="quickDeploy"
      >
        <Icon
          v-if="isDeploying || app.status === 'building'"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:rocket" class="mr-2 h-4 w-4" />
        {{ app.last_deployed_at ? "Redeploy" : "Deploy" }}
      </Button>
    </div>

    <div class="flex flex-wrap gap-4 border-b">
      <button
        v-for="tab in SUBTABS"
        :key="tab.value"
        class="flex items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors"
        :class="
          subTab === tab.value
            ? 'border-primary font-medium text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click="subTab = tab.value"
      >
        <Icon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </button>
    </div>

    <ApplicationGeneral
      v-if="subTab === 'general'"
      :application="app"
      @updated="fetchApp"
    />

    <ApplicationDeployments
      v-else-if="subTab === 'deployments'"
      :application="app"
    />

    <ApplicationDomains
      v-else-if="subTab === 'domains'"
      :application="app"
    />

    <ApplicationEnvironment
      v-else-if="subTab === 'environment'"
      :application="app"
    />

    <ApplicationVolumes v-else-if="subTab === 'volumes'" :application="app" />

    <ApplicationLogs v-else-if="subTab === 'logs'" :application="app" />

    <ServerDockerComingSoon
      v-else-if="!READY_SUBTABS[subTab]"
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      description="This tab will be wired up in a later phase. See the design doc for the full plan."
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />
  </div>
</template>

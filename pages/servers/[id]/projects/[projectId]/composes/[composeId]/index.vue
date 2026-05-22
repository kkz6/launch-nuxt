<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const composeId = computed(() => route.params.composeId as string);

const compose = ref<DockerCompose | null>(null);
const isLoading = ref(true);
const isDeploying = ref(false);

const SUBTABS = [
  { value: "general", label: "General", icon: "lucide:info" },
  { value: "deployments", label: "Deployments", icon: "lucide:git-branch" },
  { value: "environment", label: "Environment", icon: "lucide:key" },
  { value: "domains", label: "Domains", icon: "lucide:globe" },
  { value: "logs", label: "Logs", icon: "lucide:scroll" },
  { value: "schedules", label: "Schedules", icon: "lucide:clock" },
] as const;
type SubTabId = (typeof SUBTABS)[number]["value"];

// Phase 2h ships General + Deployments. Logs/env/domains/schedules
// arrive in later slices when we figure out the multi-service UX —
// a compose stack has N services, so per-service routing is the open
// design question.
const READY_SUBTABS: Record<string, boolean> = {
  general: true,
  deployments: true,
  logs: true,
};

const validIds = SUBTABS.map((s) => s.value);
const initial = (): SubTabId => {
  const q = route.query.subtab as string;
  return (validIds as readonly string[]).includes(q) ? (q as SubTabId) : "general";
};
const subTab = ref<SubTabId>(initial());
watch(subTab, (v) => {
  router.replace({ query: { ...route.query, subtab: v } });
});

const fetchCompose = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.composes.get(
      serverId.value,
      projectId.value,
      composeId.value,
    );
    compose.value = res.data;
    useHead({ title: compose.value.name });
  } catch {
    toast.error("Compose stack not found");
    navigateTo(
      `/servers/${serverId.value}/projects/${projectId.value}?tab=compose`,
    );
  } finally {
    isLoading.value = false;
  }
};

const quickDeploy = async () => {
  if (!compose.value) return;
  isDeploying.value = true;
  try {
    await dockerService.composes.deploy(
      compose.value.server_id,
      compose.value.project_id,
      compose.value.id,
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

onMounted(fetchCompose);

const statusBadge = computed(() => {
  if (!compose.value) return "";
  switch (compose.value.status) {
    case "running":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "building":
    case "idle":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "stopped":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted text-muted-foreground";
  }
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="compose" class="space-y-6 pb-10">
    <NuxtLink
      :to="`/servers/${serverId}/projects/${projectId}?tab=compose`"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon name="lucide:arrow-left" class="h-4 w-4" />
      Back to project
    </NuxtLink>

    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold">{{ compose.name }}</h1>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="statusBadge"
          >
            {{ compose.status }}
          </span>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          Source: {{ compose.compose_source_type === "git" ? "git" : "inline YAML" }}
        </p>
      </div>

      <Button
        :disabled="compose.status === 'building' || isDeploying"
        @click="quickDeploy"
      >
        <Icon
          v-if="isDeploying || compose.status === 'building'"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:rocket" class="mr-2 h-4 w-4" />
        {{ compose.last_deployed_at ? "Redeploy" : "Deploy" }}
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

    <ComposeGeneral
      v-if="subTab === 'general'"
      :compose="compose"
      @updated="fetchCompose"
    />

    <ComposeDeployments
      v-else-if="subTab === 'deployments'"
      :compose="compose"
    />

    <ComposeLogs v-else-if="subTab === 'logs'" :compose="compose" />

    <ServerDockerComingSoon
      v-else-if="!READY_SUBTABS[subTab]"
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      description="Compose subtab is per-service which needs its own design pass — landing in a future slice."
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />
  </div>
</template>

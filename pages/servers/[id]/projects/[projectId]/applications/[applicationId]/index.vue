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

// Subtabs that have a real implementation in phase 2a. The rest still
// render the ComingSoon placeholder until later slices fill them in.
const READY_SUBTABS: Record<string, boolean> = {
  general: true,
};
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

    <div class="flex items-start justify-between">
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

    <ServerDockerComingSoon
      v-else-if="!READY_SUBTABS[subTab]"
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      description="This tab will be wired up in a later phase. See the design doc for the full plan."
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />
  </div>
</template>

<script setup lang="ts">
// Phase 1 scaffold for a single docker application. Every subtab is a
// placeholder right now — see the design doc for the eventual layout.

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();

const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const applicationId = computed(() => route.params.applicationId as string);

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

useHead({ title: "Application" });
</script>

<template>
  <div class="space-y-6 pb-10">
    <NuxtLink
      :to="`/servers/${serverId}/projects/${projectId}`"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon name="lucide:arrow-left" class="h-4 w-4" />
      Back to project
    </NuxtLink>

    <div>
      <h1 class="text-3xl font-semibold">Application</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        ID: {{ applicationId }}
      </p>
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

    <ServerDockerComingSoon
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      description="This tab will be wired up in a later phase. See the design doc for the full plan."
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />
  </div>
</template>

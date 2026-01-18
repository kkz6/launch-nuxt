<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Bell,
  CheckCircle,
  Database,
  FastForward,
  GitBranch,
  Globe,
  Server,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({
  title: "Onboarding",
});

const { fetchUser } = useAuth();
const router = useRouter();
const { open: openSettings } = useSettingsSheet();

interface OnboardingData {
  serverProviders: number;
  sourceControls: number;
  domainProviders: number;
  storageProviders: number;
  notificationChannels: number;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: typeof Server;
  completedKey: keyof OnboardingData;
  href?: string;
  settingsTab?: string;
}

const onboardingData = ref<OnboardingData>({
  serverProviders: 0,
  sourceControls: 0,
  domainProviders: 0,
  storageProviders: 0,
  notificationChannels: 0,
});

const isLoadingData = ref(true);

const stepDefinitions: Omit<OnboardingStep, "completed">[] = [
  {
    id: "server-provider",
    title: "Server service provider",
    description: "Connect your cloud provider to deploy servers",
    icon: Server,
    completedKey: "serverProviders",
    settingsTab: "connections",
  },
  {
    id: "git-provider",
    title: "Git provider",
    description: "Link your GitHub, GitLab or Bitbucket account",
    icon: GitBranch,
    completedKey: "sourceControls",
    settingsTab: "connections",
  },
  {
    id: "domain-provider",
    title: "Domain provider",
    description: "Configure DNS management for your domains",
    icon: Globe,
    completedKey: "domainProviders",
    href: "/dns",
  },
  {
    id: "storage-provider",
    title: "Storage Provider",
    description: "Set up backup and file storage solutions",
    icon: Database,
    completedKey: "storageProviders",
    settingsTab: "connections",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure alerts and notification preferences",
    icon: Bell,
    completedKey: "notificationChannels",
    settingsTab: "notifications",
  },
];

const steps = computed(() =>
  stepDefinitions.map((step) => ({
    ...step,
    completed: onboardingData.value[step.completedKey] > 0,
  }))
);


const handleStepClick = (step: OnboardingStep & { completed: boolean }) => {
  if (step.settingsTab) {
    openSettings(step.settingsTab);
  } else if (step.href) {
    router.push(step.href);
  }
};

const isLoading = ref(false);

const fetchOnboardingStatus = async () => {
  try {
    const response = await $api<{
      data: {
        server_providers_count: number;
        source_controls_count: number;
        domain_providers_count: number;
        storage_providers_count: number;
        notification_channels_count: number;
      };
    }>("/onboarding/status");
    onboardingData.value = {
      serverProviders: response.data.server_providers_count || 0,
      sourceControls: response.data.source_controls_count || 0,
      domainProviders: response.data.domain_providers_count || 0,
      storageProviders: response.data.storage_providers_count || 0,
      notificationChannels: response.data.notification_channels_count || 0,
    };
  } catch {
    // If the endpoint doesn't exist, just show empty onboarding
  } finally {
    isLoadingData.value = false;
  }
};

const handleSkip = async () => {
  isLoading.value = true;
  try {
    await $api("/onboarding/complete", { method: "POST" });
    await fetchUser();
    router.push("/dashboard");
  } catch {
    // If endpoint doesn't exist, just redirect
    router.push("/dashboard");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchOnboardingStatus();
});
</script>

<template>
  <div class="pb-10">
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Onboarding</h1>
        <Button
          variant="ghost"
          size="sm"
          :disabled="isLoading"
          class="gap-2 text-muted-foreground hover:text-foreground"
          @click="handleSkip"
        >
          <FastForward class="h-4 w-4" />
          Skip for now
        </Button>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        Complete these steps to get the best experience
      </p>
    </div>

    <div v-if="isLoadingData" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div v-else class="rounded-lg border bg-card">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="group flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
          :class="{ 'border-b': index < steps.length - 1 }"
          @click="handleStepClick(step)"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors"
              :class="step.completed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'"
            >
              <CheckCircle
                v-if="step.completed"
                class="h-4 w-4 text-green-600 dark:text-green-400"
              />
              <component
                :is="step.icon"
                v-else
                class="h-4 w-4 text-muted-foreground"
              />
            </div>
            <div class="min-w-0">
              <span
                class="text-sm font-medium"
                :class="step.completed ? 'text-muted-foreground' : ''"
              >
                {{ step.title }}
              </span>
              <p class="text-xs text-muted-foreground">
                {{ step.description }}
              </p>
            </div>
          </div>
          <Icon
            name="lucide:chevron-right"
            class="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </div>
    </div>
  </div>
</template>

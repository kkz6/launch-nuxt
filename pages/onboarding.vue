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
import { Badge } from "~/components/ui/badge";
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
    toast.success("Onboarding completed");
    router.push("/servers");
  } catch {
    // If endpoint doesn't exist, just redirect
    router.push("/servers");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchOnboardingStatus();
});
</script>

<template>
  <div class="w-full space-y-6">
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-2xl font-bold">Onboarding</h2>
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

    <div class="space-y-1">
      <p class="text-sm text-muted-foreground">
        To get the best experience, please complete these onboarding steps
        below:
      </p>
    </div>

    <div v-if="isLoadingData" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="step in steps"
        :key="step.id"
        class="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50"
      >
        <div class="flex items-center gap-4">
          <div
            :class="[
              'flex items-center justify-center rounded-full p-2',
              step.completed
                ? 'bg-green-100 dark:bg-green-900/20'
                : 'bg-muted',
            ]"
          >
            <CheckCircle
              v-if="step.completed"
              class="h-5 w-5 text-green-600 dark:text-green-400"
            />
            <component
              :is="step.icon"
              v-else
              class="h-5 w-5 text-muted-foreground"
            />
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h4 class="font-medium">{{ step.title }}</h4>
              <Badge
                v-if="step.completed"
                variant="outline"
                class="px-2 py-0 text-xs"
              >
                Done
              </Badge>
            </div>
            <p class="text-sm text-muted-foreground">
              {{ step.description }}
            </p>
          </div>
        </div>
        <Button
          :variant="step.completed ? 'outline' : 'default'"
          size="sm"
          class="shrink-0"
          @click="handleStepClick(step)"
        >
          {{ step.completed ? "Review" : "Start" }}
        </Button>
      </div>
    </div>
  </div>
</template>

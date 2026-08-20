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

const { t } = useI18n();

useHead(() => ({
  title: t("public.onboarding.pageTitle"),
}));

const { fetchUser } = useAuth();
const router = useRouter();
const { open: openSettings } = useSettingsSheet();

interface OnboardingData {
  hasServerProvider: boolean;
  hasSourceControl: boolean;
  hasDomainProvider: boolean;
  hasStorageProvider: boolean;
  hasNotificationChannel: boolean;
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
  hasServerProvider: false,
  hasSourceControl: false,
  hasDomainProvider: false,
  hasStorageProvider: false,
  hasNotificationChannel: false,
});

const isLoadingData = ref(true);

const stepDefinitions = computed<Omit<OnboardingStep, "completed">[]>(() => [
  {
    id: "server-provider",
    title: t("public.onboarding.steps.serverProvider.title"),
    description: t("public.onboarding.steps.serverProvider.description"),
    icon: Server,
    completedKey: "hasServerProvider",
    settingsTab: "connections",
  },
  {
    id: "git-provider",
    title: t("public.onboarding.steps.gitProvider.title"),
    description: t("public.onboarding.steps.gitProvider.description"),
    icon: GitBranch,
    completedKey: "hasSourceControl",
    settingsTab: "connections",
  },
  {
    id: "domain-provider",
    title: t("public.onboarding.steps.domainProvider.title"),
    description: t("public.onboarding.steps.domainProvider.description"),
    icon: Globe,
    completedKey: "hasDomainProvider",
    href: "/dns",
  },
  {
    id: "storage-provider",
    title: t("public.onboarding.steps.storageProvider.title"),
    description: t("public.onboarding.steps.storageProvider.description"),
    icon: Database,
    completedKey: "hasStorageProvider",
    settingsTab: "connections",
  },
  {
    id: "notifications",
    title: t("public.onboarding.steps.notifications.title"),
    description: t("public.onboarding.steps.notifications.description"),
    icon: Bell,
    completedKey: "hasNotificationChannel",
    settingsTab: "notifications",
  },
]);

const steps = computed(() =>
  stepDefinitions.value.map((step) => ({
    ...step,
    completed: onboardingData.value[step.completedKey],
  })),
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
        has_server_provider: boolean;
        has_source_control: boolean;
        has_domain_provider: boolean;
        has_storage_provider: boolean;
        has_notification_channel: boolean;
      };
    }>("/onboarding/status");
    onboardingData.value = {
      hasServerProvider: response.data.has_server_provider ?? false,
      hasSourceControl: response.data.has_source_control ?? false,
      hasDomainProvider: response.data.has_domain_provider ?? false,
      hasStorageProvider: response.data.has_storage_provider ?? false,
      hasNotificationChannel: response.data.has_notification_channel ?? false,
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
        <h1 class="text-xl font-semibold">
          {{ t("public.onboarding.heading") }}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          :disabled="isLoading"
          class="gap-2 text-muted-foreground hover:text-foreground"
          @click="handleSkip"
        >
          <FastForward class="h-4 w-4" />
          {{ t("public.onboarding.skip") }}
        </Button>
      </div>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t("public.onboarding.description") }}
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
            :class="
              step.completed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
            "
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

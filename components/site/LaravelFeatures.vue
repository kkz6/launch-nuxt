<script setup lang="ts">
import { toast } from "vue-sonner";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import FeatureConfirmationDialog from "~/components/site/FeatureConfirmationDialog.vue";
import type { Site } from "~/types";

interface Props {
  serverId: string;
  site: Site;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  updated: [];
}>();

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  pending: boolean;
  alwaysVisible: boolean;
  canToggle: boolean;
  needsConfirmation: boolean;
}

// Features that require a confirmation dialog before toggling
const confirmationFeatures = ["horizon", "reverb", "inertia"];

const isFeatureEnabled = (featureName: string): boolean => {
  const enabledFeatures = props.site.enabled_features || [];
  return enabledFeatures.some((feature) => {
    if (typeof feature === "string") {
      return feature === featureName;
    }
    if (typeof feature === "object" && feature !== null) {
      return (feature as { name?: string }).name === featureName;
    }
    return false;
  });
};

const features = computed<Feature[]>(() => {
  const pendingFeatures = props.site.pending_features || [];
  const detectedFeatures = props.site.features || [];

  return [
    {
      id: "scheduler",
      name: t("site.laravelFeatures.schedulerName"),
      description: t("site.laravelFeatures.schedulerDescription"),
      icon: "lucide:calendar",
      enabled: isFeatureEnabled("scheduler"),
      pending: pendingFeatures.includes("scheduler"),
      alwaysVisible: true,
      canToggle: true,
      needsConfirmation: false,
    },
    {
      id: "queue",
      name: t("site.laravelFeatures.queueName"),
      description: t("site.laravelFeatures.queueDescription"),
      icon: "lucide:database",
      enabled: isFeatureEnabled("queue"),
      pending: pendingFeatures.includes("queue"),
      alwaysVisible: true,
      canToggle: true,
      needsConfirmation: false,
    },
    {
      id: "horizon",
      name: t("site.laravelFeatures.horizonName"),
      description: t("site.laravelFeatures.horizonDescription"),
      icon: "lucide:bar-chart-3",
      enabled: isFeatureEnabled("horizon"),
      pending: pendingFeatures.includes("horizon"),
      alwaysVisible: detectedFeatures.includes("horizon"),
      canToggle: true,
      needsConfirmation: true,
    },
    {
      id: "inertia",
      name: t("site.laravelFeatures.inertiaName"),
      description: t("site.laravelFeatures.inertiaDescription"),
      icon: "lucide:layers",
      enabled: isFeatureEnabled("inertia"),
      pending: pendingFeatures.includes("inertia"),
      alwaysVisible: detectedFeatures.includes("inertia"),
      canToggle: true,
      needsConfirmation: true,
    },
    {
      id: "reverb",
      name: t("site.laravelFeatures.reverbName"),
      description: t("site.laravelFeatures.reverbDescription"),
      icon: "lucide:radio",
      enabled: isFeatureEnabled("reverb"),
      pending: pendingFeatures.includes("reverb"),
      alwaysVisible: detectedFeatures.includes("reverb"),
      canToggle: true,
      needsConfirmation: true,
    },
  ];
});

const visibleFeatures = computed(() =>
  features.value.filter((f) => f.alwaysVisible),
);

// Confirmation dialog state
const confirmDialog = ref({
  open: false,
  featureId: "",
  featureName: "",
  action: "enable" as "enable" | "disable",
});

const handleToggle = (feature: Feature) => {
  const action = feature.enabled ? "disable" : "enable";

  if (feature.needsConfirmation && confirmationFeatures.includes(feature.id)) {
    confirmDialog.value = {
      open: true,
      featureId: feature.id,
      featureName: feature.name,
      action,
    };
  } else {
    toggleFeature(feature.id, action, {});
  }
};

const handleConfirm = (options: {
  delete_queues?: boolean;
  configure_env?: boolean;
  update_caddyfile?: boolean;
}) => {
  toggleFeature(
    confirmDialog.value.featureId,
    confirmDialog.value.action,
    options,
  );
};

const toggleFeature = async (
  featureId: string,
  action: "enable" | "disable",
  options: Record<string, unknown>,
) => {
  try {
    await $api(
      `/servers/${props.serverId}/sites/${props.site.id}/features/${featureId}/${action}`,
      {
        method: "POST",
        body: options,
      },
    );
    toast.success(
      t(
        action === "enable"
          ? "site.laravelFeatures.enabled"
          : "site.laravelFeatures.disabled",
      ),
    );
    emit("updated");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(
      err.data?.message ||
        t(
          action === "enable"
            ? "site.laravelFeatures.enableFailed"
            : "site.laravelFeatures.disableFailed",
        ),
    );
  }
};
</script>

<template>
  <div v-if="visibleFeatures.length > 0">
    <h3 class="mb-4 text-lg font-semibold">
      {{ t("site.laravelFeatures.title") }}
    </h3>
    <div class="grid gap-4 sm:grid-cols-2">
      <div
        v-for="feature in visibleFeatures"
        :key="feature.id"
        class="flex items-center justify-between gap-3 rounded-lg border bg-card p-4"
        :class="{ 'opacity-60': feature.pending }"
      >
        <div class="flex flex-1 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
          >
            <Icon :name="feature.icon" class="h-5 w-5 text-primary" />
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <Label
                :for="`${feature.id}-toggle`"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ feature.name }}
              </Label>
              <Icon
                v-if="feature.pending"
                name="lucide:loader-2"
                class="h-4 w-4 animate-spin text-primary"
              />
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ feature.description }}
              <span v-if="feature.pending">
                ({{ t("site.common.processing") }})</span
              >
            </p>
          </div>
        </div>
        <Switch
          v-if="feature.canToggle"
          :id="`${feature.id}-toggle`"
          :model-value="feature.enabled"
          :disabled="feature.pending"
          @update:model-value="handleToggle(feature)"
        />
      </div>
    </div>

    <FeatureConfirmationDialog
      v-model:open="confirmDialog.open"
      :feature-id="confirmDialog.featureId"
      :feature-name="confirmDialog.featureName"
      :action="confirmDialog.action"
      :queue-count="site.queue_count ?? 0"
      @confirm="handleConfirm"
    />
  </div>
</template>

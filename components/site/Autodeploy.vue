<script setup lang="ts">
import { toast } from "vue-sonner";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

interface Props {
  serverId: string;
  siteId: string;
  autoDeployment?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoDeployment: false,
});
const { t } = useI18n();

const emit = defineEmits<{
  updated: [];
}>();

const isEnabled = ref(props.autoDeployment);
const isLoading = ref(false);

// Sync with prop changes
watch(
  () => props.autoDeployment,
  (newVal) => {
    isEnabled.value = newVal;
  },
);

const toggleAutodeploy = async (enabled: boolean) => {
  isLoading.value = true;
  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/autodeploy`, {
      method: "POST",
      body: { enabled },
    });
    isEnabled.value = enabled;
    toast.success(
      enabled ? t("site.autoDeploy.enabled") : t("site.autoDeploy.disabled"),
    );
    emit("updated");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("site.autoDeploy.updateFailed"));
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="flex items-center gap-2">
    <Switch
      :model-value="isEnabled"
      :disabled="isLoading"
      @update:model-value="toggleAutodeploy"
    />
    <Label class="text-sm text-muted-foreground">{{
      t("site.autoDeploy.label")
    }}</Label>
  </div>
</template>

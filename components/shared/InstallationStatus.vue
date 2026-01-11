<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import type { InstallationStatus } from "~/types";

interface Props extends InstallationStatus {
  className?: string;
}

const props = defineProps<Props>();

const status = computed(() => {
  if (props.installation_failed_at) {
    return { text: "Installation failed", loading: false };
  }
  if (props.uninstallation_failed_at) {
    return { text: "Uninstallation failed", loading: false };
  }
  if (props.uninstallation_requested_at) {
    return { text: "Uninstalling", loading: true };
  }
  if (props.installed_at) {
    return { text: "Installed", loading: false };
  }
  return { text: "Installing", loading: true };
});
</script>

<template>
  <div :class="['flex flex-row items-center', className]">
    <Settings
      v-if="status.loading"
      class="mr-1.5 h-5 w-5 animate-spin text-gray-400"
    />
    <span>{{ status.text }}</span>
  </div>
</template>

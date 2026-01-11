<script setup lang="ts">
import { Badge } from '~/components/ui/badge'
import type { InstallationStatus } from '~/types'

interface Props extends InstallationStatus {
  className?: string
}

const props = defineProps<Props>()

const status = computed(() => {
  if (props.uninstallation_failed_at) {
    return { label: 'Uninstall Failed', variant: 'destructive' as const }
  }
  if (props.uninstallation_requested_at) {
    return { label: 'Uninstalling...', variant: 'secondary' as const }
  }
  if (props.installation_failed_at) {
    return { label: 'Failed', variant: 'destructive' as const }
  }
  if (props.installed_at) {
    return { label: 'Installed', variant: 'default' as const }
  }
  return { label: 'Installing...', variant: 'secondary' as const }
})

const isInstalling = computed(() => {
  return !props.installed_at && !props.installation_failed_at
})
</script>

<template>
  <Badge :variant="status.variant" :class="className">
    <Icon
      v-if="isInstalling"
      name="lucide:loader-2"
      class="mr-1 h-3 w-3 animate-spin"
    />
    {{ status.label }}
  </Badge>
</template>

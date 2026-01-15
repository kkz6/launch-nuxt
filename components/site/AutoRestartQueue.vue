<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'

interface Props {
  serverId: string
  siteId: string
  autoRestartQueue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoRestartQueue: false,
})

const emit = defineEmits<{
  updated: []
}>()

const isEnabled = ref(props.autoRestartQueue)
const isLoading = ref(false)

// Sync with prop changes
watch(() => props.autoRestartQueue, (newVal) => {
  isEnabled.value = newVal
})

const toggleAutoRestart = async (enabled: boolean) => {
  isLoading.value = true
  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/auto-restart-queue`, {
      method: 'POST',
      body: { enabled },
    })
    isEnabled.value = enabled
    toast.success(enabled ? 'Auto-restart queue enabled' : 'Auto-restart queue disabled')
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to update auto-restart queue')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Switch
      :checked="isEnabled"
      :disabled="isLoading"
      @update:checked="toggleAutoRestart"
    />
    <Label class="text-sm text-muted-foreground">Auto-restart</Label>
  </div>
</template>

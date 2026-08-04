<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

interface Props {
  serverId: string
  siteId: string
  autoRestartQueue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoRestartQueue: false,
})

const emit = defineEmits<{
  updated: [enabled: boolean]
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
      method: 'PUT',
      body: { enabled },
    })
    isEnabled.value = enabled
    toast.success(enabled ? 'Auto-restart queue enabled' : 'Auto-restart queue disabled')
    emit('updated', enabled)
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
      :id="`auto-restart-queue-${siteId}`"
      :model-value="isEnabled"
      :disabled="isLoading"
      @update:model-value="toggleAutoRestart"
    />
    <Label
      :for="`auto-restart-queue-${siteId}`"
      class="text-sm text-muted-foreground"
    >
      Auto-restart
    </Label>
    <TooltipProvider :delay-duration="0">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="flex h-6 w-6 cursor-help items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="About automatic queue restarts"
          >
            <Icon name="lucide:info" class="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent class="max-w-xs">
          <p>
            After each successful deployment, Launch stops and starts all
            installed queue workers for this site so they load the latest
            application code.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

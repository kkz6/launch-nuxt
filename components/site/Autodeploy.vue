<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'

interface Props {
  serverId: string
  siteId: string
}

const props = defineProps<Props>()

const isEnabled = ref(false)
const isLoading = ref(true)

const fetchStatus = async () => {
  try {
    const data = await $api<{ data: { auto_deploy: boolean } }>(`/servers/${props.serverId}/sites/${props.siteId}/autodeploy`)
    isEnabled.value = data.data.auto_deploy
  } catch {
    // Silent fail
  } finally {
    isLoading.value = false
  }
}

const toggleAutodeploy = async (enabled: boolean) => {
  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/autodeploy`, {
      method: 'POST',
      body: { enabled },
    })
    isEnabled.value = enabled
    toast.success(enabled ? 'Auto-deploy enabled' : 'Auto-deploy disabled')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to update auto-deploy')
  }
}

onMounted(fetchStatus)
</script>

<template>
  <div class="flex items-center gap-2">
    <Switch
      :checked="isEnabled"
      :disabled="isLoading"
      @update:checked="toggleAutodeploy"
    />
    <Label class="text-sm text-muted-foreground">Auto-deploy</Label>
  </div>
</template>

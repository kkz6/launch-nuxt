<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import type { Cron } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const schedulers = ref<Cron[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchData = async () => {
  try {
    const data = await $api<{ data: Cron[] }>(`/servers/${props.serverId}/crons`)
    schedulers.value = data.data
  } catch {
    toast.error('Failed to load schedulers')
  } finally {
    isLoading.value = false
  }
}

const deleteScheduler = async (cron: Cron) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Scheduler',
    description: 'Are you sure you want to delete this scheduled task?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/crons/${cron.id}`, {
        method: 'DELETE',
      })
      schedulers.value = schedulers.value.filter((s) => s.id !== cron.id)
      toast.success('Scheduler deleted successfully')
    } catch {
      toast.error('Failed to delete scheduler')
    }
  }
}

onMounted(fetchData)
</script>

<template>
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader>
      <CardTitle class="text-xl">Schedulers</CardTitle>
      <CardDescription>Manage cron jobs on this server</CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="mt-4">
          <SharedDataTable
            :data="schedulers"
            :columns="[
              { key: 'command', label: 'Command', width: '25%' },
              { key: 'user', label: 'User', width: '15%' },
              { key: 'frequency', label: 'Frequency', width: '20%' },
              { key: 'status', label: 'Status', width: '15%' },
              { key: 'installed_at', label: 'Installed', width: '15%' },
            ]"
            :actions="[
              { label: 'View Logs', icon: 'lucide:scroll-text' },
              { label: 'Edit', icon: 'lucide:pencil' },
              { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteScheduler, destructive: true },
            ]"
            empty-title="No scheduled tasks found"
            empty-icon="lucide:clock"
          >
            <template #empty>
              <ServerCreateScheduler :server-id="serverId" @created="fetchData" />
            </template>
          </SharedDataTable>

          <div v-if="schedulers.length > 0" class="mt-6">
            <ServerCreateScheduler :server-id="serverId" @created="fetchData" />
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

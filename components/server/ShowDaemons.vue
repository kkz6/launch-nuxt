<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { QueueDaemon } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const daemons = ref<QueueDaemon[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchData = async () => {
  try {
    const data = await $api<{ data: QueueDaemon[] }>(`/servers/${props.serverId}/daemons`)
    daemons.value = data.data
  } catch {
    toast.error('Failed to load daemons')
  } finally {
    isLoading.value = false
  }
}

const deleteDaemon = async (daemon: QueueDaemon) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Daemon',
    description: 'Are you sure you want to delete this daemon? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/daemons/${daemon.id}`, {
        method: 'DELETE',
      })
      daemons.value = daemons.value.filter((d) => d.id !== daemon.id)
      toast.success('Daemon deleted successfully')
    } catch {
      toast.error('Failed to delete daemon')
    }
  }
}

const restartDaemon = async (daemon: QueueDaemon) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Restart Daemon',
    description: 'Are you sure you want to restart this daemon?',
    confirmText: 'Restart',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/daemons/${daemon.id}/restart`, {
        method: 'POST',
      })
      toast.success('Daemon restart initiated')
      fetchData()
    } catch {
      toast.error('Failed to restart daemon')
    }
  }
}

const syncStatus = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Sync Daemon Status',
    description: 'This will check the status of all daemons on the server.',
    confirmText: 'Sync',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/daemons/sync`, {
        method: 'POST',
      })
      toast.success('Daemon sync initiated')
      fetchData()
    } catch {
      toast.error('Failed to sync daemon status')
    }
  }
}

const hasStatusInfo = computed(() => daemons.value.some((d) => d.last_status_check !== null))

onMounted(fetchData)
</script>

<template>
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle class="text-xl">Daemons</CardTitle>
        <CardDescription>Manage background processes on this server</CardDescription>
      </div>
      <Button v-if="daemons.length > 0" variant="outline" @click="syncStatus">
        <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
        Sync Status
      </Button>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="mt-4">
          <SharedDataTable
            :data="daemons"
            :columns="[
              { key: 'command', label: 'Command', width: '30%' },
              { key: 'user', label: 'User', width: '15%' },
              { key: 'processes', label: 'Processes', width: '10%' },
              ...(hasStatusInfo ? [{
                key: 'running',
                label: 'Status',
                width: '15%',
              }] : []),
              { key: 'installed_at', label: 'Installed', width: '15%' },
            ]"
            :actions="[
              { label: 'View Logs', icon: 'lucide:scroll-text' },
              { label: 'Restart', icon: 'lucide:rotate-ccw', onClick: restartDaemon },
              { label: 'Edit', icon: 'lucide:pencil' },
              { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteDaemon, destructive: true },
            ]"
            empty-title="No daemons found"
            empty-icon="lucide:activity"
          >
            <template #empty>
              <ServerCreateDaemon :server-id="serverId" @created="fetchData" />
            </template>
          </SharedDataTable>

          <div v-if="daemons.length > 0" class="mt-6">
            <ServerCreateDaemon :server-id="serverId" @created="fetchData" />
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

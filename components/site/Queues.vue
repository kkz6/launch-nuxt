<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

interface Queue {
  id: string
  connection: string
  queue: string
  processes: number
  sleep: number
  timeout: number
  tries: number
  status: string
  running: boolean
  installed_at: string | null
}

interface Props {
  serverId: string
  siteId: string
}

const props = defineProps<Props>()

const queues = ref<Queue[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchQueues = async () => {
  try {
    const data = await $api<{ data: Queue[] }>(`/servers/${props.serverId}/sites/${props.siteId}/queues`)
    queues.value = data.data
  } catch {
    toast.error('Failed to load queues')
  } finally {
    isLoading.value = false
  }
}

const restartQueue = async (queue: Queue) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Restart Queue',
    description: 'Are you sure you want to restart this queue worker?',
    confirmText: 'Restart',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/sites/${props.siteId}/queues/${queue.id}/restart`, {
        method: 'POST',
      })
      toast.success('Queue restart initiated')
      fetchQueues()
    } catch {
      toast.error('Failed to restart queue')
    }
  }
}

const deleteQueue = async (queue: Queue) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Queue',
    description: 'Are you sure you want to delete this queue worker?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/sites/${props.siteId}/queues/${queue.id}`, {
        method: 'DELETE',
      })
      queues.value = queues.value.filter((q) => q.id !== queue.id)
      toast.success('Queue deleted')
    } catch {
      toast.error('Failed to delete queue')
    }
  }
}

onMounted(fetchQueues)
</script>

<template>
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle class="text-xl">Queue Workers</CardTitle>
        <CardDescription>Manage Laravel queue workers for this site</CardDescription>
      </div>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SharedDataTable
          :data="queues"
          :columns="[
            { key: 'queue', label: 'Queue', width: '20%' },
            { key: 'connection', label: 'Connection', width: '15%' },
            { key: 'processes', label: 'Processes', width: '10%' },
            { key: 'running', label: 'Status', width: '15%' },
            { key: 'installed_at', label: 'Installed', width: '20%' },
          ]"
          :actions="[
            { label: 'Restart', icon: 'lucide:rotate-ccw', onClick: restartQueue },
            { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteQueue, destructive: true },
          ]"
          empty-title="No queue workers found"
          empty-icon="lucide:database"
        >
          <template #cell-running="{ row }">
            <div class="flex items-center gap-2">
              <span :class="['h-2.5 w-2.5 rounded-full', row.running ? 'bg-green-500' : 'bg-red-500']" />
              <span>{{ row.running ? 'Running' : 'Stopped' }}</span>
            </div>
          </template>

          <template #cell-installed_at="{ row }">
            <SharedDateTooltip v-if="row.installed_at" :date="row.installed_at" />
            <span v-else class="text-muted-foreground">Not installed</span>
          </template>

          <template #empty>
            <SiteCreateQueue :server-id="serverId" :site-id="siteId" @created="fetchQueues" />
          </template>
        </SharedDataTable>

        <div v-if="queues.length > 0" class="mt-6">
          <SiteCreateQueue :server-id="serverId" :site-id="siteId" @created="fetchQueues" />
        </div>
      </template>
    </CardContent>
  </Card>
</template>

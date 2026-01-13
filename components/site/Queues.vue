<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

interface Queue {
  id: string
  queue_connection: string
  queue: string
  user?: string
  max_seconds_per_job: number
  rest_seconds_on_empty: number
  failed_job_delay_seconds: number
  directory?: string
  run_on_maintenance: boolean
  run_with_listen: boolean
  environment?: string
  max_tries?: number
  max_memory?: number
  numprocs?: number
  stop_wait_seconds?: number
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
const selectedQueue = ref<Queue | null>(null)
const isEditDialogOpen = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const editQueue = (queue: Queue) => {
  selectedQueue.value = queue
  isEditDialogOpen.value = true
}

const handleQueueUpdated = () => {
  isEditDialogOpen.value = false
  selectedQueue.value = null
  fetchQueues()
}

watch(isEditDialogOpen, (open) => {
  if (!open) {
    selectedQueue.value = null
  }
})

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

// Subscribe to real-time queue events
useSiteQueueEvents(props.siteId, () => {
  fetchQueues()
})

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

    <!-- Edit Queue Dialog -->
    <SiteCreateQueue
      v-if="selectedQueue"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :site-id="siteId"
      :queue="selectedQueue"
      @updated="handleQueueUpdated"
    />

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
            { key: 'queue_connection', label: 'Connection', width: '15%' },
            { key: 'numprocs', label: 'Processes', width: '10%' },
            { key: 'running', label: 'Status', width: '15%' },
            { key: 'installed_at', label: 'Installed', width: '20%' },
          ]"
          empty-title="No queue workers found"
          empty-icon="lucide:database"
        >
          <template #cell-running="{ row }">
            <Badge :variant="row.running ? 'success' : 'secondary'">
              {{ row.running ? 'Running' : 'Stopped' }}
            </Badge>
          </template>

          <template #cell-installed_at="{ row }">
            <SharedDateTooltip v-if="row.installed_at" :date="row.installed_at" />
            <span v-else class="text-muted-foreground">Not installed</span>
          </template>

          <template #actions="{ item }">
            <Button variant="ghost" size="icon" title="Restart" @click="restartQueue(item)">
              <Icon name="lucide:rotate-ccw" class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Edit" @click="editQueue(item)">
              <Icon name="lucide:pencil" class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Delete"
              class="hover:bg-destructive/90 hover:text-white"
              @click="deleteQueue(item)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4" />
            </Button>
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

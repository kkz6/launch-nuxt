<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { useSiteQueueEvents } from '~/composables/useChannelEvents'
import type { Site } from '~/types'

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
  info?: {
    error: string | null
    pid: string
    state: string
    uptime: string
  } | null
  last_status_check: string | null
}

interface Props {
  serverId: string
  siteId: string
  site: Site
  autoRestartQueue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoRestartQueue: false,
})

const queues = ref<Queue[]>([])
const isLoading = ref(true)
const selectedQueue = ref<Queue | null>(null)
const isEditDialogOpen = ref(false)
const restartingId = ref<string | null>(null)
const isSyncing = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Log viewer state
const selectedQueueForLogs = ref<Queue | null>(null)
const isLogDialogOpen = ref(false)

const viewLogs = (queue: Queue) => {
  selectedQueueForLogs.value = queue
  isLogDialogOpen.value = true
}

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

// Get current team for WebSocket channel
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

// Debounced refetch for WebSocket events
let queueFetchTimeout: ReturnType<typeof setTimeout> | null = null

useSiteQueueEvents(teamId, (data) => {
  if (data.site_id === props.siteId) {
    if (queueFetchTimeout) clearTimeout(queueFetchTimeout)
    queueFetchTimeout = setTimeout(() => {
      fetchQueues()
      restartingId.value = null
      isSyncing.value = false
    }, 300)
  }
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
    restartingId.value = queue.id
    try {
      await $api(`/servers/${props.serverId}/sites/${props.siteId}/queues/${queue.id}/restart`, {
        method: 'POST',
      })
      toast.success('Queue restart initiated')
    } catch {
      toast.error('Failed to restart queue')
      restartingId.value = null
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

const syncStatus = async () => {
  isSyncing.value = true
  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/queues/sync`, {
      method: 'POST',
    })
    toast.success('Syncing queue status...')
  } catch {
    toast.error('Failed to sync queue status')
    isSyncing.value = false
  }
}

onMounted(fetchQueues)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Log Viewer Dialog -->
    <SharedLogViewerDialog
      v-if="selectedQueueForLogs"
      v-model:open="isLogDialogOpen"
      :server-id="serverId"
      entity="queue"
      :entity-id="selectedQueueForLogs.id"
      title="Queue Worker Logs"
      :description="`${selectedQueueForLogs.queue} (${selectedQueueForLogs.queue_connection})`"
    />

    <!-- Edit Queue Dialog -->
    <SiteCreateQueue
      v-if="selectedQueue"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :site-id="siteId"
      :site="site"
      :queue="selectedQueue"
      @updated="handleQueueUpdated"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Queue Workers</h3>
        <p class="text-sm text-muted-foreground">Manage Laravel queue workers for this site</p>
      </div>
      <div class="flex items-center gap-2">
        <SiteAutoRestartQueue :server-id="serverId" :site-id="siteId" :auto-restart-queue="autoRestartQueue" />
        <Button v-if="queues.length > 0" variant="outline" size="sm" :disabled="isSyncing" @click="syncStatus">
          <Icon name="lucide:refresh-cw" :class="['mr-2 h-4 w-4', isSyncing && 'animate-spin']" />
          {{ isSyncing ? 'Syncing...' : 'Sync' }}
        </Button>
        <SiteCreateQueue v-if="queues.length > 0" :server-id="serverId" :site-id="siteId" :site="site" @created="fetchQueues" />
      </div>
    </div>

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge :variant="row.running ? 'success' : 'secondary'" class="cursor-help">
                  {{ row.running ? 'Running' : 'Stopped' }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                <div class="space-y-1.5 text-sm">
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span class="text-muted-foreground">Status:</span>
                    <span :class="row.running ? 'text-green-500' : 'text-red-500'">
                      {{ row.info?.state || (row.running ? 'Running' : 'Stopped') }}
                    </span>
                    <template v-if="row.info?.uptime">
                      <span class="text-muted-foreground">Uptime:</span>
                      <span>{{ row.info.uptime }}</span>
                    </template>
                    <template v-if="row.info?.pid">
                      <span class="text-muted-foreground">PID:</span>
                      <span>{{ row.info.pid }}</span>
                    </template>
                    <span class="text-muted-foreground">Processes:</span>
                    <span>{{ row.numprocs || 1 }}</span>
                    <span class="text-muted-foreground">Connection:</span>
                    <span>{{ row.queue_connection }}</span>
                    <template v-if="row.max_tries">
                      <span class="text-muted-foreground">Max Tries:</span>
                      <span>{{ row.max_tries }}</span>
                    </template>
                    <template v-if="row.max_memory">
                      <span class="text-muted-foreground">Max Memory:</span>
                      <span>{{ row.max_memory }}MB</span>
                    </template>
                  </div>
                  <p v-if="row.last_status_check" class="border-t pt-1.5 text-xs text-muted-foreground">
                    Last checked: <SharedDateTooltip :date="row.last_status_check" />
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>

        <template #cell-installed_at="{ row }">
          <SharedDateTooltip v-if="row.installed_at" :date="row.installed_at" />
          <span v-else class="text-muted-foreground">Not installed</span>
        </template>

        <template #actions="{ item }">
          <Button variant="ghost" size="icon" title="View Logs" @click="viewLogs(item)">
            <Icon name="lucide:scroll-text" class="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Restart" :disabled="restartingId === item.id" @click="restartQueue(item)">
            <Icon v-if="restartingId === item.id" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
            <Icon v-else name="lucide:rotate-ccw" class="h-4 w-4" />
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
          <SiteCreateQueue :server-id="serverId" :site-id="siteId" :site="site" @created="fetchQueues" />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>

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
import type { QueueDaemon } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const daemons = ref<QueueDaemon[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Log viewer state
const selectedDaemonForLogs = ref<QueueDaemon | null>(null)
const isLogDialogOpen = ref(false)

// Edit dialog state
const selectedDaemonForEdit = ref<QueueDaemon | null>(null)
const isEditDialogOpen = ref(false)

const viewLogs = (daemon: QueueDaemon) => {
  selectedDaemonForLogs.value = daemon
  isLogDialogOpen.value = true
}

const editDaemon = (daemon: QueueDaemon) => {
  selectedDaemonForEdit.value = daemon
  isEditDialogOpen.value = true
}

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
    description: 'This action cannot be undone. This will permanently delete the daemon from your server.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the command to confirm deletion:',
    inputVerificationText: daemon.command,
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
  } else {
    toast.info('Cancelled')
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

const handleDaemonUpdated = () => {
  isEditDialogOpen.value = false
  selectedDaemonForEdit.value = null
  fetchData()
}

// Clean up selected daemon when dialog closes
watch(isEditDialogOpen, (open) => {
  if (!open) {
    selectedDaemonForEdit.value = null
  }
})

const hasStatusInfo = computed(() => daemons.value.some((d) => d.last_status_check !== null))

// Subscribe to real-time daemon events
useServerModelEvents('daemon', props.serverId, fetchData)

onMounted(fetchData)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Log Viewer Dialog -->
    <SharedLogViewerDialog
      v-if="selectedDaemonForLogs"
      v-model:open="isLogDialogOpen"
      :server-id="serverId"
      entity="daemon"
      :entity-id="selectedDaemonForLogs.id"
      title="Daemon Logs"
      :description="selectedDaemonForLogs.command"
    />

    <!-- Edit Daemon Dialog -->
    <ServerCreateDaemon
      v-if="selectedDaemonForEdit"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :daemon="selectedDaemonForEdit"
      @updated="handleDaemonUpdated"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Daemons</h3>
        <p class="text-sm text-muted-foreground">Manage background processes on this server</p>
      </div>
      <div class="flex items-center gap-2">
        <Button v-if="daemons.length > 0" variant="outline" size="sm" @click="syncStatus">
          <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          Sync Status
        </Button>
        <ServerCreateDaemon v-if="daemons.length > 0" :server-id="serverId" @created="fetchData" />
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
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
          { key: 'installed_at', label: 'Installed', width: '15%', type: 'relative-date' as const },
        ]"
        :actions="[
          { label: 'View Logs', icon: 'lucide:scroll-text', onClick: viewLogs },
          { label: 'Restart', icon: 'lucide:rotate-ccw', onClick: restartDaemon },
          { label: 'Edit', icon: 'lucide:pencil', onClick: editDaemon },
          { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteDaemon, destructive: true },
        ]"
        empty-title="No daemons found"
        empty-icon="lucide:activity"
      >
        <template #empty>
          <ServerCreateDaemon :server-id="serverId" @created="fetchData" />
        </template>

        <template #cell-running="{ value, row }">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge :variant="value ? 'success' : 'secondary'" class="cursor-help">
                  {{ value ? 'Running' : 'Stopped' }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                <div class="space-y-1.5 text-sm">
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span class="text-muted-foreground">Status:</span>
                    <span :class="value ? 'text-green-500' : 'text-red-500'">
                      {{ row.info?.state || (value ? 'Running' : 'Stopped') }}
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
                    <span>{{ row.processes || 1 }}</span>
                    <span class="text-muted-foreground">User:</span>
                    <span>{{ row.user }}</span>
                    <template v-if="row.directory">
                      <span class="text-muted-foreground">Directory:</span>
                      <span class="truncate">{{ row.directory }}</span>
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
      </SharedDataTable>
    </template>
  </div>
</template>

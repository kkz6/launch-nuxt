<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import type { Database, StorageProviderRecord } from '~/types'

interface BackupJob {
  id: string
  backup_id: string
  storage_provider_id: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  size: number
  size_in_mb: number
  error?: string
  // task_id is set by the worker once the SSH task is created — drives
  // the View Logs button in the history sheet (ServerLogViewer
  // entity="task"). Absent on legacy rows pre-task-tracking.
  task_id?: string | null
  created_at: string
  updated_at: string
}

interface Backup {
  id: string
  server_id: string
  user_id: string
  storage_provider_id: string
  cron_expression: string
  include_files: string[]
  exclude_files: string[]
  retention: number
  notification_on_failure: boolean
  notification_on_success: boolean
  enabled: boolean
  path: string
  installed_at: string | null
  size_in_mb: number
  created_at: string
  updated_at: string
  jobs: BackupJob[]
  databases: string[]
  latest_job?: BackupJob
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const { open: openSettings } = useSettingsSheet()

const backups = ref<Backup[]>([])
const databases = ref<Database[]>([])
const storageProvidersList = ref<StorageProviderRecord[]>([])
const storageProvidersMap = ref<Record<string, string>>({})
const isLoading = ref(true)
const loadingActions = ref<Record<string, string>>({})
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// History sheet state
const isHistorySheetOpen = ref(false)
const selectedBackupForHistory = ref<Backup | null>(null)

// Edit dialog state
const isEditDialogOpen = ref(false)
const selectedBackupForEdit = ref<Backup | null>(null)

// Live log console — auto-opens on Run Backup so the dump/upload
// streams live (same UX as docker DB backups). Sheet opens immediately
// in a "Starting backup…" state; task id arrives a beat later on the
// backup.run.started WS event (see useChannelEvents subscription).
const isLogSheetOpen = ref(false)
const logSheetTaskId = ref('')
const awaitingRunForBackupId = ref<string>('')
const logRefreshNonce = ref(0)
watch(isLogSheetOpen, (open) => {
  if (!open) {
    awaitingRunForBackupId.value = ''
    logSheetTaskId.value = ''
  }
})

// Subscribe to backup run events on the team channel. When we're
// awaiting the run we just kicked off, attach the live stream as soon
// as the task id arrives; on terminal events, refresh the table and
// bump the refresh nonce so the log viewer remounts for fast runs.
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')
useBackupEvents(teamId, (data, event) => {
  const backupId = String((data as { backup_id?: string }).backup_id ?? '')
  if (event === 'backup.run.started' && backupId === awaitingRunForBackupId.value) {
    const tid = String((data as { task_id?: string }).task_id ?? '')
    if (tid) logSheetTaskId.value = tid
  }
  if (event === 'backup.run.succeeded' || event === 'backup.run.failed') {
    fetchBackups()
    if (isLogSheetOpen.value && logSheetTaskId.value) {
      setTimeout(() => logRefreshNonce.value++, 800)
    }
  }
})

const fetchBackups = async () => {
  try {
    const [backupsData, providersData, dbData] = await Promise.all([
      $api<{ data: Backup[] }>(`/servers/${props.serverId}/backups`),
      $api<{ data: StorageProviderRecord[] }>('/storage-providers'),
      $api<{ data: Database[] }>(`/servers/${props.serverId}/databases`),
    ])
    backups.value = backupsData.data || []
    storageProvidersList.value = providersData.data || []
    databases.value = dbData.data || []

    const providersMap: Record<string, string> = {}
    for (const provider of storageProvidersList.value) {
      providersMap[String(provider.id)] = provider.label
    }
    storageProvidersMap.value = providersMap
  } catch {
    toast.error('Failed to load backups')
  } finally {
    isLoading.value = false
  }
}

const runBackup = async (backup: Backup) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Run Backup',
    description: 'Are you sure you want to run this backup now?',
    confirmText: 'Run Backup',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  loadingActions.value = { ...loadingActions.value, [backup.id]: 'run' }

  try {
    await $api(`/servers/${props.serverId}/backups/${backup.id}/run`, {
      method: 'POST',
    })
    toast.success('Backup started')
    // Open the live log console immediately — same UX as docker DB
    // backups. The task id arrives a beat later on the run.started
    // event (handled in the WS subscription above), which attaches the
    // stream. The sheet renders a "Starting backup…" state in between.
    logSheetTaskId.value = ''
    awaitingRunForBackupId.value = backup.id
    isLogSheetOpen.value = true
    fetchBackups()
  } catch {
    toast.error('Failed to start backup')
    awaitingRunForBackupId.value = ''
  } finally {
    loadingActions.value = { ...loadingActions.value, [backup.id]: '' }
  }
}

const deleteBackup = async (backup: Backup) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Backup Configuration',
    description: 'Are you sure you want to delete this backup configuration? This will not delete existing backup files.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (!result.ok) return

  loadingActions.value = { ...loadingActions.value, [backup.id]: 'delete' }

  try {
    await $api(`/servers/${props.serverId}/backups/${backup.id}`, {
      method: 'DELETE',
    })
    backups.value = backups.value.filter((b) => b.id !== backup.id)
    toast.success('Backup configuration deleted')
  } catch {
    toast.error('Failed to delete backup')
  } finally {
    loadingActions.value = { ...loadingActions.value, [backup.id]: '' }
  }
}

const openHistory = (backup: Backup) => {
  selectedBackupForHistory.value = backup
  isHistorySheetOpen.value = true
}

const openEdit = (backup: Backup) => {
  selectedBackupForEdit.value = backup
  isEditDialogOpen.value = true
}

const getProviderName = (providerId: string) => {
  return storageProvidersMap.value[providerId] || 'Unknown'
}

const getBackupSource = (backup: Backup) => {
  if (backup.databases && backup.databases.length > 0) {
    return `Database (${backup.databases.length})`
  }
  return backup.path || '/'
}

const getLatestJobStatus = (backup: Backup) => {
  if (!backup.latest_job) return null
  return backup.latest_job.status
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { icon: string; label: string; class: string }> = {
    pending: {
      icon: 'lucide:clock',
      label: 'Pending',
      class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    running: {
      icon: 'lucide:loader-2',
      label: 'Running',
      class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    finished: {
      icon: 'lucide:check-circle-2',
      label: 'Finished',
      class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    failed: {
      icon: 'lucide:alert-circle',
      label: 'Failed',
      class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  }
  return configs[status] || configs.pending
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const hasProviders = computed(() => storageProvidersList.value.length > 0)

const columns = [
  { key: 'provider', label: 'Provider', width: '25%' },
  { key: 'source', label: 'Source', width: '20%' },
  { key: 'schedule', label: 'Schedule', width: '20%' },
  { key: 'status', label: 'Last Backup', width: '15%' },
]

const actions = computed(() => [
  {
    label: 'Run Backup',
    icon: 'lucide:play',
    onClick: runBackup,
  },
  {
    label: 'View History',
    icon: 'lucide:history',
    onClick: openHistory,
  },
  {
    label: 'Edit',
    icon: 'lucide:pencil',
    onClick: openEdit,
  },
  {
    label: 'Delete',
    icon: 'lucide:trash-2',
    onClick: deleteBackup,
    destructive: true,
  },
])

onMounted(fetchBackups)
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Backup History Sheet -->
    <ServerSettingsBackupHistorySheet
      v-if="selectedBackupForHistory"
      v-model:open="isHistorySheetOpen"
      :backup="selectedBackupForHistory"
      :server-id="serverId"
    />

    <!--
      Live backup-run logs — auto-opens on Run Backup so the operator
      sees the tar/upload stream live instead of digging into History.
      Renders a "Starting backup…" state until the run.started WS event
      arrives with the task id, then attaches the ServerLogViewer.
      Matches the docker DB backup pattern for layout + scrolling.
    -->
    <Sheet v-model:open="isLogSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-[calc(100vh-5rem)] w-full rounded-lg border sm:max-w-3xl flex flex-col overflow-hidden outline-none"
      >
        <SheetHeader class="shrink-0">
          <SheetTitle>Backup Logs</SheetTitle>
          <SheetDescription>
            Tar &amp; upload output for this backup run.
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-1 flex-col min-h-0">
          <ServerLogViewer
            v-if="isLogSheetOpen && logSheetTaskId"
            :key="`${logSheetTaskId}-${logRefreshNonce}`"
            :server-id="serverId"
            entity="task"
            :entity-id="logSheetTaskId"
            :no-timestamp="true"
            hide-options
            container-class-name="h-full rounded-b-lg"
          />
          <div
            v-else-if="isLogSheetOpen"
            class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
            Starting backup… waiting for output.
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <!-- Edit Backup Dialog -->
    <ServerCreateBackup
      v-if="selectedBackupForEdit"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :backup="selectedBackupForEdit"
      :databases="databases"
      :storage-providers="storageProvidersList"
      @update:open="(val: boolean) => { if (!val) selectedBackupForEdit = null }"
      @created="fetchBackups"
    />

    <div>
      <h3 class="text-lg font-medium">Backups</h3>
      <p class="text-sm text-muted-foreground">Configure automatic backups for databases and files</p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- No storage providers message -->
      <div v-if="!hasProviders" class="flex flex-col items-center gap-3 py-8">
        <Icon name="lucide:database-backup" class="h-8 w-8 text-muted-foreground" />
        <p class="text-center text-muted-foreground">
          No storage providers configured.
          <button
            type="button"
            class="text-foreground underline"
            @click="openSettings('connections')"
          >
            Add a storage provider
          </button>
          to create backups.
        </p>
      </div>

      <template v-else>
        <SharedDataTable
          :data="backups"
          :columns="columns"
          :actions="actions"
          empty-icon="lucide:database-backup"
          empty-title="No backup configurations"
          empty-description="Create a backup configuration to automatically backup your databases and files."
        >
          <template #empty>
            <ServerCreateBackup :server-id="serverId" :databases="databases" :storage-providers="storageProvidersList" @created="fetchBackups" />
          </template>

          <template #cell-provider="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ getProviderName(row.storage_provider_id) }}</span>
              <Badge v-if="!row.enabled" variant="secondary" class="text-xs">Disabled</Badge>
            </div>
          </template>

          <template #cell-source="{ row }">
            <span class="text-sm">{{ getBackupSource(row) }}</span>
          </template>

          <template #cell-schedule="{ row }">
            <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ row.cron_expression }}</code>
          </template>

          <template #cell-status="{ row }">
            <TooltipProvider v-if="row.latest_job">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Badge variant="outline" :class="[getStatusConfig(row.latest_job.status).class, 'cursor-help']">
                    <Icon
                      :name="getStatusConfig(row.latest_job.status).icon"
                      :class="['mr-1 h-3 w-3', row.latest_job.status === 'running' && 'animate-spin']"
                    />
                    {{ getStatusConfig(row.latest_job.status).label }}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">
                  <div class="space-y-1.5 text-sm">
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span class="text-muted-foreground">Status:</span>
                      <span :class="row.latest_job.status === 'finished' ? 'text-green-500' : row.latest_job.status === 'failed' ? 'text-red-500' : ''">
                        {{ getStatusConfig(row.latest_job.status).label }}
                      </span>
                      <span class="text-muted-foreground">Size:</span>
                      <span>{{ formatSize(row.latest_job.size) }}</span>
                      <span class="text-muted-foreground">Retention:</span>
                      <span>{{ row.retention }} backups</span>
                      <span class="text-muted-foreground">Provider:</span>
                      <span>{{ getProviderName(row.storage_provider_id) }}</span>
                    </div>
                    <p v-if="row.latest_job.error" class="border-t pt-1.5 text-xs text-red-500">
                      {{ row.latest_job.error }}
                    </p>
                    <p class="border-t pt-1.5 text-xs text-muted-foreground">
                      Last run: <SharedDateTooltip :date="row.latest_job.created_at" />
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span v-else class="text-sm text-muted-foreground">-</span>
          </template>
        </SharedDataTable>

        <div v-if="backups.length > 0" class="mt-6">
          <ServerCreateBackup :server-id="serverId" :databases="databases" :storage-providers="storageProvidersList" @created="fetchBackups" />
        </div>
      </template>
    </template>
  </div>
</template>

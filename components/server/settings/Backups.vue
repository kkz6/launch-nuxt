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

interface BackupRunEventPayload {
  backup_id?: string
  job_id?: string
  server_id?: string
  task_id?: string
  error?: string
}

interface BufferedBackupRunEvent {
  data: BackupRunEventPayload
  event: string
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

const isLogSheetOpen = ref(false)
const logSheetTaskId = ref('')
const logSheetBackupId = ref('')
const logSheetJobId = ref('')
const logSheetError = ref('')
const awaitingRunLogs = ref(false)
const isRunRequestPending = ref(false)
const logRefreshNonce = ref(0)
let logRefreshTimer: ReturnType<typeof setTimeout> | undefined

const bufferedRunEvents = new Map<string, BufferedBackupRunEvent[]>()
const terminalToastJobIds = new Set<string>()
const RUN_RECONCILE_INTERVAL_MS = 1000
const RUN_RECONCILE_MAX_ATTEMPTS = 60
let activeRunRequestToken = 0
let activeBackupsFetchToken = 0
let activeServerContextToken = 0
let runReconcileTimer: ReturnType<typeof setTimeout> | undefined

const cancelLogRefresh = () => {
  if (logRefreshTimer !== undefined) {
    clearTimeout(logRefreshTimer)
    logRefreshTimer = undefined
  }
}

const cancelRunReconciliation = () => {
  if (runReconcileTimer !== undefined) {
    clearTimeout(runReconcileTimer)
    runReconcileTimer = undefined
  }
}

const invalidateRunConsole = () => {
  activeRunRequestToken++
  bufferedRunEvents.clear()
  cancelLogRefresh()
  cancelRunReconciliation()
  awaitingRunLogs.value = false
  isRunRequestPending.value = false
  logSheetBackupId.value = ''
  logSheetJobId.value = ''
  logSheetTaskId.value = ''
  logSheetError.value = ''
}

const scheduleLogRefresh = (jobId: string, taskId: string) => {
  cancelLogRefresh()
  const requestToken = activeRunRequestToken
  logRefreshTimer = setTimeout(() => {
    logRefreshTimer = undefined
    if (
      requestToken !== activeRunRequestToken
      || !isLogSheetOpen.value
      || logSheetJobId.value !== jobId
      || logSheetTaskId.value !== taskId
    ) return
    logRefreshNonce.value++
  }, 800)
}

watch(isLogSheetOpen, (open) => {
  if (!open) {
    invalidateRunConsole()
  }
})

const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

const applyRunEventToConsole = (data: BackupRunEventPayload, event: string) => {
  const taskId = String(data.task_id ?? '')
  if (taskId) {
    logSheetTaskId.value = taskId
    logSheetError.value = ''
    awaitingRunLogs.value = false
    cancelRunReconciliation()
  }

  if (event !== 'backup.run.succeeded' && event !== 'backup.run.failed') return

  awaitingRunLogs.value = false
  cancelRunReconciliation()
  if (event === 'backup.run.failed') {
    logSheetError.value =
      String(data.error ?? '').trim()
      || (logSheetTaskId.value ? '' : 'Backup failed before log streaming could start.')
  } else {
    logSheetError.value = ''
  }

  if (logSheetTaskId.value) {
    scheduleLogRefresh(logSheetJobId.value, logSheetTaskId.value)
  }
}

const applyRunSnapshotToConsole = (job: BackupJob) => {
  const taskId = String(job.task_id ?? '')
  if (taskId) {
    logSheetTaskId.value = taskId
    awaitingRunLogs.value = false
    cancelRunReconciliation()
  }
  logSheetError.value = ''

  if (job.status === 'failed') {
    awaitingRunLogs.value = false
    cancelRunReconciliation()
    logSheetError.value =
      String(job.error ?? '').trim()
      || (logSheetTaskId.value ? '' : 'Backup failed before log streaming could start.')
    if (logSheetTaskId.value) scheduleLogRefresh(job.id, logSheetTaskId.value)
    return 'backup.run.failed'
  }
  if (job.status === 'finished') {
    awaitingRunLogs.value = false
    cancelRunReconciliation()
    if (logSheetTaskId.value) scheduleLogRefresh(job.id, logSheetTaskId.value)
    return 'backup.run.succeeded'
  }
  return undefined
}

const ownsRunReconciliation = (jobId: string, requestToken: number) =>
  requestToken === activeRunRequestToken
  && isLogSheetOpen.value
  && awaitingRunLogs.value
  && logSheetJobId.value === jobId

const scheduleRunReconciliation = (
  backupId: string,
  jobId: string,
  serverId: string,
  requestToken: number,
  attempt = 0,
) => {
  cancelRunReconciliation()
  if (!ownsRunReconciliation(jobId, requestToken)) return
  if (attempt >= RUN_RECONCILE_MAX_ATTEMPTS) {
    awaitingRunLogs.value = false
    logSheetError.value = 'Live output is not available yet. Follow this backup in Active actions.'
    return
  }
  runReconcileTimer = setTimeout(() => {
    runReconcileTimer = undefined
    void reconcileRunConsole(backupId, jobId, serverId, requestToken, attempt + 1)
  }, RUN_RECONCILE_INTERVAL_MS)
}

async function reconcileRunConsole(
  backupId: string,
  jobId: string,
  serverId: string,
  requestToken: number,
  attempt: number,
) {
  if (!ownsRunReconciliation(jobId, requestToken)) return
  try {
    const response = await $api<{ data: Backup }>(`/servers/${serverId}/backups/${backupId}`)
    if (
      serverId !== props.serverId
      || !ownsRunReconciliation(jobId, requestToken)
    ) return

    const snapshot = response.data?.jobs?.find(job => job.id === jobId)
    if (snapshot) {
      const terminalEvent = applyRunSnapshotToConsole(snapshot)
      if (terminalEvent) {
        toastRunTerminal(
          jobId,
          { error: snapshot.error, task_id: snapshot.task_id ?? undefined },
          terminalEvent,
          Boolean(logSheetTaskId.value),
        )
        fetchBackups()
        return
      }
    }
  } catch {
    if (!ownsRunReconciliation(jobId, requestToken)) return
  }
  scheduleRunReconciliation(backupId, jobId, serverId, requestToken, attempt)
}

const toastRunTerminal = (
  jobId: string,
  data: BackupRunEventPayload,
  event: string,
  hasTaskLogs: boolean,
) => {
  if (jobId && terminalToastJobIds.has(jobId)) return
  if (jobId) terminalToastJobIds.add(jobId)
  if (event === 'backup.run.succeeded') {
    toast.success('Backup completed')
    return
  }

  const failureMessage = String(data.error ?? '').trim()
  toast.error(
    hasTaskLogs
      ? 'Backup failed — check the log console for details'
      : failureMessage || 'Backup failed',
  )
}

useBackupEvents(teamId, (data, event) => {
  const payload = data as BackupRunEventPayload
  const backupId = String(payload.backup_id ?? '')
  const jobId = String(payload.job_id ?? '')
  const serverId = String(payload.server_id ?? '')
  if (serverId !== props.serverId) return

  const isPreResponseCandidate =
    isLogSheetOpen.value
    && isRunRequestPending.value
    && backupId !== ''
    && backupId === logSheetBackupId.value
    && jobId !== ''
  if (isPreResponseCandidate) {
    const events = bufferedRunEvents.get(jobId) ?? []
    events.push({ data: { ...payload }, event })
    bufferedRunEvents.set(jobId, events)
  }

  const isActiveConsoleRun =
    isLogSheetOpen.value
    && !isRunRequestPending.value
    && jobId !== ''
    && jobId === logSheetJobId.value
  if (isActiveConsoleRun) applyRunEventToConsole(payload, event)

  if (event === 'backup.run.succeeded' || event === 'backup.run.failed') {
    fetchBackups()
    if (isPreResponseCandidate) return

    toastRunTerminal(
      jobId,
      payload,
      event,
      isActiveConsoleRun && Boolean(logSheetTaskId.value),
    )
  }
})

const fetchBackups = async () => {
  const serverId = props.serverId
  const fetchToken = ++activeBackupsFetchToken
  try {
    const [backupsData, providersData, dbData] = await Promise.all([
      $api<{ data: Backup[] }>(`/servers/${serverId}/backups`),
      $api<{ data: StorageProviderRecord[] }>('/storage-providers'),
      $api<{ data: Database[] }>(`/servers/${serverId}/databases`),
    ])
    if (fetchToken !== activeBackupsFetchToken || serverId !== props.serverId) return

    backups.value = backupsData.data || []
    storageProvidersList.value = providersData.data || []
    databases.value = dbData.data || []

    const providersMap: Record<string, string> = {}
    for (const provider of storageProvidersList.value) {
      providersMap[String(provider.id)] = provider.label
    }
    storageProvidersMap.value = providersMap
  } catch {
    if (fetchToken === activeBackupsFetchToken && serverId === props.serverId) {
      toast.error('Failed to load backups')
    }
  } finally {
    if (fetchToken === activeBackupsFetchToken && serverId === props.serverId) {
      isLoading.value = false
    }
  }
}

watch(
  () => props.serverId,
  () => {
    activeServerContextToken++
    invalidateRunConsole()
    terminalToastJobIds.clear()
    isLogSheetOpen.value = false
    isHistorySheetOpen.value = false
    selectedBackupForHistory.value = null
    isEditDialogOpen.value = false
    selectedBackupForEdit.value = null
    backups.value = []
    databases.value = []
    storageProvidersList.value = []
    storageProvidersMap.value = {}
    loadingActions.value = {}
    isLoading.value = true
    fetchBackups()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  activeServerContextToken++
  activeBackupsFetchToken++
  invalidateRunConsole()
})

const runBackup = async (backup: Backup) => {
  if (!confirmationDialog.value) return
  const serverContextToken = activeServerContextToken
  const requestServerId = props.serverId

  const result = await confirmationDialog.value.show({
    title: 'Run Backup',
    description: 'Are you sure you want to run this backup now?',
    confirmText: 'Run Backup',
    cancelText: 'Cancel',
  })

  if (
    !result.ok
    || serverContextToken !== activeServerContextToken
    || requestServerId !== props.serverId
  ) return

  loadingActions.value = { ...loadingActions.value, [backup.id]: 'run' }

  const runRequestToken = ++activeRunRequestToken
  bufferedRunEvents.clear()
  cancelLogRefresh()
  logSheetTaskId.value = ''
  logSheetBackupId.value = backup.id
  logSheetJobId.value = ''
  logSheetError.value = ''
  awaitingRunLogs.value = true
  isRunRequestPending.value = true
  isLogSheetOpen.value = true

  try {
    const response = await $api<{ data: BackupJob }>(`/servers/${requestServerId}/backups/${backup.id}/run`, {
      method: 'POST',
    })

    const job = response.data
    if (!job?.id || job.backup_id !== backup.id) {
      throw new Error('Backup started without a valid run identifier.')
    }

    if (
      serverContextToken !== activeServerContextToken
      || requestServerId !== props.serverId
    ) return

    fetchBackups()
    if (runRequestToken !== activeRunRequestToken || !isLogSheetOpen.value) return

    isRunRequestPending.value = false
    logSheetJobId.value = job.id
    applyRunSnapshotToConsole(job)

    const authoritativeEvents = bufferedRunEvents.get(job.id) ?? []
    bufferedRunEvents.clear()
    let authoritativeTerminalEvent: BufferedBackupRunEvent | undefined
    for (const bufferedEvent of authoritativeEvents) {
      applyRunEventToConsole(bufferedEvent.data, bufferedEvent.event)
      if (
        bufferedEvent.event === 'backup.run.succeeded'
        || bufferedEvent.event === 'backup.run.failed'
      ) {
        authoritativeTerminalEvent = bufferedEvent
      }
    }

    if (authoritativeTerminalEvent) {
      toastRunTerminal(
        job.id,
        authoritativeTerminalEvent.data,
        authoritativeTerminalEvent.event,
        Boolean(logSheetTaskId.value),
      )
    } else if (job.status === 'finished' || job.status === 'failed') {
      toastRunTerminal(
        job.id,
        { error: job.error, task_id: job.task_id ?? undefined },
        job.status === 'finished' ? 'backup.run.succeeded' : 'backup.run.failed',
        Boolean(logSheetTaskId.value),
      )
    } else {
      toast.success('Backup started')
      if (awaitingRunLogs.value) {
        scheduleRunReconciliation(
          backup.id,
          job.id,
          requestServerId,
          runRequestToken,
        )
      }
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string }; message?: string }
    const message = e.data?.message || e.message || 'Failed to start backup'
    if (
      serverContextToken !== activeServerContextToken
      || requestServerId !== props.serverId
    ) return

    fetchBackups()
    if (runRequestToken === activeRunRequestToken && isLogSheetOpen.value) {
      bufferedRunEvents.clear()
      isRunRequestPending.value = false
      awaitingRunLogs.value = false
      logSheetJobId.value = ''
      logSheetTaskId.value = ''
      logSheetError.value = message
    }
    toast.error(message)
  } finally {
    if (
      serverContextToken === activeServerContextToken
      && requestServerId === props.serverId
    ) {
      loadingActions.value = { ...loadingActions.value, [backup.id]: '' }
    }
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
            v-else-if="isLogSheetOpen && logSheetError"
            class="flex flex-1 items-center justify-center px-6 text-center"
          >
            <div class="max-w-lg space-y-2 text-destructive">
              <Icon name="lucide:circle-alert" class="mx-auto h-5 w-5" />
              <p class="text-sm font-medium">Backup output unavailable</p>
              <p class="whitespace-pre-wrap break-words text-xs">
                {{ logSheetError }}
              </p>
            </div>
          </div>
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
            <SharedCronSchedule :expression="row.cron_expression" time-zone="UTC" />
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

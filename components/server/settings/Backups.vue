<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'

interface BackupJob {
  id: string
  backup_id: string
  storage_provider_id: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  size: number
  size_in_mb: number
  error?: string
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

interface StorageProvider {
  id: string
  label: string
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const { open: openSettings } = useSettingsSheet()

const backups = ref<Backup[]>([])
const storageProviders = ref<Record<string, string>>({})
const isLoading = ref(true)
const loadingActions = ref<Record<string, string>>({})
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// History sheet state
const isHistorySheetOpen = ref(false)
const selectedBackupForHistory = ref<Backup | null>(null)

// Edit dialog state
const isEditDialogOpen = ref(false)
const selectedBackupForEdit = ref<Backup | null>(null)

const fetchBackups = async () => {
  try {
    const [backupsData, providersData] = await Promise.all([
      $api<{ data: Backup[] }>(`/servers/${props.serverId}/backups`),
      $api<{ data: StorageProvider[] }>('/storage-providers'),
    ])
    backups.value = backupsData.data || []

    // Convert providers array to map
    const providersMap: Record<string, string> = {}
    for (const provider of providersData.data || []) {
      providersMap[provider.id] = provider.label
    }
    storageProviders.value = providersMap
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
    fetchBackups()
  } catch {
    toast.error('Failed to start backup')
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
  return storageProviders.value[providerId] || 'Unknown'
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

const hasProviders = computed(() => Object.keys(storageProviders.value).length > 0)

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
    />

    <!-- Edit Backup Dialog -->
    <ServerCreateBackup
      v-if="selectedBackupForEdit"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :backup="selectedBackupForEdit"
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
            <ServerCreateBackup :server-id="serverId" @created="fetchBackups" />
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
            <Badge v-if="getLatestJobStatus(row)" :class="getStatusConfig(getLatestJobStatus(row)!).class">
              <Icon
                :name="getStatusConfig(getLatestJobStatus(row)!).icon"
                :class="['mr-1 h-3 w-3', getLatestJobStatus(row) === 'running' && 'animate-spin']"
              />
              {{ getStatusConfig(getLatestJobStatus(row)!).label }}
            </Badge>
            <span v-else class="text-sm text-muted-foreground">-</span>
          </template>
        </SharedDataTable>

        <div v-if="backups.length > 0" class="mt-6">
          <ServerCreateBackup :server-id="serverId" @created="fetchBackups" />
        </div>
      </template>
    </template>
  </div>
</template>

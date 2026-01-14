<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { Switch } from '~/components/ui/switch'

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

const toggleEnabled = async (backup: Backup) => {
  loadingActions.value = { ...loadingActions.value, [backup.id]: 'toggle' }

  try {
    await $api(`/servers/${props.serverId}/backups/${backup.id}`, {
      method: 'PUT',
      body: { enabled: !backup.enabled },
    })
    toast.success(backup.enabled ? 'Backup disabled' : 'Backup enabled')
    fetchBackups()
  } catch {
    toast.error('Failed to update backup')
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

onMounted(fetchBackups)
</script>

<template>
  <Card>
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
      :server-id="serverId"
      :backup="selectedBackupForEdit"
      :open="isEditDialogOpen"
      @update:open="(val) => { isEditDialogOpen = val; if (!val) selectedBackupForEdit = null }"
      @created="fetchBackups"
    />

    <CardHeader>
      <CardTitle>Backups</CardTitle>
      <CardDescription>Configure automatic backups for databases and files</CardDescription>
    </CardHeader>
    <CardContent>
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
          <!-- Empty State -->
          <div v-if="backups.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Icon name="lucide:database-backup" class="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 class="mb-2 text-xl font-semibold">No backup configurations</h2>
            <p class="mb-8 max-w-md text-muted-foreground">
              Create a backup configuration to automatically backup your databases and files.
            </p>
            <ServerCreateBackup :server-id="serverId" @created="fetchBackups" />
          </div>

          <!-- Backups Table -->
          <div v-else class="space-y-6">
            <div class="overflow-hidden rounded-lg border">
              <!-- Table Header -->
              <div class="hidden border-b bg-muted/50 px-6 py-3 md:grid md:grid-cols-12 md:gap-4">
                <div class="col-span-2 text-sm font-medium text-muted-foreground">Provider</div>
                <div class="col-span-2 text-sm font-medium text-muted-foreground">Source</div>
                <div class="col-span-2 text-sm font-medium text-muted-foreground">Schedule</div>
                <div class="col-span-2 text-sm font-medium text-muted-foreground">Last Backup</div>
                <div class="col-span-1 text-sm font-medium text-muted-foreground">Enabled</div>
                <div class="col-span-3 text-right text-sm font-medium text-muted-foreground">Actions</div>
              </div>

              <!-- Table Body -->
              <div class="divide-y">
                <div
                  v-for="backup in backups"
                  :key="backup.id"
                  class="px-4 py-4 transition-colors hover:bg-muted/30 md:px-6"
                >
                  <!-- Mobile Layout -->
                  <div class="flex flex-col gap-3 md:hidden">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-medium">{{ getProviderName(backup.storage_provider_id) }}</div>
                        <div class="text-sm text-muted-foreground">{{ getBackupSource(backup) }}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <Switch
                          :checked="backup.enabled"
                          :disabled="loadingActions[backup.id] === 'toggle'"
                          @update:checked="toggleEnabled(backup)"
                        />
                      </div>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <Badge v-if="getLatestJobStatus(backup)" :class="getStatusConfig(getLatestJobStatus(backup)!).class">
                          <Icon
                            :name="getStatusConfig(getLatestJobStatus(backup)!).icon"
                            :class="['mr-1 h-3 w-3', getLatestJobStatus(backup) === 'running' && 'animate-spin']"
                          />
                          {{ getStatusConfig(getLatestJobStatus(backup)!).label }}
                        </Badge>
                        <span v-else class="text-sm text-muted-foreground">No backups yet</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Button variant="ghost" size="icon" @click="runBackup(backup)">
                          <Icon v-if="loadingActions[backup.id] === 'run'" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                          <Icon v-else name="lucide:play" class="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" @click="openHistory(backup)">
                          <Icon name="lucide:history" class="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" @click="openEdit(backup)">
                          <Icon name="lucide:pencil" class="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" class="hover:bg-destructive/10 hover:text-destructive" @click="deleteBackup(backup)">
                          <Icon v-if="loadingActions[backup.id] === 'delete'" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                          <Icon v-else name="lucide:trash-2" class="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <!-- Desktop Layout -->
                  <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                    <div class="col-span-2">
                      <span class="font-medium">{{ getProviderName(backup.storage_provider_id) }}</span>
                    </div>

                    <div class="col-span-2">
                      <span class="text-sm">{{ getBackupSource(backup) }}</span>
                    </div>

                    <div class="col-span-2">
                      <code class="rounded bg-muted px-1.5 py-0.5 text-xs">{{ backup.cron_expression }}</code>
                    </div>

                    <div class="col-span-2">
                      <Badge v-if="getLatestJobStatus(backup)" :class="getStatusConfig(getLatestJobStatus(backup)!).class">
                        <Icon
                          :name="getStatusConfig(getLatestJobStatus(backup)!).icon"
                          :class="['mr-1 h-3 w-3', getLatestJobStatus(backup) === 'running' && 'animate-spin']"
                        />
                        {{ getStatusConfig(getLatestJobStatus(backup)!).label }}
                      </Badge>
                      <span v-else class="text-sm text-muted-foreground">-</span>
                    </div>

                    <div class="col-span-1">
                      <Switch
                        :checked="backup.enabled"
                        :disabled="loadingActions[backup.id] === 'toggle'"
                        @update:checked="toggleEnabled(backup)"
                      />
                    </div>

                    <div class="col-span-3 flex items-center justify-end gap-1">
                      <TooltipProvider :delay-duration="0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" size="icon" :disabled="!!loadingActions[backup.id]" @click="runBackup(backup)">
                              <Icon v-if="loadingActions[backup.id] === 'run'" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                              <Icon v-else name="lucide:play" class="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Run Backup</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider :delay-duration="0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" size="icon" @click="openHistory(backup)">
                              <Icon name="lucide:history" class="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View History</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider :delay-duration="0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button variant="ghost" size="icon" @click="openEdit(backup)">
                              <Icon name="lucide:pencil" class="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider :delay-duration="0">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              variant="ghost"
                              size="icon"
                              class="hover:bg-destructive/10 hover:text-destructive"
                              :disabled="!!loadingActions[backup.id]"
                              @click="deleteBackup(backup)"
                            >
                              <Icon v-if="loadingActions[backup.id] === 'delete'" name="lucide:loader-2" class="h-4 w-4 animate-spin" />
                              <Icon v-else name="lucide:trash-2" class="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ServerCreateBackup :server-id="serverId" @created="fetchBackups" />
          </div>
        </template>
      </template>
    </CardContent>
  </Card>
</template>

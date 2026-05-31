<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import type { Database, DatabaseUser } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const databases = ref<Database[]>([])
const databaseUsers = ref<DatabaseUser[]>([])
const isLoading = ref(true)
const isSyncing = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Create a map of database IDs to names for the CreateDatabaseUser component
const databasesMap = computed(() => {
  const map: Record<string, string> = {}
  for (const db of databases.value) {
    map[db.id] = db.name
  }
  return map
})

// State for editing a database user
const editingUser = ref<DatabaseUser | null>(null)
const isEditDialogOpen = ref(false)

const editUser = (user: DatabaseUser) => {
  editingUser.value = user
  isEditDialogOpen.value = true
}

const onEditDialogClose = () => {
  isEditDialogOpen.value = false
  editingUser.value = null
}

const onUserUpdated = () => {
  onEditDialogClose()
  fetchData()
}

const fetchData = async () => {
  try {
    const [dbData, usersData] = await Promise.all([
      $api<{ data: Database[] }>(`/servers/${props.serverId}/databases`),
      $api<{ data: DatabaseUser[] }>(`/servers/${props.serverId}/database-users`),
    ])
    databases.value = dbData.data
    databaseUsers.value = usersData.data
  } catch {
    toast.error('Failed to load databases')
  } finally {
    isLoading.value = false
  }
}

const syncDatabases = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Sync Databases',
    description: 'This will sync the databases from your server. Any databases not found on the server will be marked as uninstalled.',
    confirmText: 'Sync Databases',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    isSyncing.value = true
    try {
      await $api(`/servers/${props.serverId}/databases/sync`, {
        method: 'POST',
      })
      toast.success('Database sync started')
      await fetchData()
    } catch {
      toast.error('Failed to sync databases')
    } finally {
      isSyncing.value = false
    }
  }
}

// Trigger a manual run of the first backup configured for this
// database. Most servers have a single backup per database; if there
// are multiple, we pick the first enabled one. Mirrors the row action
// on the Advanced → Backups tab — same POST endpoint, same async
// task flow — so the user can kick off a backup without leaving the
// Databases tab where they're already focused.
const isRunningBackup = ref<string | null>(null)
const runDatabaseBackup = async (database: Database) => {
  const backups = database.backups ?? []
  if (backups.length === 0) return
  // Prefer an enabled backup; fall back to the first one — a disabled
  // backup is still runnable from the UI (the scheduler just doesn't
  // fire it automatically).
  const target = backups.find((b) => b.enabled) ?? backups[0]
  isRunningBackup.value = database.id
  try {
    await $api(`/servers/${props.serverId}/backups/${target.id}/run`, {
      method: 'POST',
    })
    toast.success(`Backup started for ${database.name}`)
  } catch {
    toast.error(`Failed to start backup for ${database.name}`)
  } finally {
    isRunningBackup.value = null
  }
}

const deleteDatabase = async (database: Database) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Database',
    description: `Are you sure you want to delete "${database.name}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/databases/${database.id}`, {
        method: 'DELETE',
      })
      databases.value = databases.value.filter((d) => d.id !== database.id)
      toast.success('Database deleted successfully')
    } catch {
      toast.error('Failed to delete database')
    }
  }
}

const deleteUser = async (user: DatabaseUser) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Database User',
    description: `Are you sure you want to delete user "${user.name}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/database-users/${user.id}`, {
        method: 'DELETE',
      })
      databaseUsers.value = databaseUsers.value.filter((u) => u.id !== user.id)
      toast.success('Database user deleted successfully')
    } catch {
      toast.error('Failed to delete database user')
    }
  }
}

const databaseColumns = [
  { key: 'name', label: 'Database name', width: '30%' },
  { key: 'status', label: 'Status', width: '25%' },
  { key: 'installed_at', label: 'Installed at', width: '25%', type: 'relative-date' as const },
]

const userColumns = [
  { key: 'name', label: 'Username', width: '30%' },
  { key: 'status', label: 'Status', width: '25%' },
  { key: 'installed_at', label: 'Installed at', width: '25%', type: 'relative-date' as const },
]

onMounted(fetchData)
</script>

<template>
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Edit Database User Dialog -->
    <ServerCreateDatabaseUser
      v-if="editingUser"
      :server-id="serverId"
      :databases="databasesMap"
      :user="editingUser"
      :open="isEditDialogOpen"
      @update:open="(val) => { if (!val) onEditDialogClose() }"
      @updated="onUserUpdated"
    />

    <!-- Databases Section -->
    <div>
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold">Databases</h3>
          <p class="text-sm text-muted-foreground">Manage your databases</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="isSyncing"
            @click="syncDatabases"
          >
            <Icon
              name="lucide:refresh-cw"
              class="mr-2 h-4 w-4"
              :class="{ 'animate-spin': isSyncing }"
            />
            Sync
          </Button>
          <ServerCreateDatabase v-if="databases.length > 0" :server-id="serverId" @created="fetchData" />
        </div>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SharedDataTable
          :data="databases"
          :columns="databaseColumns"
          :actions="[
            {
              label: 'Run Backup',
              icon: 'lucide:play',
              onClick: runDatabaseBackup,
              show: (db: Database) => (db.backups?.length ?? 0) > 0,
            },
            {
              label: 'Delete',
              icon: 'lucide:trash-2',
              onClick: deleteDatabase,
              className: 'hover:text-white hover:bg-destructive/90',
            },
          ]"
          empty-icon="lucide:database"
          empty-title="No databases found"
          empty-description="Create your first database to get started."
        >
          <template #empty>
            <ServerCreateDatabase :server-id="serverId" @created="fetchData" />
          </template>

          <template #cell-name="{ value }">
            <span class="font-medium">{{ value }}</span>
          </template>

          <template #cell-status="{ row }">
            <SharedInstallationStatus v-bind="row" />
          </template>

          <template #cell-installed_at="{ value }">
            <SharedDateTooltip v-if="value" :date="String(value)" />
            <span v-else class="text-muted-foreground">-</span>
          </template>
        </SharedDataTable>
      </template>
    </div>

    <!-- Database Users Section -->
    <div>
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold">Database Users</h3>
          <p class="text-sm text-muted-foreground">Manage database users and their permissions</p>
        </div>
        <ServerCreateDatabaseUser v-if="databaseUsers.length > 0" :server-id="serverId" :databases="databasesMap" @created="fetchData" />
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SharedDataTable
          :data="databaseUsers"
          :columns="userColumns"
          :actions="[
            {
              label: 'Edit',
              icon: 'lucide:pencil',
              onClick: editUser,
            },
            {
              label: 'Delete',
              icon: 'lucide:trash-2',
              onClick: deleteUser,
              className: 'hover:text-white hover:bg-destructive/90',
              show: (user: DatabaseUser) => user.name !== 'root',
            },
          ]"
          empty-icon="lucide:user"
          empty-title="No database users found"
          empty-description="Create your first database user to get started."
        >
          <template #empty>
            <ServerCreateDatabaseUser :server-id="serverId" :databases="databasesMap" @created="fetchData" />
          </template>

          <template #cell-name="{ value }">
            <span class="font-medium">{{ value }}</span>
          </template>

          <template #cell-status="{ row }">
            <SharedInstallationStatus v-bind="row" />
          </template>

          <template #cell-installed_at="{ value }">
            <SharedDateTooltip v-if="value" :date="String(value)" />
            <span v-else class="text-muted-foreground">-</span>
          </template>
        </SharedDataTable>
      </template>
    </div>
  </div>
</template>

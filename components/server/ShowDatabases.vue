<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
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
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Databases Card -->
    <Card class="bg-background">
      <CardHeader>
        <div class="flex items-start justify-between">
          <div>
            <CardTitle class="text-xl">Databases</CardTitle>
            <CardDescription>Manage your databases and database users</CardDescription>
          </div>
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
            Sync Databases
          </Button>
        </div>
      </CardHeader>

      <CardContent>
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
                icon: 'lucide:rotate-ccw',
                onClick: () => {},
                show: (db: Database) => Boolean((db as any).backups?.length),
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

            <template #cell-status="{ row }">
              <SharedInstallationStatus v-bind="row" />
            </template>

            <template #cell-installed_at="{ value }">
              <SharedDateTooltip v-if="value" :date="String(value)" />
              <span v-else class="text-muted-foreground">-</span>
            </template>
          </SharedDataTable>

          <div v-if="databases.length > 0" class="mt-6">
            <ServerCreateDatabase :server-id="serverId" @created="fetchData" />
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- Database Users Card -->
    <Card class="bg-background">
      <CardHeader>
        <CardTitle class="text-xl">Database Users</CardTitle>
        <CardDescription>Manage database users and their permissions</CardDescription>
      </CardHeader>

      <CardContent>
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <SharedDataTable
            :data="databaseUsers"
            :columns="userColumns"
            :actions="[
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
              <ServerCreateDatabaseUser :server-id="serverId" @created="fetchData" />
            </template>

            <template #cell-status="{ row }">
              <SharedInstallationStatus v-bind="row" />
            </template>

            <template #cell-installed_at="{ value }">
              <SharedDateTooltip v-if="value" :date="String(value)" />
              <span v-else class="text-muted-foreground">-</span>
            </template>
          </SharedDataTable>

          <div v-if="databaseUsers.length > 0" class="mt-6">
            <ServerCreateDatabaseUser :server-id="serverId" @created="fetchData" />
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

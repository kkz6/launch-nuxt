<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { Database, DatabaseUser } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const databases = ref<Database[]>([])
const databaseUsers = ref<DatabaseUser[]>([])
const isLoading = ref(true)
const activeTab = ref('databases')
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

onMounted(fetchData)
</script>

<template>
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader>
      <CardTitle class="text-xl">Databases</CardTitle>
      <CardDescription>Manage databases and users on this server</CardDescription>
    </CardHeader>

    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <Tabs v-else v-model="activeTab" class="w-full">
        <TabsList class="mb-4">
          <TabsTrigger value="databases">
            <Icon name="lucide:database" class="mr-2 h-4 w-4" />
            Databases ({{ databases.length }})
          </TabsTrigger>
          <TabsTrigger value="users">
            <Icon name="lucide:users" class="mr-2 h-4 w-4" />
            Users ({{ databaseUsers.length }})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="databases" class="space-y-4">
          <SharedDataTable
            :data="databases"
            :columns="[
              { key: 'name', label: 'Name', width: '40%' },
              { key: 'created_at', label: 'Created', width: '30%' },
            ]"
            :actions="[
              { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteDatabase, destructive: true },
            ]"
            empty-title="No databases found"
            empty-icon="lucide:database"
          >
            <template #empty>
              <ServerCreateDatabase :server-id="serverId" @created="fetchData" />
            </template>
          </SharedDataTable>
          <ServerCreateDatabase v-if="databases.length > 0" :server-id="serverId" @created="fetchData" />
        </TabsContent>

        <TabsContent value="users" class="space-y-4">
          <SharedDataTable
            :data="databaseUsers"
            :columns="[
              { key: 'name', label: 'Username', width: '40%' },
              { key: 'created_at', label: 'Created', width: '30%' },
            ]"
            :actions="[
              { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteUser, destructive: true },
            ]"
            empty-title="No database users found"
            empty-icon="lucide:user"
          >
            <template #empty>
              <ServerCreateDatabaseUser :server-id="serverId" @created="fetchData" />
            </template>
          </SharedDataTable>
          <ServerCreateDatabaseUser v-if="databaseUsers.length > 0" :server-id="serverId" @created="fetchData" />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>

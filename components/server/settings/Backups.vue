<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import type { Backup } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const backups = ref<Backup[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchBackups = async () => {
  try {
    const data = await $api<{ data: Backup[] }>(`/servers/${props.serverId}/backups`)
    backups.value = data.data
  } catch {
    toast.error('Failed to load backups')
  } finally {
    isLoading.value = false
  }
}

const deleteBackup = async (backup: Backup) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Backup Configuration',
    description: 'Are you sure you want to delete this backup configuration?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/backups/${backup.id}`, {
        method: 'DELETE',
      })
      backups.value = backups.value.filter((b) => b.id !== backup.id)
      toast.success('Backup configuration deleted')
    } catch {
      toast.error('Failed to delete backup')
    }
  }
}

const runBackup = async (backup: Backup) => {
  try {
    await $api(`/servers/${props.serverId}/backups/${backup.id}/run`, {
      method: 'POST',
    })
    toast.success('Backup started')
  } catch {
    toast.error('Failed to start backup')
  }
}

onMounted(fetchBackups)
</script>

<template>
  <Card>
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader>
      <CardTitle>Backups</CardTitle>
      <CardDescription>Configure automatic backups for databases and files</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SharedDataTable
          :data="backups"
          :columns="[
            { key: 'source_type', label: 'Type', width: '15%' },
            { key: 'database_name', label: 'Source', width: '25%' },
            { key: 'frequency', label: 'Frequency', width: '20%' },
            { key: 'last_backup_at', label: 'Last Backup', width: '20%' },
          ]"
          :actions="[
            { label: 'Run Now', icon: 'lucide:play', onClick: runBackup },
            { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteBackup, destructive: true },
          ]"
          empty-title="No backup configurations found"
          empty-icon="lucide:database-backup"
        >
          <template #empty>
            <ServerCreateBackup :server-id="serverId" @created="fetchBackups" />
          </template>
        </SharedDataTable>

        <div v-if="backups.length > 0" class="mt-6">
          <ServerCreateBackup :server-id="serverId" @created="fetchBackups" />
        </div>
      </template>
    </CardContent>
  </Card>
</template>

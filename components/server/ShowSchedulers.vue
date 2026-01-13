<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import type { Cron } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const schedulers = ref<Cron[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Log viewer state
const selectedSchedulerForLogs = ref<Cron | null>(null)
const isLogDialogOpen = ref(false)

// Edit dialog state
const selectedSchedulerForEdit = ref<Cron | null>(null)
const isEditDialogOpen = ref(false)

const viewLogs = (cron: Cron) => {
  selectedSchedulerForLogs.value = cron
  isLogDialogOpen.value = true
}

const editScheduler = (cron: Cron) => {
  selectedSchedulerForEdit.value = cron
  isEditDialogOpen.value = true
}

const fetchData = async () => {
  try {
    const data = await $api<{ data: Cron[] }>(`/servers/${props.serverId}/crons`)
    schedulers.value = data.data
  } catch {
    toast.error('Failed to load schedulers')
  } finally {
    isLoading.value = false
  }
}

const deleteScheduler = async (cron: Cron) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Scheduler',
    description: 'This action cannot be undone. This will permanently delete the scheduled task from your server.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the command to confirm deletion:',
    inputVerificationText: cron.command,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/crons/${cron.id}`, {
        method: 'DELETE',
      })
      schedulers.value = schedulers.value.filter((s) => s.id !== cron.id)
      toast.success('Scheduler deleted successfully')
    } catch {
      toast.error('Failed to delete scheduler')
    }
  } else {
    toast.info('Cancelled')
  }
}

const handleSchedulerUpdated = () => {
  isEditDialogOpen.value = false
  selectedSchedulerForEdit.value = null
  fetchData()
}

// Clean up selected scheduler when dialog closes
watch(isEditDialogOpen, (open) => {
  if (!open) {
    selectedSchedulerForEdit.value = null
  }
})

onMounted(fetchData)
</script>

<template>
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Log Viewer Dialog -->
    <Dialog v-model:open="isLogDialogOpen">
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle class="text-xl">Scheduler Logs</DialogTitle>
          <DialogDescription>{{ selectedSchedulerForLogs?.command }}</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4 pt-2.5">
          <LogsServerLogs
            v-if="isLogDialogOpen && selectedSchedulerForLogs"
            :server-id="serverId"
            entity="cron"
            :entity-id="selectedSchedulerForLogs.id"
            type-switcher
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- Edit Scheduler Dialog -->
    <ServerCreateScheduler
      v-if="selectedSchedulerForEdit"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :cron="selectedSchedulerForEdit"
      @updated="handleSchedulerUpdated"
    />

    <CardHeader>
      <CardTitle class="text-xl">Schedulers</CardTitle>
      <CardDescription>Manage cron jobs on this server</CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="mt-4">
          <SharedDataTable
            :data="schedulers"
            :columns="[
              { key: 'command', label: 'Command', width: '25%' },
              { key: 'user', label: 'User', width: '15%' },
              { key: 'frequency', label: 'Frequency', width: '20%' },
              { key: 'status', label: 'Status', width: '15%' },
              { key: 'installed_at', label: 'Installed', width: '15%', type: 'relative-date' },
            ]"
            :actions="[
              { label: 'View Logs', icon: 'lucide:scroll-text', onClick: viewLogs },
              { label: 'Edit', icon: 'lucide:pencil', onClick: editScheduler },
              { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteScheduler, destructive: true },
            ]"
            empty-title="No scheduled tasks found"
            empty-icon="lucide:clock"
          >
            <template #empty>
              <ServerCreateScheduler :server-id="serverId" @created="fetchData" />
            </template>

            <template #cell-status="{ row }">
              <SharedInstallationStatus v-bind="row" />
            </template>
          </SharedDataTable>

          <div v-if="schedulers.length > 0" class="mt-6">
            <ServerCreateScheduler :server-id="serverId" @created="fetchData" />
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

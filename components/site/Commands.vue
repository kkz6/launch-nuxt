<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

interface Command {
  id: string
  command: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  output?: string
  user: {
    id: string
    name: string
  }
  created_at: string
}

interface Props {
  serverId: string
  siteId: string
}

const props = defineProps<Props>()

const commands = ref<Command[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning'> = {
  pending: 'warning',
  running: 'default',
  finished: 'success',
  failed: 'destructive',
}

const fetchCommands = async () => {
  try {
    const data = await $api<{ data: Command[] }>(`/servers/${props.serverId}/sites/${props.siteId}/commands`)
    commands.value = data.data
  } catch {
    toast.error('Failed to load commands')
  } finally {
    isLoading.value = false
  }
}

// Subscribe to real-time command events
useSiteCommandEvents(props.siteId, (data) => {
  // Refresh commands when any command event is received
  fetchCommands()
})

const deleteCommand = async (command: Command) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Command',
    description: 'Are you sure you want to delete this command from history?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/sites/${props.siteId}/commands/${command.id}`, {
        method: 'DELETE',
      })
      commands.value = commands.value.filter((c) => c.id !== command.id)
      toast.success('Command deleted')
    } catch {
      toast.error('Failed to delete command')
    }
  }
}

const runCommandAgain = async (command: Command) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Run Command Again',
    description: `Are you sure you want to run "${command.command}" again?`,
    confirmText: 'Run',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/sites/${props.siteId}/commands/${command.id}/again`, {
        method: 'POST',
      })
      toast.success('Command execution started')
      fetchCommands()
    } catch {
      toast.error('Failed to run command')
    }
  }
}

onMounted(fetchCommands)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">SSH Commands</h3>
        <p class="text-sm text-muted-foreground">Run and manage SSH commands on your site</p>
      </div>
      <SiteRunCommand v-if="commands.length > 0" :server-id="serverId" :site-id="siteId" @executed="fetchCommands" />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <SharedDataTable
        :data="commands"
        :columns="[
          { key: 'user', label: 'User', width: '15%' },
          { key: 'command', label: 'Command', width: '35%' },
          { key: 'created_at', label: 'Created', width: '20%' },
          { key: 'status', label: 'Status', width: '15%' },
        ]"
        empty-title="No commands found"
        empty-icon="lucide:terminal"
      >
        <template #cell-user="{ row }">
          {{ row.user?.name || 'Unknown' }}
        </template>

        <template #cell-command="{ row }">
          <code class="rounded bg-muted px-2 py-1 text-sm">{{ row.command }}</code>
        </template>

        <template #cell-created_at="{ row }">
          <SharedDateTooltip :date="row.created_at" />
        </template>

        <template #cell-status="{ row }">
          <Badge :variant="statusVariants[row.status] || 'secondary'" class="gap-1.5">
            <Icon
              v-if="row.status === 'running'"
              name="lucide:loader-2"
              class="h-3 w-3 animate-spin"
            />
            <span class="capitalize">{{ row.status }}</span>
          </Badge>
        </template>

        <template #actions="{ item }">
          <SharedOutputViewer
            v-if="item.output"
            title="Command Output"
            :description="item.command"
            :output="item.output"
          >
            <Button variant="ghost" size="icon" title="View Output">
              <Icon name="lucide:terminal-square" class="h-4 w-4" />
            </Button>
          </SharedOutputViewer>
          <Button variant="ghost" size="icon" title="Run Again" @click="runCommandAgain(item)">
            <Icon name="lucide:rotate-ccw" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            class="hover:bg-destructive/90 hover:text-white"
            @click="deleteCommand(item)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </template>

        <template #empty>
          <SiteRunCommand :server-id="serverId" :site-id="siteId" @executed="fetchCommands" />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

// Archived servers
interface ArchivedServer {
  id: string
  name: string
  public_ipv4: string
  provider: string
  archived_at: string
}

const servers = ref<ArchivedServer[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const providerLabels: Record<string, string> = {
  aws: 'AWS',
  digitalocean: 'DigitalOcean',
  linode: 'Linode',
  vultr: 'Vultr',
  hetzner: 'Hetzner',
  custom_server: 'Custom Server',
}

const fetchServers = async () => {
  try {
    const response = await $api<{ data: ArchivedServer[] }>('/servers/archived')
    servers.value = response.data
  } catch {
    toast.error('Failed to load archived servers')
  } finally {
    isLoading.value = false
  }
}

const restoreServer = async (server: ArchivedServer) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Restore Server',
    description: `Are you sure you want to restore "${server.name}"?`,
    confirmText: 'Restore',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${server.id}/restore`, { method: 'POST' })
      servers.value = servers.value.filter((s) => s.id !== server.id)
      toast.success('Server restored')
    } catch {
      toast.error('Failed to restore server')
    }
  }
}

const deleteServer = async (server: ArchivedServer) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Server Permanently',
    description: `Are you sure you want to permanently delete "${server.name}"? This action cannot be undone.`,
    confirmText: 'Delete Permanently',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${server.id}`, { method: 'DELETE' })
      servers.value = servers.value.filter((s) => s.id !== server.id)
      toast.success('Server deleted permanently')
    } catch {
      toast.error('Failed to delete server')
    }
  }
}

onMounted(fetchServers)
</script>

<template>
  <div class="px-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Archived Servers Section -->
    <div>
      <h3 class="mb-4 text-base font-semibold">Archived Servers</h3>
      <p class="mb-4 text-sm text-muted-foreground">
        View and manage your archived servers. Restore them or delete permanently.
      </p>

      <div v-if="isLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="servers.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-2 py-2">
            <Icon name="lucide:archive" class="h-8 w-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">No archived servers</p>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="server in servers"
            :key="server.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ server.name }}</span>
                <span class="text-xs text-muted-foreground">{{ server.public_ipv4 }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{{ providerLabels[server.provider] || server.provider }}</span>
                <span>-</span>
                <span>Archived {{ formatDistanceToNow(new Date(server.archived_at), { addSuffix: true }) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" @click="restoreServer(server)">
                <Icon name="lucide:rotate-ccw" class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" @click="deleteServer(server)">
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

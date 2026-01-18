<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'

interface Script {
  id: string
  name: string
  user: string
  script: string
}

interface Server {
  id: string
  name: string
  public_ipv4: string
  provider: string
  connected: boolean
}

interface Props {
  script: Script
}

const props = defineProps<Props>()

const emit = defineEmits<{
  ran: []
}>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const isLoadingServers = ref(true)
const servers = ref<Server[]>([])
const selectedServers = ref<string[]>([])

const providerLabels: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  hetzner: 'Hetzner',
  linode: 'Linode',
  vultr: 'Vultr',
  aws: 'AWS',
  custom_server: 'Custom',
}

const fetchServers = async () => {
  isLoadingServers.value = true
  try {
    const response = await $api<{ data: Server[] }>('/servers')
    servers.value = response.data.filter((s) => s.connected)
  } catch {
    toast.error('Failed to load servers')
  } finally {
    isLoadingServers.value = false
  }
}

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (selectedServers.value.length === 0) return false
  return true
})

const toggleServer = (serverId: string) => {
  const index = selectedServers.value.indexOf(serverId)
  if (index === -1) {
    selectedServers.value.push(serverId)
  } else {
    selectedServers.value.splice(index, 1)
  }
}

const selectAll = () => {
  if (selectedServers.value.length === servers.value.length) {
    selectedServers.value = []
  } else {
    selectedServers.value = servers.value.map((s) => s.id)
  }
}

const isSelected = (serverId: string) => {
  return selectedServers.value.includes(serverId)
}

const allSelected = computed(() => {
  return servers.value.length > 0 && selectedServers.value.length === servers.value.length
})

const onSubmit = async () => {
  if (selectedServers.value.length === 0) {
    toast.error('Please select at least one server')
    return
  }

  isLoading.value = true
  try {
    await $api(`/scripts/${props.script.id}/run`, {
      method: 'POST',
      body: {
        servers: selectedServers.value,
      },
    })

    toast.success(`Script "${props.script.name}" started on ${selectedServers.value.length} server(s)`)
    open.value = false
    selectedServers.value = []
    emit('ran')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to run script')
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    selectedServers.value = []
    fetchServers()
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Run Script</DialogTitle>
        <DialogDescription>
          Select the servers to run "{{ script.name }}" on.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Script preview -->
        <div class="rounded-lg border bg-muted/50 p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium">{{ script.name }}</span>
            <Badge variant="secondary">{{ script.user }}</Badge>
          </div>
          <pre class="max-h-32 overflow-auto rounded bg-background p-2 text-xs"><code>{{ script.script }}</code></pre>
        </div>

        <!-- Server selection -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Select Servers</Label>
            <Button
              v-if="servers.length > 0"
              type="button"
              variant="ghost"
              size="sm"
              @click="selectAll"
            >
              {{ allSelected ? 'Deselect All' : 'Select All' }}
            </Button>
          </div>

          <div v-if="isLoadingServers" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
          </div>

          <div v-else-if="servers.length === 0" class="rounded-lg border border-dashed p-6 text-center">
            <Icon name="lucide:server-off" class="mx-auto h-8 w-8 text-muted-foreground" />
            <p class="mt-2 text-sm text-muted-foreground">No connected servers available</p>
          </div>

          <div v-else class="max-h-64 space-y-2 overflow-auto">
            <div
              v-for="server in servers"
              :key="server.id"
              class="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              :class="{ 'border-primary bg-primary/5': isSelected(server.id) }"
              @click="toggleServer(server.id)"
            >
              <Checkbox
                :checked="isSelected(server.id)"
                @click.stop
                @update:checked="toggleServer(server.id)"
              />
              <div class="flex flex-1 items-center justify-between">
                <div>
                  <p class="font-medium">{{ server.name }}</p>
                  <p class="text-sm text-muted-foreground">{{ server.public_ipv4 }}</p>
                </div>
                <Badge variant="outline">
                  {{ providerLabels[server.provider] || server.provider }}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <p v-if="selectedServers.length > 0" class="text-sm text-muted-foreground">
          {{ selectedServers.length }} server(s) selected
        </p>
      </div>

      <DialogFooter class="mt-4">
        <Button type="button" variant="outline" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!canSubmit" @click="onSubmit">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          <Icon v-else name="lucide:play" class="mr-2 h-4 w-4" />
          Run on {{ selectedServers.length }} Server(s)
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

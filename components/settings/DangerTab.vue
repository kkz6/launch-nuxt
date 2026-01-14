<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { formatDistanceToNow } from 'date-fns'

const archivedServersOpen = ref(true)
const deleteAccountOpen = ref(false)

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

// Delete account
const { user, logout } = useAuth()
const deleteConfirmation = ref('')
const isDeletingAccount = ref(false)

const canDeleteAccount = computed(() => {
  return deleteConfirmation.value.toLowerCase() === 'delete my account'
})

const deleteAccount = async () => {
  if (!canDeleteAccount.value) return

  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Account',
    description: 'This will permanently delete your account and all associated data. This action cannot be undone.',
    confirmText: 'Delete Account',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    isDeletingAccount.value = true
    try {
      await $api('/user', { method: 'DELETE' })
      toast.success('Account deleted')
      logout()
    } catch {
      toast.error('Failed to delete account')
    } finally {
      isDeletingAccount.value = false
    }
  }
}

onMounted(fetchServers)
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Archived Servers -->
    <Collapsible v-model:open="archivedServersOpen" class="rounded-lg border border-destructive/50">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:archive" class="size-4 text-destructive" />
          <span class="font-medium">Archived Servers</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': archivedServersOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <p class="mb-4 text-sm text-muted-foreground">
          View and manage your archived servers. Restore them or delete permanently.
        </p>

        <div v-if="isLoading" class="flex items-center justify-center py-4">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div v-if="servers.length === 0" class="py-4 text-center">
            <Icon name="lucide:archive" class="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">No archived servers</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="server in servers"
              :key="server.id"
              class="flex items-center justify-between rounded-lg border p-3"
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
      </CollapsibleContent>
    </Collapsible>

    <!-- Delete Account -->
    <Collapsible v-model:open="deleteAccountOpen" class="rounded-lg border border-destructive/50">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:user-x" class="size-4 text-destructive" />
          <span class="font-medium">Delete Account</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': deleteAccountOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div class="space-y-4">
          <div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <p class="font-medium">Warning: This action is irreversible</p>
            <p class="mt-1">
              Deleting your account will permanently remove all your data, including servers, sites, and settings.
            </p>
          </div>

          <div class="space-y-2">
            <Label for="delete-confirmation">
              Type <span class="font-mono font-medium">delete my account</span> to confirm
            </Label>
            <Input
              id="delete-confirmation"
              v-model="deleteConfirmation"
              type="text"
              placeholder="delete my account"
            />
          </div>

          <Button
            variant="destructive"
            :disabled="!canDeleteAccount || isDeletingAccount"
            @click="deleteAccount"
          >
            <Icon
              v-if="isDeletingAccount"
              name="lucide:loader-2"
              class="mr-2 block size-4 animate-spin"
            />
            Delete Account
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>

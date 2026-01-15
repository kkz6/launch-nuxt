<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

interface SSHKey {
  id: string
  user_id: string
  public_key: string
  description: string
  name: string
  fingerprint: string
  remove_url: string
  created_at: string
  updated_at: string
}

const sshKeys = ref<SSHKey[]>([])
const isLoading = ref(true)
const isAddOpen = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchSSHKeys = async () => {
  try {
    const response = await $api<{ data: SSHKey[] }>('/ssh-keys')
    sshKeys.value = response.data
  } catch {
    toast.error('Failed to load SSH keys')
  } finally {
    isLoading.value = false
  }
}

const deleteSSHKey = async (sshKey: SSHKey) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete SSH Key',
    description: `Are you sure you want to delete the SSH key "${sshKey.name}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/ssh-keys/${sshKey.id}`, { method: 'DELETE' })
      sshKeys.value = sshKeys.value.filter((k) => k.id !== sshKey.id)
      toast.success('SSH key deleted successfully')
    } catch {
      toast.error('Failed to delete SSH key')
    }
  }
}

onMounted(fetchSSHKeys)
</script>

<template>
  <div class="px-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <h3 class="mb-1 text-base font-semibold">SSH Keys</h3>
    <p class="mb-4 text-sm text-muted-foreground">
      Manage your SSH keys for secure server access.
    </p>

    <div v-if="isLoading" class="flex items-center justify-center py-4">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <div v-if="sshKeys.length === 0" class="rounded-lg border p-4">
        <div class="flex flex-col items-center gap-2 py-2">
          <Icon name="lucide:key-round" class="h-8 w-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">No SSH keys found</p>
          <SettingsAddSSHKey v-model:open="isAddOpen" @created="fetchSSHKeys">
            <Button size="sm">
              <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
              Add SSH Key
            </Button>
          </SettingsAddSSHKey>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="key in sshKeys"
          :key="key.id"
          class="flex items-center justify-between rounded-lg border p-4"
        >
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <Icon name="lucide:key-round" class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm font-medium">{{ key.name }}</span>
            </div>
            <p v-if="key.description" class="text-xs text-muted-foreground">
              {{ key.description }}
            </p>
            <p class="break-all font-mono text-xs text-muted-foreground">
              {{ key.fingerprint }}
            </p>
            <p class="text-xs text-muted-foreground">
              Updated {{ formatDistanceToNow(new Date(key.updated_at), { addSuffix: true }) }}
            </p>
          </div>
          <Button variant="ghost" size="sm" @click="deleteSSHKey(key)">
            <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <button
          class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          @click="isAddOpen = true"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          Add SSH key
        </button>
        <SettingsAddSSHKey v-model:open="isAddOpen" @created="fetchSSHKeys" />
      </div>
    </template>
  </div>
</template>

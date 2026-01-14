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
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-medium">SSH Keys</h3>
        <p class="text-sm text-muted-foreground">Manage your SSH keys for secure server access</p>
      </div>
      <SettingsAddSSHKey @created="fetchSSHKeys" />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <div v-if="sshKeys.length === 0" class="flex flex-col items-center gap-3 py-8">
        <Icon name="lucide:key-round" class="h-8 w-8 text-muted-foreground" />
        <span class="text-sm text-muted-foreground">No SSH keys found</span>
        <SettingsAddSSHKey @created="fetchSSHKeys" />
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="key in sshKeys"
          :key="key.id"
          class="rounded-lg border p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1">
              <div class="flex items-center gap-2">
                <Icon name="lucide:key-round" class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ key.name }}</span>
              </div>
              <p v-if="key.description" class="text-sm text-muted-foreground">
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
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import type { SSHKey } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const sshKeys = ref<SSHKey[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchKeys = async () => {
  try {
    const data = await $api<{ data: SSHKey[] }>(`/servers/${props.serverId}/ssh-keys`)
    sshKeys.value = data.data
  } catch {
    toast.error('Failed to load SSH keys')
  } finally {
    isLoading.value = false
  }
}

const deleteKey = async (key: SSHKey) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete SSH Key',
    description: `Are you sure you want to remove "${key.name}" from this server?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/ssh-keys/${key.id}`, {
        method: 'DELETE',
      })
      sshKeys.value = sshKeys.value.filter((k) => k.id !== key.id)
      toast.success('SSH key removed')
    } catch {
      toast.error('Failed to remove SSH key')
    }
  }
}

onMounted(fetchKeys)
</script>

<template>
  <Card>
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader>
      <CardTitle>SSH Keys</CardTitle>
      <CardDescription>Manage SSH keys that can access this server</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SharedDataTable
          :data="sshKeys"
          :columns="[
            { key: 'name', label: 'Name', width: '30%' },
            { key: 'fingerprint', label: 'Fingerprint', width: '40%' },
            { key: 'created_at', label: 'Added', width: '20%' },
          ]"
          :actions="[
            { label: 'Remove', icon: 'lucide:trash-2', onClick: deleteKey, destructive: true },
          ]"
          empty-title="No SSH keys found"
          empty-icon="lucide:key"
        >
          <template #empty>
            <ServerAddSshKey :server-id="serverId" @created="fetchKeys" />
          </template>
        </SharedDataTable>

        <div v-if="sshKeys.length > 0" class="mt-6">
          <ServerAddSshKey :server-id="serverId" @created="fetchKeys" />
        </div>
      </template>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { FirewallRule } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const firewallRules = ref<FirewallRule[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const networkActions: Record<string, string> = {
  allow: 'Allow',
  deny: 'Deny',
}

const fetchData = async () => {
  try {
    const data = await $api<{ data: FirewallRule[] }>(`/servers/${props.serverId}/firewall-rules`)
    firewallRules.value = data.data
  } catch {
    toast.error('Failed to load firewall rules')
  } finally {
    isLoading.value = false
  }
}

const deleteRule = async (rule: FirewallRule) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Firewall Rule',
    description: `Are you sure you want to delete "${rule.name}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/firewall-rules/${rule.id}`, {
        method: 'DELETE',
      })
      firewallRules.value = firewallRules.value.filter((r) => r.id !== rule.id)
      toast.success('Firewall rule deleted successfully')
    } catch {
      toast.error('Failed to delete firewall rule')
    }
  }
}

onMounted(fetchData)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Network / Firewall</h3>
        <p class="text-sm text-muted-foreground">Manage firewall rules for this server</p>
      </div>
      <ServerCreateNetwork v-if="firewallRules.length > 0" :server-id="serverId" @created="fetchData" />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <SharedDataTable
        :data="firewallRules"
        :columns="[
          { key: 'name', label: 'Name', width: '25%' },
          { key: 'port', label: 'Port', width: '20%' },
          { key: 'action', label: 'Action', width: '20%' },
          { key: 'from_ipv4', label: 'From IP', width: '25%', hideOnMobile: true },
        ]"
        :actions="[
          { label: 'Edit', icon: 'lucide:pencil', onClick: (rule: FirewallRule) => {} },
          { label: 'Delete', icon: 'lucide:trash-2', onClick: deleteRule, destructive: true },
        ]"
        empty-title="No firewall rules found"
        empty-icon="lucide:network"
      >
        <template #empty>
          <ServerCreateNetwork :server-id="serverId" @created="fetchData" />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>

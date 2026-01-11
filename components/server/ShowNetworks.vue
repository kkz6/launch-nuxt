<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
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
  <div class="w-full">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <Card class="h-full bg-transparent">
      <CardHeader>
        <CardTitle class="text-xl">Network / Firewall</CardTitle>
        <CardDescription>Manage firewall rules for this server</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div class="mt-4">
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

            <div v-if="firewallRules.length > 0" class="mt-6">
              <ServerCreateNetwork :server-id="serverId" @created="fetchData" />
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

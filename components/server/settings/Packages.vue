<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

interface Package {
  name: string
  version: string
  installed: boolean
  upgradeable: boolean
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const packages = ref<Package[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchPackages = async () => {
  try {
    const data = await $api<{ data: Package[] }>(`/servers/${props.serverId}/packages`)
    packages.value = data.data
  } catch {
    toast.error('Failed to load packages')
  } finally {
    isLoading.value = false
  }
}

const upgradePackage = async (pkg: Package) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Upgrade Package',
    description: `Are you sure you want to upgrade "${pkg.name}"?`,
    confirmText: 'Upgrade',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/packages/${pkg.name}/upgrade`, {
        method: 'POST',
      })
      toast.success('Package upgrade initiated')
      fetchPackages()
    } catch {
      toast.error('Failed to upgrade package')
    }
  }
}

const upgradeAll = async () => {
  if (!confirmationDialog.value) return

  const upgradeableCount = packages.value.filter((p) => p.upgradeable).length
  if (upgradeableCount === 0) {
    toast.info('All packages are up to date')
    return
  }

  const result = await confirmationDialog.value.show({
    title: 'Upgrade All Packages',
    description: `Are you sure you want to upgrade ${upgradeableCount} packages?`,
    confirmText: 'Upgrade All',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/packages/upgrade-all`, {
        method: 'POST',
      })
      toast.success('Package upgrades initiated')
      fetchPackages()
    } catch {
      toast.error('Failed to upgrade packages')
    }
  }
}

onMounted(fetchPackages)
</script>

<template>
  <Card>
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle>Packages</CardTitle>
        <CardDescription>Installed system packages and updates</CardDescription>
      </div>
      <Button variant="outline" @click="upgradeAll">
        <Icon name="lucide:arrow-up-circle" class="mr-2 h-4 w-4" />
        Upgrade All
      </Button>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SharedDataTable
          :data="packages"
          :columns="[
            { key: 'name', label: 'Package', width: '40%' },
            { key: 'version', label: 'Version', width: '30%' },
            { key: 'upgradeable', label: 'Status', width: '20%' },
          ]"
          :actions="[
            { label: 'Upgrade', icon: 'lucide:arrow-up-circle', onClick: upgradePackage },
          ]"
          empty-title="No packages found"
          empty-icon="lucide:package"
        />
      </template>
    </CardContent>
  </Card>
</template>

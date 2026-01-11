<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

interface PhpVersion {
  version: string
  cli_version: string
  installed: boolean
  is_default: boolean
  status: string
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const phpVersions = ref<PhpVersion[]>([])
const availableVersions = ref<string[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchPhpVersions = async () => {
  try {
    const data = await $api<{ data: PhpVersion[]; available: string[] }>(`/servers/${props.serverId}/php`)
    phpVersions.value = data.data
    availableVersions.value = data.available || []
  } catch {
    toast.error('Failed to load PHP versions')
  } finally {
    isLoading.value = false
  }
}

const installVersion = async (version: string) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Install PHP Version',
    description: `Are you sure you want to install PHP ${version}?`,
    confirmText: 'Install',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/php`, {
        method: 'POST',
        body: { version },
      })
      toast.success('PHP installation initiated')
      fetchPhpVersions()
    } catch {
      toast.error('Failed to install PHP version')
    }
  }
}

const setDefault = async (version: string) => {
  try {
    await $api(`/servers/${props.serverId}/php/${version}/default`, {
      method: 'POST',
    })
    toast.success('Default PHP version updated')
    fetchPhpVersions()
  } catch {
    toast.error('Failed to set default PHP version')
  }
}

const removeVersion = async (version: string) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Remove PHP Version',
    description: `Are you sure you want to remove PHP ${version}? This cannot be undone.`,
    confirmText: 'Remove',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/php/${version}`, {
        method: 'DELETE',
      })
      toast.success('PHP version removed')
      fetchPhpVersions()
    } catch {
      toast.error('Failed to remove PHP version')
    }
  }
}

onMounted(fetchPhpVersions)
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <Card>
      <CardHeader>
        <CardTitle>PHP Versions</CardTitle>
        <CardDescription>Manage PHP versions installed on this server</CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div class="space-y-4">
            <div
              v-for="php in phpVersions"
              :key="php.version"
              class="flex items-center justify-between rounded-lg border p-4"
            >
              <div class="flex items-center gap-4">
                <Icon name="lucide:file-code" class="h-8 w-8 text-muted-foreground" />
                <div>
                  <p class="font-medium">PHP {{ php.version }}</p>
                  <p class="text-sm text-muted-foreground">CLI: {{ php.cli_version }}</p>
                </div>
                <Badge v-if="php.is_default" variant="default">Default</Badge>
              </div>
              <div class="flex gap-2">
                <Button
                  v-if="!php.is_default"
                  variant="outline"
                  size="sm"
                  @click="setDefault(php.version)"
                >
                  Set Default
                </Button>
                <Button
                  v-if="!php.is_default"
                  variant="outline"
                  size="sm"
                  @click="removeVersion(php.version)"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>

    <Card v-if="availableVersions.length > 0">
      <CardHeader>
        <CardTitle>Install New Version</CardTitle>
        <CardDescription>Add additional PHP versions to this server</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="version in availableVersions"
            :key="version"
            variant="outline"
            @click="installVersion(version)"
          >
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            PHP {{ version }}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

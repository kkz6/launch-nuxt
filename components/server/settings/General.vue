<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Switch } from '~/components/ui/switch'
import { Separator } from '~/components/ui/separator'
import type { Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()

const name = ref(props.server.name)
const description = ref(props.server.description || '')
const autoUpdate = ref(props.server.auto_update === 'true' || props.server.auto_update === '1')
const isLoading = ref(false)
const deleteLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)
const siteCount = ref(0)

const canDelete = computed(() => siteCount.value === 0)

onMounted(async () => {
  try {
    const data = await $api<{ data: { count: number } }>(`/servers/${props.server.id}/site-count`)
    siteCount.value = data.data?.count || 0
  } catch {
    siteCount.value = 0
  }
})

const updateServer = async () => {
  isLoading.value = true
  try {
    await $api(`/servers/${props.server.id}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        description: description.value,
        auto_update: autoUpdate.value,
      },
    })
    toast.success('Server settings updated')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to update server')
  } finally {
    isLoading.value = false
  }
}

const deleteServer = async () => {
  if (siteCount.value > 0) {
    toast.error('Cannot delete server with active sites. Please delete all sites first.')
    return
  }

  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Server',
    description: `Are you sure you want to delete "${props.server.name}"? This action cannot be undone and will permanently remove the server from your account.`,
    confirmText: 'Delete Server',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the server name to confirm deletion:',
    inputVerificationText: props.server.name,
  })

  if (!result.ok) return

  deleteLoading.value = true
  try {
    await $api(`/servers/${props.server.id}`, {
      method: 'DELETE',
    })
    toast.success('Server deleted successfully')
    navigateTo('/servers')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Unable to delete server')
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Server Information -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Server Information</h3>
        <p class="text-sm text-muted-foreground">
          Update your server name and description.
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Server Name</Label>
          <Input id="name" v-model="name" placeholder="Enter server name" />
        </div>

        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Textarea
            id="description"
            v-model="description"
            placeholder="Enter a description for your server (optional)"
            :rows="3"
          />
        </div>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>Auto Updates</Label>
            <p class="text-sm text-muted-foreground">
              Automatically install security updates
            </p>
          </div>
          <Switch v-model="autoUpdate" />
        </div>

        <Button :disabled="isLoading" @click="updateServer">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Save Changes
        </Button>
      </div>
    </div>

    <Separator />

    <!-- Danger Zone -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
        <p class="text-sm text-muted-foreground">
          Permanently delete this server. This action cannot be undone.
        </p>
      </div>

      <div v-if="!canDelete" class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50">
        <div class="space-y-1">
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Cannot delete server
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            This server has {{ siteCount }} active site{{ siteCount !== 1 ? 's' : '' }}.
            Please delete all sites before removing the server.
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        :disabled="!canDelete || deleteLoading"
        @click="deleteServer"
      >
        <Icon v-if="deleteLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        Delete Server
      </Button>
    </div>
  </div>
</template>

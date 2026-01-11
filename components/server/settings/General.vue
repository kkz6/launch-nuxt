<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Switch } from '~/components/ui/switch'
import type { Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()

const name = ref(props.server.name)
const description = ref(props.server.description || '')
const autoUpdate = ref(props.server.auto_update === 'true' || props.server.auto_update === '1')
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

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
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Server',
    description: 'Are you sure you want to delete this server? This action cannot be undone and all data will be lost.',
    confirmText: 'Delete Server',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.server.id}`, {
        method: 'DELETE',
      })
      toast.success('Server deleted')
      navigateTo('/servers')
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to delete server')
    }
  }
}
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>Update your server's basic information</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Server Name</Label>
          <Input id="name" v-model="name" />
        </div>

        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Textarea id="description" v-model="description" rows="3" />
        </div>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>Auto Updates</Label>
            <p class="text-sm text-muted-foreground">
              Automatically install security updates
            </p>
          </div>
          <Switch v-model:checked="autoUpdate" />
        </div>

        <Button :disabled="isLoading" @click="updateServer">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Save Changes
        </Button>
      </CardContent>
    </Card>

    <Card class="border-destructive">
      <CardHeader>
        <CardTitle class="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible and destructive actions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">Delete Server</p>
            <p class="text-sm text-muted-foreground">
              Permanently delete this server and all its data
            </p>
          </div>
          <Button variant="destructive" @click="deleteServer">
            Delete Server
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

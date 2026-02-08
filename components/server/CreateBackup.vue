<script setup lang="ts">
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { Database, StorageProviderRecord } from '~/types'

interface BackupJob {
  id: string
  status: string
}

interface Backup {
  id: string
  storage_provider_id: string
  cron_expression: string
  include_files: string[]
  exclude_files: string[]
  retention: number
  notification_on_failure: boolean
  notification_on_success: boolean
  enabled: boolean
  path: string
  databases: string[]
  jobs?: BackupJob[]
}

interface Props {
  serverId: string
  backup?: Backup
  databases?: Database[]
  storageProviders?: StorageProviderRecord[]
}

const props = withDefaults(defineProps<Props>(), {
  backup: undefined,
  databases: () => [],
  storageProviders: () => [],
})

const emit = defineEmits<{
  created: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditing = computed(() => !!props.backup)
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Form values
const storageProviderId = ref('')
const cronExpression = ref('0 0 * * *')
const path = ref('/')
const retention = ref(10)
const selectedDatabases = ref<string[]>([])
const notificationOnFailure = ref(true)
const notificationOnSuccess = ref(false)
const enabled = ref(true)

const cronPresets: Record<string, { label: string; value: string }> = {
  hourly: { label: 'Hourly', value: '0 * * * *' },
  daily: { label: 'Daily at midnight', value: '0 0 * * *' },
  weekly: { label: 'Weekly on Sunday', value: '0 0 * * 0' },
  monthly: { label: 'Monthly on 1st', value: '0 0 1 * *' },
}

const schema = z.object({
  storage_provider_id: z.string().min(1, 'Storage provider is required'),
  cron_expression: z.string().min(1, 'Schedule is required'),
  path: z.string().min(1, 'Path is required'),
  retention: z.number().min(1, 'Must keep at least 1 backup'),
  databases: z.array(z.string()).optional(),
  notification_on_failure: z.boolean(),
  notification_on_success: z.boolean(),
  enabled: z.boolean(),
})

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (storageProviderId.value.length === 0) return false
  if (cronExpression.value.trim().length === 0) return false
  if (path.value.trim().length === 0) return false
  if (retention.value < 1) return false
  return true
})

const resetForm = () => {
  storageProviderId.value = props.backup?.storage_provider_id ?? ''
  cronExpression.value = props.backup?.cron_expression ?? '0 0 * * *'
  path.value = props.backup?.path ?? '/'
  retention.value = props.backup?.retention ?? 10
  selectedDatabases.value = props.backup?.databases ?? []
  notificationOnFailure.value = props.backup?.notification_on_failure ?? true
  notificationOnSuccess.value = props.backup?.notification_on_success ?? false
  enabled.value = props.backup?.enabled ?? true
  errors.value = {}
}

const toggleDatabase = (dbId: string) => {
  if (selectedDatabases.value.includes(dbId)) {
    selectedDatabases.value = selectedDatabases.value.filter(id => id !== dbId)
  } else {
    selectedDatabases.value = [...selectedDatabases.value, dbId]
  }
}

const validate = () => {
  const result = schema.safeParse({
    storage_provider_id: storageProviderId.value,
    cron_expression: cronExpression.value.trim(),
    path: path.value.trim(),
    retention: retention.value,
    databases: selectedDatabases.value,
    notification_on_failure: notificationOnFailure.value,
    notification_on_success: notificationOnSuccess.value,
    enabled: enabled.value,
  })
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      storage_provider_id: fieldErrors.storage_provider_id?.[0] || '',
      cron_expression: fieldErrors.cron_expression?.[0] || '',
      path: fieldErrors.path?.[0] || '',
      retention: fieldErrors.retention?.[0] || '',
    }
    return null
  }
  errors.value = {}
  return result.data
}

const onSubmit = async () => {
  const data = validate()
  if (!data) return

  if (!confirmationDialog.value) return

  const actionText = isEditing.value ? 'Update' : 'Create'
  const result = await confirmationDialog.value.show({
    title: `${actionText} Backup Configuration`,
    description: `Are you sure you want to ${actionText.toLowerCase()} this backup configuration?`,
    confirmText: actionText,
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  isLoading.value = true
  try {
    if (isEditing.value && props.backup) {
      await $api(`/servers/${props.serverId}/backups/${props.backup.id}`, {
        method: 'PUT',
        body: data,
      })
      toast.success('Backup configuration updated')
    } else {
      await $api(`/servers/${props.serverId}/backups`, {
        method: 'POST',
        body: data,
      })
      toast.success('Backup configuration created')
    }
    emit('created')
    open.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || `Failed to ${actionText.toLowerCase()} backup`)
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
}, { immediate: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
        Create Backup
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ isEditing ? 'Edit' : 'Create' }} Backup Configuration</DialogTitle>
        <DialogDescription>
          Configure automatic backups for your databases and files
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <!-- Storage Provider -->
        <div class="space-y-2">
          <Label for="storage_provider_id">Storage Provider</Label>
          <Select v-model="storageProviderId">
            <SelectTrigger>
              <SelectValue placeholder="Select storage provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="provider in props.storageProviders" :key="provider.id" :value="String(provider.id)">
                {{ provider.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.storage_provider_id" class="text-sm text-destructive">{{ errors.storage_provider_id }}</p>
        </div>

        <!-- Path -->
        <div class="space-y-2">
          <Label for="path">Backup Path</Label>
          <Input
            id="path"
            v-model="path"
            placeholder="/"
          />
          <p class="text-xs text-muted-foreground">The path on the server to backup</p>
        </div>

        <!-- Databases -->
        <div v-if="props.databases.length > 0" class="space-y-2">
          <Label>Databases to Include</Label>
          <div class="grid grid-cols-2 gap-2 rounded-lg border p-3">
            <div v-for="db in props.databases" :key="db.id" class="flex items-center space-x-2">
              <Checkbox
                :id="`db-${db.id}`"
                :checked="selectedDatabases.includes(db.id)"
                @update:checked="toggleDatabase(db.id)"
              />
              <Label :for="`db-${db.id}`" class="font-normal">{{ db.name }}</Label>
            </div>
          </div>
          <p v-if="props.databases.length === 0" class="text-xs text-muted-foreground">No databases available</p>
        </div>

        <!-- Schedule -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Schedule Preset</Label>
            <Select @update:model-value="cronExpression = String($event)">
              <SelectTrigger>
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(preset, key) in cronPresets" :key="key" :value="preset.value">
                  {{ preset.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="cron_expression">Cron Expression</Label>
            <Input
              id="cron_expression"
              v-model="cronExpression"
              placeholder="0 0 * * *"
            />
          </div>
        </div>

        <!-- Retention -->
        <div class="space-y-2">
          <Label for="retention">Retention (number of backups to keep)</Label>
          <Input
            id="retention"
            v-model.number="retention"
            type="number"
            min="1"
          />
        </div>

        <!-- Notifications & Enabled -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-3">
            <Label>Notifications</Label>
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <Checkbox
                  id="notification_on_failure"
                  v-model="notificationOnFailure"
                />
                <Label for="notification_on_failure" class="font-normal">Notify on failure</Label>
              </div>
              <div class="flex items-center space-x-2">
                <Checkbox
                  id="notification_on_success"
                  v-model="notificationOnSuccess"
                />
                <Label for="notification_on_success" class="font-normal">Notify on success</Label>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <Label>Status</Label>
            <div class="flex items-center space-x-2">
              <Checkbox
                id="enabled"
                v-model="enabled"
              />
              <Label for="enabled" class="font-normal">Enable backup</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ isEditing ? 'Update' : 'Create' }} Backup
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

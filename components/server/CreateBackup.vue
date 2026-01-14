<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
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
}

const props = withDefaults(defineProps<Props>(), {
  backup: undefined,
})

const emit = defineEmits<{
  created: []
}>()

const open = defineModel<boolean>('open', { default: false })

const isEditing = computed(() => !!props.backup)
const isLoading = ref(false)
const databases = ref<Database[]>([])
const storageProviders = ref<StorageProviderRecord[]>([])
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const cronPresets: Record<string, { label: string; value: string }> = {
  hourly: { label: 'Hourly', value: '0 * * * *' },
  daily: { label: 'Daily at midnight', value: '0 0 * * *' },
  weekly: { label: 'Weekly on Sunday', value: '0 0 * * 0' },
  monthly: { label: 'Monthly on 1st', value: '0 0 1 * *' },
}

const schema = toTypedSchema(z.object({
  storage_provider_id: z.string().min(1, 'Storage provider is required'),
  cron_expression: z.string().min(1, 'Schedule is required'),
  path: z.string().min(1, 'Path is required'),
  retention: z.number().min(1, 'Must keep at least 1 backup'),
  databases: z.array(z.string()).optional(),
  notification_on_failure: z.boolean(),
  notification_on_success: z.boolean(),
  enabled: z.boolean(),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors, setValues } = useForm({
  validationSchema: schema,
  validateOnMount: false,
  initialValues: {
    storage_provider_id: '',
    cron_expression: '0 0 * * *',
    path: '/',
    retention: 10,
    databases: [] as string[],
    notification_on_failure: true,
    notification_on_success: false,
    enabled: true,
  },
})

const setStringField = (field: 'storage_provider_id' | 'cron_expression' | 'path', value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const fetchOptions = async () => {
  try {
    const [dbData, storageData] = await Promise.all([
      $api<{ data: Database[] }>(`/servers/${props.serverId}/databases`),
      $api<{ data: StorageProviderRecord[] }>('/storage-providers'),
    ])
    databases.value = dbData.data || []
    storageProviders.value = storageData.data || []
  } catch {
    // Silent fail
  }
}

const toggleDatabase = (dbId: string) => {
  const current = values.databases || []
  if (current.includes(dbId)) {
    setFieldValue('databases', current.filter(id => id !== dbId))
  } else {
    setFieldValue('databases', [...current, dbId])
  }
}

const onSubmit = handleSubmit(async (data) => {
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
})

watch(open, (isOpen) => {
  if (isOpen) {
    fetchOptions()
    if (props.backup) {
      // Populate form with backup data
      setValues({
        storage_provider_id: props.backup.storage_provider_id,
        cron_expression: props.backup.cron_expression,
        path: props.backup.path,
        retention: props.backup.retention,
        databases: props.backup.databases || [],
        notification_on_failure: props.backup.notification_on_failure,
        notification_on_success: props.backup.notification_on_success,
        enabled: props.backup.enabled,
      })
    } else {
      resetForm()
    }
  }
})
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
          <Select :model-value="values.storage_provider_id" @update:model-value="setStringField('storage_provider_id', $event)">
            <SelectTrigger>
              <SelectValue placeholder="Select storage provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="provider in storageProviders" :key="provider.id" :value="String(provider.id)">
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
            :model-value="values.path"
            placeholder="/"
            @update:model-value="setStringField('path', $event)"
          />
          <p class="text-xs text-muted-foreground">The path on the server to backup</p>
        </div>

        <!-- Databases -->
        <div v-if="databases.length > 0" class="space-y-2">
          <Label>Databases to Include</Label>
          <div class="grid grid-cols-2 gap-2 rounded-lg border p-3">
            <div v-for="db in databases" :key="db.id" class="flex items-center space-x-2">
              <Checkbox
                :id="`db-${db.id}`"
                :checked="values.databases?.includes(db.id)"
                @update:checked="toggleDatabase(db.id)"
              />
              <Label :for="`db-${db.id}`" class="font-normal">{{ db.name }}</Label>
            </div>
          </div>
          <p v-if="databases.length === 0" class="text-xs text-muted-foreground">No databases available</p>
        </div>

        <!-- Schedule -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>Schedule Preset</Label>
            <Select @update:model-value="setStringField('cron_expression', $event)">
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
              :model-value="values.cron_expression"
              placeholder="0 0 * * *"
              @update:model-value="setStringField('cron_expression', $event)"
            />
          </div>
        </div>

        <!-- Retention -->
        <div class="space-y-2">
          <Label for="retention">Retention (number of backups to keep)</Label>
          <Input
            id="retention"
            type="number"
            :model-value="values.retention"
            min="1"
            @update:model-value="setFieldValue('retention', Number($event))"
          />
        </div>

        <!-- Notifications -->
        <div class="space-y-3">
          <Label>Notifications</Label>
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <Checkbox
                id="notification_on_failure"
                :checked="values.notification_on_failure"
                @update:checked="setFieldValue('notification_on_failure', $event)"
              />
              <Label for="notification_on_failure" class="font-normal">Notify on failure</Label>
            </div>
            <div class="flex items-center space-x-2">
              <Checkbox
                id="notification_on_success"
                :checked="values.notification_on_success"
                @update:checked="setFieldValue('notification_on_success', $event)"
              />
              <Label for="notification_on_success" class="font-normal">Notify on success</Label>
            </div>
          </div>
        </div>

        <!-- Enabled -->
        <div class="flex items-center space-x-2">
          <Checkbox
            id="enabled"
            :checked="values.enabled"
            @update:checked="setFieldValue('enabled', $event)"
          />
          <Label for="enabled" class="font-normal">Enable backup</Label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ isEditing ? 'Update' : 'Create' }} Backup
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

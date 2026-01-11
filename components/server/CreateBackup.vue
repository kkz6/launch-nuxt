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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import type { Database, StorageProviderRecord } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const databases = ref<Database[]>([])
const storageProviders = ref<StorageProviderRecord[]>([])
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const frequencies: Record<string, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
}

const schema = toTypedSchema(z.object({
  source_type: z.enum(['database', 'files']),
  database_name: z.string().optional(),
  files_path: z.string().optional(),
  storage_provider_id: z.string().min(1, 'Storage provider is required'),
  storage_path: z.string().min(1, 'Storage path is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  keep_backups: z.number().min(1, 'Must keep at least 1 backup'),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  validateOnMount: false,
  initialValues: {
    source_type: 'database' as const,
    database_name: '',
    files_path: '',
    storage_provider_id: '',
    storage_path: '/backups',
    frequency: 'daily',
    keep_backups: 7,
  },
})

type StringFields = 'database_name' | 'files_path' | 'storage_provider_id' | 'storage_path' | 'frequency'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const fetchOptions = async () => {
  try {
    const [dbData, storageData] = await Promise.all([
      $api<{ data: Database[] }>(`/servers/${props.serverId}/databases`),
      $api<{ data: StorageProviderRecord[] }>('/storage-providers'),
    ])
    databases.value = dbData.data
    storageProviders.value = storageData.data
  } catch {
    // Silent fail
  }
}

const onSubmit = handleSubmit(async (data) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Create Backup Configuration',
    description: 'Are you sure you want to create this backup configuration?',
    confirmText: 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    await $api(`/servers/${props.serverId}/backups`, {
      method: 'POST',
      body: data,
    })
    toast.success('Backup configuration created')
    emit('created')
    isOpen.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to create backup')
  } finally {
    isLoading.value = false
  }
})

watch(isOpen, (open) => {
  if (open) {
    fetchOptions()
  } else {
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          Create Backup
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Create Backup Configuration</DialogTitle>
        <DialogDescription>
          Configure automatic backups for your databases or files
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit="onSubmit">
        <div class="space-y-2">
          <Label>Backup Type</Label>
          <RadioGroup
            :model-value="values.source_type"
            class="flex gap-4"
            @update:model-value="setFieldValue('source_type', $event as 'database' | 'files')"
          >
            <div class="flex items-center space-x-2">
              <RadioGroupItem id="type-database" value="database" />
              <Label for="type-database" class="font-normal">Database</Label>
            </div>
            <div class="flex items-center space-x-2">
              <RadioGroupItem id="type-files" value="files" />
              <Label for="type-files" class="font-normal">Files</Label>
            </div>
          </RadioGroup>
        </div>

        <div v-if="values.source_type === 'database'" class="space-y-2">
          <Label for="database_name">Database</Label>
          <Select :model-value="values.database_name" @update:model-value="setStringField('database_name', $event)">
            <SelectTrigger>
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="db in databases" :key="db.id" :value="db.name">
                {{ db.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="values.source_type === 'files'" class="space-y-2">
          <Label for="files_path">Files Path</Label>
          <Input
            id="files_path"
            :model-value="values.files_path"
            placeholder="/home/launch/example.com"
            @update:model-value="setStringField('files_path', $event)"
          />
        </div>

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

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="storage_path">Storage Path</Label>
            <Input
              id="storage_path"
              :model-value="values.storage_path"
              @update:model-value="setStringField('storage_path', $event)"
            />
          </div>

          <div class="space-y-2">
            <Label for="frequency">Frequency</Label>
            <Select :model-value="values.frequency" @update:model-value="setStringField('frequency', $event)">
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in frequencies" :key="value" :value="value">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="keep_backups">Retention (days)</Label>
          <Input
            id="keep_backups"
            type="number"
            :model-value="values.keep_backups"
            min="1"
            @update:model-value="setFieldValue('keep_backups', Number($event))"
          />
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Create Backup
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

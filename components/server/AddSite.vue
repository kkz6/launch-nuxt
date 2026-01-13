<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Settings } from 'lucide-vue-next'
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
import { Switch } from '~/components/ui/switch'

interface Props {
  serverId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isAdvancedOpen = ref(false)
const isLoading = ref(false)
const hasSubmitted = ref(false)

interface PhpVersion {
  value: string
  label: string
  is_default: boolean
}

interface Database {
  id: string
  name: string
  status: string
}

interface DatabaseUser {
  id: string
  name: string
  status: string
}

const phpVersions = ref<PhpVersion[]>([])
const sourceControls = ref<Record<string, string>>({})
const databases = ref<Record<string, string>>({})
const databaseUsers = ref<Record<string, string>>({})
const hasDatabase = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const applicationTypes: Record<string, string> = {
  laravel: 'Laravel',
  wordpress: 'WordPress',
  generic: 'Generic PHP',
}

const advancedOptions = ref({
  create_database: false,
  database_option: 'new' as 'new' | 'existing',
  database_id: '',
  database_name: '',
  database_user_option: 'new' as 'new' | 'existing',
  database_user_id: '',
  database_user_name: '',
  database_user_password: '',
  create_scheduler: false,
  create_queue: false,
})

const schema = toTypedSchema(z.object({
  address: z.string().min(1, 'Domain is required'),
  type: z.enum(['laravel', 'wordpress', 'generic']),
  php_version: z.string().min(1, 'PHP version is required'),
  web_folder: z.string().default('/public'),
  zero_downtime_deployment: z.boolean().default(false),
  source_control_id: z.string().optional(),
  repository_branch: z.string().optional(),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    address: '',
    type: 'laravel' as const,
    php_version: '',
    web_folder: '/public',
    zero_downtime_deployment: false,
    source_control_id: '',
    repository_branch: 'main',
  },
})

type StringFields = 'address' | 'php_version' | 'web_folder' | 'source_control_id' | 'repository_branch'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '', false)
}

const fetchOptions = async () => {
  try {
    const [phpData, scData] = await Promise.all([
      $api<{ data: PhpVersion[] }>(`/servers/${props.serverId}/php-versions`),
      $api<{ data: Record<string, string> }>('/source-controls'),
    ])
    phpVersions.value = phpData.data
    sourceControls.value = scData.data

    if (phpVersions.value.length > 0) {
      const defaultVersion = phpVersions.value.find(v => v.is_default)
      setFieldValue('php_version', defaultVersion?.value ?? phpVersions.value[0].value, false)
    }
  } catch {
    // Silent fail - options will be empty
  }

  // Fetch database info for advanced options (optional - don't fail if endpoints don't exist)
  try {
    const [dbData, dbUserData] = await Promise.all([
      $api<{ data: Database[] }>(`/servers/${props.serverId}/databases`),
      $api<{ data: DatabaseUser[] }>(`/servers/${props.serverId}/database-users`),
    ])
    // Transform arrays to Record<id, name> for dropdowns
    databases.value = (dbData.data || []).reduce((acc, db) => {
      acc[db.id] = db.name
      return acc
    }, {} as Record<string, string>)
    databaseUsers.value = (dbUserData.data || []).reduce((acc, user) => {
      acc[user.id] = user.name
      return acc
    }, {} as Record<string, string>)
  } catch {
    // Silent fail - existing databases/users will be empty but user can still create new ones
  }
}

const submitHandler = handleSubmit(async (data) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Create Site',
    description: `Are you sure you want to create site "${data.address}"?`,
    confirmText: 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    // Merge advanced options into payload
    const payload = {
      ...data,
      ...advancedOptions.value,
    }

    await $api(`/servers/${props.serverId}/sites`, {
      method: 'POST',
      body: payload,
    })
    toast.success('Site created successfully')
    emit('created')
    isOpen.value = false
    resetForm()
    resetAdvancedOptions()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'An error occurred')
  } finally {
    isLoading.value = false
  }
})

const onSubmit = () => {
  hasSubmitted.value = true
  submitHandler()
}

const resetAdvancedOptions = () => {
  advancedOptions.value = {
    create_database: false,
    database_option: 'new',
    database_id: '',
    database_name: '',
    database_user_option: 'new',
    database_user_id: '',
    database_user_name: '',
    database_user_password: '',
    create_scheduler: false,
    create_queue: false,
  }
}

watch(isOpen, (open) => {
  if (open) {
    fetchOptions()
    hasSubmitted.value = false
  } else {
    resetForm()
    resetAdvancedOptions()
    hasSubmitted.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Add New Site</DialogTitle>
        <DialogDescription>
          Create a new website on this server
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="address">Domain</Label>
          <Input
            id="address"
            :model-value="values.address"
            placeholder="example.com"
            @update:model-value="setStringField('address', $event)"
          />
          <p v-if="hasSubmitted && errors.address" class="text-sm text-destructive">{{ errors.address }}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="php_version">PHP Version</Label>
            <Select :model-value="values.php_version" @update:model-value="setStringField('php_version', $event)">
              <SelectTrigger>
                <SelectValue placeholder="Select PHP version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="version in phpVersions" :key="version.value" :value="version.value">
                  {{ version.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="type">Site Type</Label>
            <Select :model-value="values.type" @update:model-value="(val) => val && setFieldValue('type', val as 'laravel' | 'wordpress' | 'generic', false)">
              <SelectTrigger>
                <SelectValue placeholder="Select site type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in applicationTypes" :key="value" :value="value">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="values.type !== 'wordpress'" class="space-y-4">
          <div class="space-y-2">
            <Label for="web_folder">Web Folder</Label>
            <Input
              id="web_folder"
              :model-value="values.web_folder"
              placeholder="/public"
              @update:model-value="setStringField('web_folder', $event)"
            />
          </div>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>Zero Downtime Deployment</Label>
              <p class="text-sm text-muted-foreground">
                Use atomic deployments with symlinks for zero downtime
              </p>
            </div>
            <Switch
              :checked="values.zero_downtime_deployment"
              @update:checked="(val: boolean) => setFieldValue('zero_downtime_deployment', val, false)"
            />
          </div>
        </div>

        <DialogFooter class="mt-4 sm:justify-between">
          <Button type="button" variant="outline" @click="isAdvancedOpen = true">
            <Settings class="mr-2 h-4 w-4" />
            Advanced Options
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Add Site
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <ServerAddSiteAdvancedOptions
    v-model="advancedOptions"
    v-model:open="isAdvancedOpen"
    :has-database="hasDatabase"
    :databases="databases"
    :database-users="databaseUsers"
    :site-type="values.type ?? 'laravel'"
  />
</template>

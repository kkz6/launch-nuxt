<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Settings } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
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
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from 'reka-ui'

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

// Domain verification state
interface DomainVerification {
  verified: boolean
  domain: string
  base_domain: string
  connected_domain_id?: string
  can_create_record: boolean
}

const isVerifyingDomain = ref(false)
const domainVerification = ref<DomainVerification | null>(null)
const createDnsRecord = ref(false)

interface PhpVersion {
  id: string
  key: string
  display_name: string
  version: string
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

interface SourceControl {
  id: string
  provider: string
  provider_label: string
  login: string
  avatar_url?: string
  repository_count: number
}

interface Repository {
  id: string
  name: string
  full_name: string
  default_branch: string
  html_url: string
  public: boolean
  ssh_url?: string
}

const phpVersions = ref<PhpVersion[]>([])
const sourceControls = ref<SourceControl[]>([])
const repositories = ref<Repository[]>([])
const isLoadingRepositories = ref(false)
const repositorySearchTerm = ref('')
const databases = ref<Record<string, string>>({})
const databaseUsers = ref<Record<string, string>>({})
const hasDatabase = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const applicationTypes: Record<string, string> = {
  laravel: 'Laravel',
  wordpress: 'WordPress',
  generic: 'Generic PHP',
}

// Get selected repository display name
const selectedRepository = computed(() => {
  if (!values.source_control_repositories_id) return null
  return repositories.value.find(r => r.id === values.source_control_repositories_id)
})

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
  source_control_repositories_id: z.string().optional(),
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
    source_control_repositories_id: '',
    repository_branch: 'main',
  },
})

type StringFields = 'address' | 'php_version' | 'web_folder' | 'source_control_id' | 'source_control_repositories_id' | 'repository_branch'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '', false)
}

const zeroDowntimeDeployment = computed({
  get: () => values.zero_downtime_deployment ?? false,
  set: (val: boolean) => setFieldValue('zero_downtime_deployment', val),
})

const fetchOptions = async () => {
  try {
    const [phpData, scData] = await Promise.all([
      $api<{ data: PhpVersion[] }>(`/servers/${props.serverId}/php-versions`),
      $api<{ data: SourceControl[] }>('/source-controls'),
    ])
    phpVersions.value = phpData.data
    sourceControls.value = scData.data || []

    if (phpVersions.value.length > 0) {
      const defaultVersion = phpVersions.value.find(v => v.is_default)
      setFieldValue('php_version', defaultVersion?.key ?? phpVersions.value[0].key, false)
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

// Fetch repositories for a source control
const fetchRepositories = async (sourceControlId: string) => {
  if (!sourceControlId) {
    repositories.value = []
    return
  }

  isLoadingRepositories.value = true
  try {
    const result = await $api<{ data: Repository[] }>(`/source-controls/${sourceControlId}/repositories`)
    repositories.value = result.data || []
  } catch {
    repositories.value = []
  } finally {
    isLoadingRepositories.value = false
  }
}

// Handle source control change
const handleSourceControlChange = (sourceControlId: string) => {
  setStringField('source_control_id', sourceControlId)
  setStringField('source_control_repositories_id', '')
  setStringField('repository_branch', 'main')
  repositories.value = []

  if (sourceControlId) {
    fetchRepositories(sourceControlId)
  }
}

// Handle repository selection from combobox
const handleRepositorySelect = (repo: Repository) => {
  setStringField('source_control_repositories_id', repo.id)
  setStringField('repository_branch', repo.default_branch || 'main')
  repositorySearchTerm.value = ''
}

// Filtered repositories based on search
const filteredRepositories = computed(() => {
  if (!repositorySearchTerm.value) return repositories.value
  const search = repositorySearchTerm.value.toLowerCase()
  return repositories.value.filter(r =>
    r.full_name.toLowerCase().includes(search) || r.name.toLowerCase().includes(search)
  )
})

// Domain verification
const verifyDomain = async (domain: string) => {
  if (!domain || domain.length < 3) {
    domainVerification.value = null
    createDnsRecord.value = false
    return
  }

  isVerifyingDomain.value = true
  try {
    const result = await $api<{ data: DomainVerification }>('/sites/verify-domain', {
      params: { domain },
    })
    domainVerification.value = result.data
    // Auto-enable DNS record creation if domain is verified
    if (result.data.verified && result.data.can_create_record) {
      createDnsRecord.value = true
    }
  } catch {
    domainVerification.value = null
  } finally {
    isVerifyingDomain.value = false
  }
}

const debouncedVerifyDomain = useDebounceFn(verifyDomain, 500)

const handleDomainChange = (value: unknown) => {
  const domain = value != null ? String(value) : ''
  setStringField('address', domain)
  debouncedVerifyDomain(domain)
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
    // Merge advanced options and DNS options into payload
    const payload = {
      ...data,
      ...advancedOptions.value,
      // DNS record creation options
      create_dns_record: createDnsRecord.value && domainVerification.value?.can_create_record,
      connected_domain_id: domainVerification.value?.connected_domain_id || null,
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
    // Reset DNS state
    domainVerification.value = null
    createDnsRecord.value = false
    // Reset repository state
    repositories.value = []
    repositorySearchTerm.value = ''
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
          <div class="relative">
            <Input
              id="address"
              :model-value="values.address"
              placeholder="example.com"
              @update:model-value="handleDomainChange"
            />
            <div v-if="isVerifyingDomain" class="absolute right-3 top-1/2 -translate-y-1/2">
              <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
          <p v-if="hasSubmitted && errors.address" class="text-sm text-destructive">{{ errors.address }}</p>

          <!-- Domain verification status -->
          <div v-if="domainVerification && values.address" class="mt-2">
            <div v-if="domainVerification.verified && domainVerification.can_create_record" class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <div class="flex items-center gap-2">
                <Icon name="lucide:check-circle" class="h-4 w-4 text-green-600 dark:text-green-400" />
                <span class="text-sm text-green-700 dark:text-green-300">
                  Domain connected via <strong>{{ domainVerification.base_domain }}</strong>
                </span>
              </div>
              <div class="flex items-center gap-2">
                <Label for="create_dns" class="text-sm text-green-700 dark:text-green-300">Create DNS record</Label>
                <Switch id="create_dns" v-model="createDnsRecord" />
              </div>
            </div>
            <div v-else class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <Icon name="lucide:alert-circle" class="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span class="text-sm text-amber-700 dark:text-amber-300">
                Domain not connected. Add <strong>{{ domainVerification.base_domain }}</strong> to your DNS providers to auto-create records.
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="php_version">PHP Version</Label>
            <Select :model-value="values.php_version" @update:model-value="setStringField('php_version', $event)">
              <SelectTrigger>
                <SelectValue placeholder="Select PHP version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="version in phpVersions" :key="version.key" :value="version.key">
                  {{ version.display_name }}
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

        <!-- Source Control Section -->
        <div v-if="sourceControls.length > 0 && values.type !== 'wordpress'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="source_control">Git Provider</Label>
              <Select :model-value="values.source_control_id" @update:model-value="(val) => handleSourceControlChange(val as string)">
                <SelectTrigger>
                  <SelectValue placeholder="Select git provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="sc in sourceControls" :key="sc.id" :value="sc.id">
                    <div class="flex items-center gap-2">
                      <Icon :name="`simple-icons:${sc.provider}`" class="h-4 w-4" />
                      <span>{{ sc.login }} ({{ sc.repository_count }} {{ sc.repository_count === 1 ? 'repo' : 'repos' }})</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label for="repository">Repository</Label>
              <ComboboxRoot
                v-model:search-term="repositorySearchTerm"
                :disabled="!values.source_control_id || isLoadingRepositories"
                :filter-function="(list: Repository[]) => list"
                class="relative"
              >
                <ComboboxAnchor class="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
                  <ComboboxInput
                    class="h-full flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    :placeholder="isLoadingRepositories ? 'Loading...' : selectedRepository ? selectedRepository.name : 'Search repository...'"
                  />
                  <ComboboxTrigger class="flex items-center justify-center">
                    <Icon name="lucide:chevron-down" class="h-4 w-4 opacity-50" />
                  </ComboboxTrigger>
                </ComboboxAnchor>

                <ComboboxPortal>
                  <ComboboxContent
                    position="popper"
                    :side-offset="4"
                    class="z-[200] max-h-60 w-[--reka-combobox-trigger-width] overflow-hidden rounded-md border bg-popover shadow-md"
                  >
                    <ComboboxEmpty class="py-6 text-center text-sm text-muted-foreground">
                      No repository found.
                    </ComboboxEmpty>
                    <ComboboxGroup class="overflow-auto p-1">
                      <ComboboxItem
                        v-for="repo in filteredRepositories"
                        :key="repo.id"
                        :value="repo"
                        class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        @select="handleRepositorySelect(repo)"
                      >
                        <ComboboxItemIndicator class="mr-2 h-4 w-4">
                          <Icon name="lucide:check" class="h-4 w-4" />
                        </ComboboxItemIndicator>
                        <Icon :name="repo.public ? 'lucide:globe' : 'lucide:lock-keyhole'" class="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span class="truncate">{{ repo.full_name }}</span>
                      </ComboboxItem>
                    </ComboboxGroup>
                  </ComboboxContent>
                </ComboboxPortal>
              </ComboboxRoot>
            </div>
          </div>

          <div v-if="values.source_control_repositories_id" class="space-y-2">
            <Label for="repository_branch">Branch</Label>
            <Input
              id="repository_branch"
              :model-value="values.repository_branch"
              placeholder="main"
              @update:model-value="setStringField('repository_branch', $event)"
            />
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
            <Switch v-model="zeroDowntimeDeployment" />
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

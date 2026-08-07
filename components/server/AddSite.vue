<script setup lang="ts">
import { toast } from 'vue-sonner'
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
const errors = ref<Record<string, string>>({})

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
  installation_id?: string
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

interface SiteTypeOption {
  value: string
  label: string
  default_web_folder: string
  requires_git: boolean
  supports_git: boolean
}

const phpVersions = ref<PhpVersion[]>([])
const siteTypes = ref<SiteTypeOption[]>([])
const sourceControls = ref<SourceControl[]>([])
const repositories = ref<Repository[]>([])
const isLoadingRepositories = ref(false)
const isRefreshingRepositories = ref(false)
const repositorySearchTerm = ref('')
const databases = ref<Record<string, string>>({})
const databaseUsers = ref<Record<string, string>>({})
const hasDatabase = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Form values
const address = ref('')
const siteType = ref('laravel')
const phpVersion = ref('')
const webFolder = ref('/public')
const zeroDowntimeDeployment = ref(false)
const sourceControlId = ref('')
const sourceControlRepositoriesId = ref('')
const repositoryBranch = ref('main')

// Get selected site type option
const selectedSiteType = computed(() => {
  return siteTypes.value.find(st => st.value === siteType.value)
})

// Get selected repository display name
const selectedRepository = computed(() => {
  if (!sourceControlRepositoriesId.value) return null
  return repositories.value.find(r => r.id === sourceControlRepositoriesId.value)
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
  hook_before_updating_repository: '',
  hook_after_updating_repository: '',
  hook_before_making_current: '',
  hook_after_making_current: '',
})

const HOOK_FIELDS = [
  'hook_before_updating_repository',
  'hook_after_updating_repository',
  'hook_before_making_current',
  'hook_after_making_current',
] as const

// Snapshot of the hook defaults last written into advancedOptions, so an
// edit can be told apart from a value we filled in ourselves. Laravel's
// default is not a placeholder — it is the actual composer install / artisan
// caching script — so leaving the field blank would have shown nothing and
// submitting a blank field would have deleted that script from the site.
const hookDefaults = ref<Record<(typeof HOOK_FIELDS)[number], string>>({
  hook_before_updating_repository: '',
  hook_after_updating_repository: '',
  hook_before_making_current: '',
  hook_after_making_current: '',
})

// Base schema - type-specific validation is done in validate()
const schema = z.object({
  address: z.string().min(1, 'Domain is required'),
  type: z.string().min(1, 'Site type is required'),
  php_version: z.string().min(1, 'PHP version is required'),
  web_folder: z.string().default('/public'),
  zero_downtime_deployment: z.boolean().default(false),
  source_control_id: z.string().optional(),
  source_control_repositories_id: z.string().optional(),
  repository_branch: z.string().optional(),
})

// Check if source control is required based on site type
const requiresSourceControl = computed(() => {
  const st = selectedSiteType.value
  return st ? st.requires_git && st.value === 'laravel' : false
})

// Check if source control is optional (available but not required)
const supportsSourceControl = computed(() => {
  const st = selectedSiteType.value
  return st ? st.supports_git && !requiresSourceControl.value : false
})

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (address.value.trim().length === 0) return false
  if (phpVersion.value.length === 0) return false

  // Laravel sites MUST have source control configured
  if (requiresSourceControl.value) {
    if (sourceControls.value.length === 0) return false // No git providers connected
    if (!sourceControlId.value) return false
    if (!sourceControlRepositoriesId.value) return false
    if (!repositoryBranch.value) return false
  }

  // Generic sites with source control selected must have complete config
  if (supportsSourceControl.value && sourceControlId.value) {
    if (!sourceControlRepositoriesId.value) return false
    if (!repositoryBranch.value) return false
  }

  return true
})

const resetForm = () => {
  address.value = ''
  siteType.value = 'laravel'
  phpVersion.value = ''
  webFolder.value = '/public'
  zeroDowntimeDeployment.value = false
  sourceControlId.value = ''
  sourceControlRepositoriesId.value = ''
  repositoryBranch.value = 'main'
  errors.value = {}
}

// Fetches the real hook defaults for the current type/zero-downtime
// combination and fills any field that still matches the LAST default we
// applied — never one the user has typed something different into. A field
// left alone here keeps whatever the user put there, even across a type or
// zero-downtime change.
const fetchHookDefaults = async () => {
  try {
    const result = await $api<{ data: Record<(typeof HOOK_FIELDS)[number], string> }>(
      '/sites/hook-defaults',
      { params: { type: siteType.value, zero_downtime: zeroDowntimeDeployment.value } },
    )
    const next = result.data
    for (const field of HOOK_FIELDS) {
      if (advancedOptions.value[field] === hookDefaults.value[field]) {
        advancedOptions.value[field] = next[field] ?? ''
      }
      hookDefaults.value[field] = next[field] ?? ''
    }
  } catch {
    // Leave whatever is currently shown. Creation still works without a
    // pre-filled default — the field is just blank instead of helpful.
  }
}

const fetchOptions = async () => {
  try {
    const [phpData, scData, siteTypeData] = await Promise.all([
      $api<{ data: PhpVersion[] }>(`/servers/${props.serverId}/php-versions`),
      $api<{ data: SourceControl[] }>('/source-controls'),
      $api<{ data: { site_types: SiteTypeOption[] } }>('/sites/create-options'),
    ])
    phpVersions.value = phpData.data
    sourceControls.value = scData.data || []
    siteTypes.value = siteTypeData.data?.site_types || []

    if (phpVersions.value.length > 0) {
      const defaultVersion = phpVersions.value.find(v => v.is_default)
      phpVersion.value = defaultVersion?.key ?? phpVersions.value[0].key
    }

    await fetchHookDefaults()
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
const fetchRepositories = async (scId: string) => {
  if (!scId) {
    repositories.value = []
    return
  }

  isLoadingRepositories.value = true
  try {
    const result = await $api<{ data: Repository[] }>(`/source-controls/${scId}/repositories`)
    repositories.value = result.data || []
  } catch {
    repositories.value = []
  } finally {
    isLoadingRepositories.value = false
  }
}

// Get the selected source control
const selectedSourceControl = computed(() => {
  if (!sourceControlId.value) return null
  return sourceControls.value.find(sc => sc.id === sourceControlId.value)
})

// Refresh repositories from the git provider
const refreshRepositories = async () => {
  const sc = selectedSourceControl.value
  if (!sc || !sc.installation_id) {
    toast.error('Cannot refresh: No installation found')
    return
  }

  isRefreshingRepositories.value = true
  try {
    await $api(`/settings/git-providers/${sc.provider}/installations/${sc.installation_id}/refresh-repositories`, {
      method: 'POST',
    })
    toast.success('Repositories synced')
    // Re-fetch the repositories after sync
    await fetchRepositories(sourceControlId.value)
  } catch {
    toast.error('Failed to refresh repositories')
  } finally {
    isRefreshingRepositories.value = false
  }
}

// Handle source control change
const handleSourceControlChange = (scId: string) => {
  sourceControlId.value = scId
  sourceControlRepositoriesId.value = ''
  repositoryBranch.value = 'main'
  repositories.value = []

  if (scId) {
    fetchRepositories(scId)
  }
}

// Handle repository selection from combobox
const handleRepositorySelect = (repo: Repository) => {
  sourceControlRepositoriesId.value = repo.id
  repositoryBranch.value = repo.default_branch || 'main'
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

const handleDomainChange = (value: string | number) => {
  const domain = String(value)
  address.value = domain
  debouncedVerifyDomain(domain)
}

const validate = () => {
  // Reset errors
  errors.value = {}

  const result = schema.safeParse({
    address: address.value.trim(),
    type: siteType.value,
    php_version: phpVersion.value,
    web_folder: webFolder.value,
    zero_downtime_deployment: zeroDowntimeDeployment.value,
    source_control_id: sourceControlId.value || undefined,
    source_control_repositories_id: sourceControlRepositoriesId.value || undefined,
    repository_branch: repositoryBranch.value || undefined,
  })

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      address: fieldErrors.address?.[0] || '',
      php_version: fieldErrors.php_version?.[0] || '',
    }
    return null
  }

  // Laravel sites MUST have source control
  if (requiresSourceControl.value) {
    if (sourceControls.value.length === 0) {
      // This shouldn't happen since canSubmit blocks it, but just in case
      toast.error('Please connect a Git provider in settings first')
      return null
    }
    if (!sourceControlId.value) {
      errors.value.source_control_id = 'Git provider is required for Laravel sites'
    }
    if (!sourceControlRepositoriesId.value) {
      errors.value.source_control_repositories_id = 'Repository is required for Laravel sites'
    }
    if (!repositoryBranch.value?.trim()) {
      errors.value.repository_branch = 'Branch is required for Laravel sites'
    }

    if (Object.keys(errors.value).some(k => errors.value[k])) {
      return null
    }
  }

  // Generic sites with partial source control config
  if (supportsSourceControl.value && sourceControlId.value) {
    if (!sourceControlRepositoriesId.value) {
      errors.value.source_control_repositories_id = 'Please select a repository'
    }
    if (!repositoryBranch.value?.trim()) {
      errors.value.repository_branch = 'Please specify a branch'
    }

    if (Object.keys(errors.value).some(k => errors.value[k])) {
      return null
    }
  }

  return result.data
}

const onSubmit = async () => {
  const data = validate()
  if (!data) return

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
    // Hook fields are pre-filled with the site type's real default (for
    // Laravel that is the composer install / artisan caching script, not a
    // placeholder), so "blank" no longer means "untouched". A field is sent
    // only if it no longer matches the last default fetchHookDefaults wrote
    // into it — which covers both an edit and a deliberate clearing, and
    // omits it whenever the user never opened this section at all.
    const {
      hook_before_updating_repository: beforeUpdating,
      hook_after_updating_repository: afterUpdating,
      hook_before_making_current: beforeCurrent,
      hook_after_making_current: afterCurrent,
      ...advanced
    } = advancedOptions.value

    const hooks = Object.fromEntries(
      (
        [
          ['hook_before_updating_repository', beforeUpdating],
          ['hook_after_updating_repository', afterUpdating],
          ['hook_before_making_current', beforeCurrent],
          ['hook_after_making_current', afterCurrent],
        ] as const
      ).filter(([field, value]) => value !== hookDefaults.value[field]),
    )

    const payload = {
      ...data,
      ...advanced,
      ...hooks,
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
    const err = error as { data?: { message?: string, errors?: Record<string, string[]> } }
    // Handle validation errors with field-specific messages
    if (err.data?.errors) {
      // Map backend errors to frontend errors (take first error message for each field)
      errors.value = Object.entries(err.data.errors).reduce((acc, [field, messages]) => {
        acc[field] = messages[0] || ''
        return acc
      }, {} as Record<string, string>)
      toast.error(err.data?.message || 'Validation failed')
    } else {
      toast.error(err.data?.message || 'An error occurred')
    }
  } finally {
    isLoading.value = false
  }
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
    hook_before_updating_repository: '',
    hook_after_updating_repository: '',
    hook_before_making_current: '',
    hook_after_making_current: '',
  }
  hookDefaults.value = {
    hook_before_updating_repository: '',
    hook_after_updating_repository: '',
    hook_before_making_current: '',
    hook_after_making_current: '',
  }
}

watch(siteType, () => {
  const st = selectedSiteType.value
  if (st) {
    webFolder.value = st.default_web_folder === '/' ? '/' : `/${st.default_web_folder}`
  }
})

watch([siteType, zeroDowntimeDeployment], fetchHookDefaults)

watch(isOpen, (open) => {
  if (open) {
    fetchOptions()
  } else {
    resetForm()
    resetAdvancedOptions()
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
              :model-value="address"
              placeholder="example.com"
              @update:model-value="handleDomainChange"
            />
            <div v-if="isVerifyingDomain" class="absolute right-3 top-1/2 -translate-y-1/2">
              <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
          <p v-if="errors.address" class="text-sm text-destructive">{{ errors.address }}</p>

          <!-- Domain verification status -->
          <div v-if="domainVerification && address" class="mt-2">
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
            <Select v-model="phpVersion">
              <SelectTrigger>
                <SelectValue placeholder="Select PHP version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="version in phpVersions" :key="version.key" :value="version.key">
                  {{ version.display_name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.php_version" class="text-sm text-destructive">{{ errors.php_version }}</p>
          </div>

          <div class="space-y-2">
            <Label for="type">Site Type</Label>
            <Select v-model="siteType">
              <SelectTrigger>
                <SelectValue placeholder="Select site type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="st in siteTypes" :key="st.value" :value="st.value">
                  {{ st.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.type" class="text-sm text-destructive">{{ errors.type }}</p>
          </div>
        </div>

        <!-- Source Control Section -->
        <!-- Show message if no source controls connected for Laravel/Generic sites -->
        <div v-if="sourceControls.length === 0 && selectedSiteType?.supports_git" class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <div class="flex items-start gap-3">
            <Icon name="lucide:alert-triangle" class="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div class="space-y-1">
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200">No Git Provider Connected</p>
              <p class="text-sm text-amber-700 dark:text-amber-300">
                Connect a Git provider (GitHub, GitLab, or Bitbucket) in settings to deploy {{ selectedSiteType?.label }} applications from a repository.
              </p>
            </div>
          </div>
        </div>

        <div v-if="sourceControls.length > 0 && selectedSiteType?.supports_git" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="source_control">Git Provider</Label>
              <Select :model-value="sourceControlId" @update:model-value="(val) => handleSourceControlChange(val as string)">
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
              <p v-if="errors.source_control_id" class="text-sm text-destructive">{{ errors.source_control_id }}</p>
            </div>

            <div class="space-y-2">
              <Label for="repository">Repository</Label>
              <ComboboxRoot
                v-model:search-term="repositorySearchTerm"
                :model-value="selectedRepository"
                :disabled="!sourceControlId || isLoadingRepositories"
                :filter-function="(list: Repository[]) => list"
                class="relative"
                @update:model-value="(val: Repository | null) => val && handleRepositorySelect(val)"
              >
                <ComboboxAnchor class="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
                  <ComboboxInput
                    class="h-full flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    :placeholder="isLoadingRepositories ? 'Loading...' : 'Search repository...'"
                    :display-value="(repo: Repository) => repo?.name || ''"
                  />
                  <button
                    v-if="sourceControlId && selectedSourceControl?.installation_id"
                    type="button"
                    class="mr-1 flex h-6 items-center rounded px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    :disabled="isRefreshingRepositories || isLoadingRepositories"
                    @click.stop="refreshRepositories"
                  >
                    <Icon
                      name="lucide:refresh-cw"
                      class="h-3 w-3"
                      :class="{ 'animate-spin': isRefreshingRepositories }"
                    />
                  </button>
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
                        <span class="truncate">{{ repo.name }}</span>
                      </ComboboxItem>
                    </ComboboxGroup>
                  </ComboboxContent>
                </ComboboxPortal>
              </ComboboxRoot>
              <p v-if="errors.source_control_repositories_id" class="text-sm text-destructive">{{ errors.source_control_repositories_id }}</p>
            </div>
          </div>

          <div v-if="sourceControlRepositoriesId" class="space-y-2">
            <Label for="repository_branch">Branch</Label>
            <Input
              id="repository_branch"
              v-model="repositoryBranch"
              placeholder="main"
            />
            <p v-if="errors.repository_branch" class="text-sm text-destructive">{{ errors.repository_branch }}</p>
          </div>
        </div>

        <div v-if="selectedSiteType?.supports_git" class="space-y-4">
          <div class="space-y-2">
            <Label for="web_folder">Web Folder</Label>
            <Input
              id="web_folder"
              v-model="webFolder"
              placeholder="/public"
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
          <Button type="submit" :disabled="!canSubmit">
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
    :site-type="siteType"
  />
</template>

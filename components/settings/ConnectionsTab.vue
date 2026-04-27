<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { format } from 'date-fns'
import { dockerRegistryService } from '~/services/dockerRegistryService'
import type { DockerRegistry } from '~/types'

// Loading states
const isGitLoading = ref(true)
const isServerProvidersLoading = ref(true)
const isStorageProvidersLoading = ref(true)
const isDnsProvidersLoading = ref(true)
const isDockerRegistriesLoading = ref(true)

const dockerRegistries = ref<DockerRegistry[]>([])
const editingDockerRegistry = ref<DockerRegistry | null>(null)
const dockerRegistryIcons: Record<string, string> = {
  docker_hub: 'simple-icons:docker',
  ghcr: 'simple-icons:github',
  generic: 'lucide:database',
}

const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Git installations
interface AppInstallation {
  id: string
  accountLogin: string
  accountType: string
  accountAvatarUrl: string
  htmlUrl?: string
  createdAt?: string
  repositorySelection?: string
  hasMultipleRepositories: boolean
  repositoryCount?: number
}

const appInstallations = ref<Record<string, AppInstallation[]>>({})
const refreshingInstallations = ref<Record<string, boolean>>({})
const githubInstallations = computed(() => appInstallations.value.github || [])

// Server providers
interface ServerProvider {
  id: string
  profile: string
  provider: string
  connected: boolean
  created_at: string
}

const serverProviders = ref<ServerProvider[]>([])
const serverProviderLabels: Record<string, string> = {
  aws: 'Amazon Web Services',
  digitalocean: 'DigitalOcean',
  linode: 'Linode',
  vultr: 'Vultr',
  hetzner: 'Hetzner',
  custom: 'Custom Provider',
}
const serverProviderIcons: Record<string, string> = {
  aws: 'simple-icons:amazonaws',
  digitalocean: 'simple-icons:digitalocean',
  linode: 'simple-icons:linode',
  vultr: 'simple-icons:vultr',
  hetzner: 'simple-icons:hetzner',
  custom: 'lucide:server',
}

// Storage providers
interface StorageProvider {
  id: string
  label: string
  provider: string
  created_at: string
}

const storageProviders = ref<StorageProvider[]>([])
const storageProviderLabels: Record<string, string> = {
  s3: 'Amazon S3',
  spaces: 'DigitalOcean Spaces',
  backblaze: 'Backblaze B2',
  wasabi: 'Wasabi',
}
const storageProviderIcons: Record<string, string> = {
  s3: 'simple-icons:amazons3',
  spaces: 'simple-icons:digitalocean',
  backblaze: 'simple-icons:backblaze',
  wasabi: 'lucide:database',
}

// DNS providers
interface DnsProvider {
  id: string
  label: string
  provider: string
  created_at: string
}

const dnsProviders = ref<DnsProvider[]>([])
const dnsProviderLabels: Record<string, string> = {
  cloudflare: 'Cloudflare',
  route53: 'Amazon Route 53',
  digitalocean: 'DigitalOcean DNS',
}
const dnsProviderIcons: Record<string, string> = {
  cloudflare: 'simple-icons:cloudflare',
  route53: 'simple-icons:amazonaws',
  digitalocean: 'simple-icons:digitalocean',
}

// Git providers list
const gitProviders = [
  {
    key: 'github',
    name: 'GitHub',
    icon: 'simple-icons:github',
    className: 'bg-[#24292f] hover:bg-[#24292f]/90 text-white',
    enabled: true,
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    icon: 'simple-icons:gitlab',
    className: 'bg-[#FC6D26] hover:bg-[#FC6D26]/90 text-white',
    enabled: false,
  },
  {
    key: 'bitbucket',
    name: 'Bitbucket',
    icon: 'simple-icons:bitbucket',
    className: 'bg-[#0052CC] hover:bg-[#0052CC]/90 text-white',
    enabled: false,
  },
]

// Fetch functions
const fetchGitProviders = async () => {
  try {
    const response = await $api<{
      data?: { appInstallations: Record<string, AppInstallation[]> }
      appInstallations?: Record<string, AppInstallation[]>
    }>('/settings/git-providers')
    appInstallations.value = response.data?.appInstallations || response.appInstallations || {}
  } catch {
    toast.error('Failed to load git providers')
  } finally {
    isGitLoading.value = false
  }
}

const fetchServerProviders = async () => {
  try {
    const response = await $api<{ data: ServerProvider[] }>('/server-providers')
    serverProviders.value = response.data
  } catch {
    toast.error('Failed to load server providers')
  } finally {
    isServerProvidersLoading.value = false
  }
}

const fetchStorageProviders = async () => {
  try {
    const response = await $api<{ data: StorageProvider[] }>('/storage-providers')
    storageProviders.value = response.data
  } catch {
    toast.error('Failed to load storage providers')
  } finally {
    isStorageProvidersLoading.value = false
  }
}

const fetchDnsProviders = async () => {
  try {
    const response = await $api<{ data: DnsProvider[] }>('/dns-providers')
    dnsProviders.value = response.data
  } catch {
    toast.error('Failed to load DNS providers')
  } finally {
    isDnsProvidersLoading.value = false
  }
}

// Git actions
const getRepoLabel = (installation: AppInstallation) => {
  if (installation.repositorySelection === 'selected') {
    const count = installation.repositoryCount || 0
    return `${count} ${count === 1 ? 'repo' : 'repos'}`
  }
  return 'All repos'
}

const handleRefreshRepositories = async (installationId: string) => {
  const key = `github-${installationId}`
  refreshingInstallations.value[key] = true

  try {
    const response = await $api<{ status: string }>(`/settings/git-providers/github/installations/${installationId}/refresh-repositories`, {
      method: 'POST',
    })
    if (response.status === 'queued') {
      toast.success('Repository refresh queued')
      setTimeout(() => window.location.reload(), 2000)
    }
  } catch {
    toast.error('Failed to refresh repositories')
  } finally {
    refreshingInstallations.value[key] = false
  }
}

const handleConfigureInstallation = async () => {
  try {
    const response = await $api<{ url: string }>('/settings/git-providers/github/installation-url')
    if (response.url) {
      window.open(response.url, '_blank')
    }
  } catch {
    toast.error('Failed to get installation URL')
  }
}

const handleInstallApp = async (provider: string) => {
  try {
    const response = await $api<{ url: string }>(`/settings/git-providers/${provider}/installation-url`)
    if (response.url) {
      window.open(response.url, '_blank')
    }
  } catch {
    // Silent fail
  }
}

// Delete functions
const deleteServerProvider = async (provider: ServerProvider) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Server Provider',
    description: `Are you sure you want to delete "${provider.profile}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/server-providers/${provider.id}`, { method: 'DELETE' })
      serverProviders.value = serverProviders.value.filter((p) => p.id !== provider.id)
      toast.success('Server provider deleted')
    } catch {
      toast.error('Failed to delete server provider')
    }
  }
}

const deleteStorageProvider = async (provider: StorageProvider) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Storage Provider',
    description: `Are you sure you want to delete "${provider.label}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/storage-providers/${provider.id}`, { method: 'DELETE' })
      storageProviders.value = storageProviders.value.filter((p) => p.id !== provider.id)
      toast.success('Storage provider deleted')
    } catch {
      toast.error('Failed to delete storage provider')
    }
  }
}

const deleteDnsProvider = async (provider: DnsProvider) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete DNS Provider',
    description: `Are you sure you want to delete "${provider.label}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/dns-providers/${provider.id}`, { method: 'DELETE' })
      dnsProviders.value = dnsProviders.value.filter((p) => p.id !== provider.id)
      toast.success('DNS provider deleted')
    } catch {
      toast.error('Failed to delete DNS provider')
    }
  }
}

const fetchDockerRegistries = async () => {
  try {
    const response = await dockerRegistryService.list()
    dockerRegistries.value = response.data ?? []
  } catch {
    toast.error('Failed to load docker registries')
  } finally {
    isDockerRegistriesLoading.value = false
  }
}

const deleteDockerRegistry = async (registry: DockerRegistry) => {
  if (!confirmationDialog.value) return
  const result = await confirmationDialog.value.show({
    title: 'Delete docker registry',
    description: `Are you sure you want to delete "${registry.name}"? Applications using this credential will fail to pull until reconfigured.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })
  if (!result.ok) return
  try {
    await dockerRegistryService.delete(registry.id)
    dockerRegistries.value = dockerRegistries.value.filter((r) => r.id !== registry.id)
    toast.success('Docker registry deleted')
  } catch {
    toast.error('Failed to delete docker registry')
  }
}

const editDockerRegistry = (registry: DockerRegistry) => {
  editingDockerRegistry.value = registry
}
const onDockerRegistryUpdated = () => {
  editingDockerRegistry.value = null
  fetchDockerRegistries()
}

onMounted(() => {
  fetchGitProviders()
  fetchServerProviders()
  fetchStorageProviders()
  fetchDnsProviders()
  fetchDockerRegistries()
})
</script>

<template>
  <div class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Source Control Section -->
    <div class="px-6 pb-6">
      <h3 class="mb-4 text-base font-semibold">Source Control</h3>

      <div v-if="isGitLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="githubInstallations.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon name="simple-icons:git" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No source control connected</span>
            <GitAddProvider :providers="gitProviders" @install="handleInstallApp" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="installation in githubInstallations"
            :key="installation.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Avatar class="h-8 w-8">
                <AvatarImage :src="installation.accountAvatarUrl" :alt="installation.accountLogin" />
                <AvatarFallback>{{ installation.accountLogin.charAt(0).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{{ installation.accountLogin }}</span>
                  <Badge variant="secondary" class="text-xs">{{ installation.accountType }}</Badge>
                  <Badge v-if="installation.repositorySelection" variant="outline" class="text-xs">
                    {{ getRepoLabel(installation) }}
                  </Badge>
                </div>
                <p v-if="installation.createdAt" class="text-xs text-muted-foreground">
                  Installed {{ format(new Date(installation.createdAt), 'MMM dd, yyyy') }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                :disabled="refreshingInstallations[`github-${installation.id}`]"
                @click="handleRefreshRepositories(installation.id)"
              >
                <Icon
                  name="lucide:refresh-cw"
                  class="h-4 w-4"
                  :class="{ 'animate-spin': refreshingInstallations[`github-${installation.id}`] }"
                />
              </Button>
              <Button variant="ghost" size="sm" @click="handleConfigureInstallation">
                <Icon name="lucide:settings" class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <GitAddProvider :providers="gitProviders" @install="handleInstallApp" />
        </div>
      </template>
    </div>

    <!-- Docker Registries Section -->
    <div class="px-6 py-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold">Docker Registries</h3>
          <p class="text-xs text-muted-foreground">
            Credentials for private image registries (Docker Hub, GHCR, generic). Used at deploy time by the application module.
          </p>
        </div>
        <SettingsAddDockerRegistry @created="fetchDockerRegistries" />
      </div>

      <div v-if="isDockerRegistriesLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="dockerRegistries.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground">
            <Icon name="simple-icons:docker" class="h-8 w-8" />
            <span>No docker registries configured.</span>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="registry in dockerRegistries"
            :key="registry.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon
                :name="dockerRegistryIcons[registry.type] || 'lucide:database'"
                class="h-6 w-6 text-muted-foreground"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{{ registry.name }}</span>
                  <Badge variant="secondary" class="text-xs">{{ registry.type_label }}</Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ registry.url }} · {{ registry.username }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" title="Edit" @click="editDockerRegistry(registry)">
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Delete"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                @click="deleteDockerRegistry(registry)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </template>

      <SettingsEditDockerRegistry
        v-if="editingDockerRegistry"
        :open="!!editingDockerRegistry"
        :registry="editingDockerRegistry"
        @update:open="(v: boolean) => { if (!v) editingDockerRegistry = null }"
        @updated="onDockerRegistryUpdated"
      />
    </div>

    <!-- Server Providers Section -->
    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">Server Providers</h3>

      <div v-if="isServerProvidersLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="serverProviders.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon name="lucide:server" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No server providers connected</span>
            <SettingsAddServerProvider @created="fetchServerProviders" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="provider in serverProviders"
            :key="provider.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon :name="serverProviderIcons[provider.provider] || 'lucide:server'" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ provider.profile }}</span>
                <p class="text-xs text-muted-foreground">{{ serverProviderLabels[provider.provider] || provider.provider }}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" @click="deleteServerProvider(provider)">
              <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <SettingsAddServerProvider @created="fetchServerProviders" />
        </div>
      </template>
    </div>

    <!-- Storage Providers Section -->
    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">Storage Providers</h3>

      <div v-if="isStorageProvidersLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="storageProviders.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon name="lucide:database" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No storage providers connected</span>
            <SettingsAddStorageProvider @created="fetchStorageProviders" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="provider in storageProviders"
            :key="provider.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon :name="storageProviderIcons[provider.provider] || 'lucide:database'" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ provider.label }}</span>
                <p class="text-xs text-muted-foreground">{{ storageProviderLabels[provider.provider] || provider.provider }}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" @click="deleteStorageProvider(provider)">
              <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <SettingsAddStorageProvider @created="fetchStorageProviders" />
        </div>
      </template>
    </div>

    <!-- DNS Providers Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-4 text-base font-semibold">DNS Providers</h3>

      <div v-if="isDnsProvidersLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="dnsProviders.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon name="lucide:globe" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No DNS providers connected</span>
            <SettingsAddDnsProvider @created="fetchDnsProviders" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="provider in dnsProviders"
            :key="provider.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon :name="dnsProviderIcons[provider.provider] || 'lucide:globe'" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ provider.label }}</span>
                <p class="text-xs text-muted-foreground">{{ dnsProviderLabels[provider.provider] || provider.provider }}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" @click="deleteDnsProvider(provider)">
              <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <SettingsAddDnsProvider @created="fetchDnsProviders" />
        </div>
      </template>
    </div>
  </div>
</template>

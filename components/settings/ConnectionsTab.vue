<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { format } from 'date-fns'

// Collapsible states
const gitOpen = ref(true)
const serverProvidersOpen = ref(false)
const storageProvidersOpen = ref(false)
const dnsProvidersOpen = ref(false)

// Loading states
const isGitLoading = ref(true)
const isServerProvidersLoading = ref(true)
const isStorageProvidersLoading = ref(true)
const isDnsProvidersLoading = ref(true)

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
    const data = await $api<{ appInstallations: Record<string, AppInstallation[]> }>('/settings/git-providers')
    appInstallations.value = data.appInstallations
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
    const response = await $api<{ status: string }>(`/settings/git-providers/github/installations/${installationId}/refresh`, {
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

onMounted(() => {
  fetchGitProviders()
  fetchServerProviders()
  fetchStorageProviders()
  fetchDnsProviders()
})
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Git Providers -->
    <Collapsible v-model:open="gitOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:git-branch" class="size-4 text-muted-foreground" />
          <span class="font-medium">Source Control</span>
          <Badge v-if="githubInstallations.length > 0" variant="secondary" class="text-xs">
            {{ githubInstallations.length }}
          </Badge>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': gitOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div v-if="isGitLoading" class="flex items-center justify-center py-4">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div v-if="githubInstallations.length === 0" class="flex flex-col items-center gap-3 py-4">
            <Icon name="simple-icons:git" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No source control connected</span>
            <GitAddProvider :providers="gitProviders" @install="handleInstallApp" />
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="installation in githubInstallations"
              :key="installation.id"
              class="flex items-center justify-between rounded-lg border bg-muted/30 p-3"
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
            <div class="pt-2">
              <GitAddProvider :providers="gitProviders" @install="handleInstallApp" />
            </div>
          </div>
        </template>
      </CollapsibleContent>
    </Collapsible>

    <!-- Server Providers -->
    <Collapsible v-model:open="serverProvidersOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:server" class="size-4 text-muted-foreground" />
          <span class="font-medium">Server Providers</span>
          <Badge v-if="serverProviders.length > 0" variant="secondary" class="text-xs">
            {{ serverProviders.length }}
          </Badge>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': serverProvidersOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div v-if="isServerProvidersLoading" class="flex items-center justify-center py-4">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div v-if="serverProviders.length === 0" class="flex flex-col items-center gap-3 py-4">
            <Icon name="lucide:server" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No server providers connected</span>
            <SettingsAddServerProvider @created="fetchServerProviders" />
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="provider in serverProviders"
              :key="provider.id"
              class="flex items-center justify-between rounded-lg border p-3"
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
            <div class="pt-2">
              <SettingsAddServerProvider @created="fetchServerProviders" />
            </div>
          </div>
        </template>
      </CollapsibleContent>
    </Collapsible>

    <!-- Storage Providers -->
    <Collapsible v-model:open="storageProvidersOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:database" class="size-4 text-muted-foreground" />
          <span class="font-medium">Storage Providers</span>
          <Badge v-if="storageProviders.length > 0" variant="secondary" class="text-xs">
            {{ storageProviders.length }}
          </Badge>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': storageProvidersOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div v-if="isStorageProvidersLoading" class="flex items-center justify-center py-4">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div v-if="storageProviders.length === 0" class="flex flex-col items-center gap-3 py-4">
            <Icon name="lucide:database" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No storage providers connected</span>
            <SettingsAddStorageProvider @created="fetchStorageProviders" />
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="provider in storageProviders"
              :key="provider.id"
              class="flex items-center justify-between rounded-lg border p-3"
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
            <div class="pt-2">
              <SettingsAddStorageProvider @created="fetchStorageProviders" />
            </div>
          </div>
        </template>
      </CollapsibleContent>
    </Collapsible>

    <!-- DNS Providers -->
    <Collapsible v-model:open="dnsProvidersOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:globe" class="size-4 text-muted-foreground" />
          <span class="font-medium">DNS Providers</span>
          <Badge v-if="dnsProviders.length > 0" variant="secondary" class="text-xs">
            {{ dnsProviders.length }}
          </Badge>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': dnsProvidersOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div v-if="isDnsProvidersLoading" class="flex items-center justify-center py-4">
          <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <div v-if="dnsProviders.length === 0" class="flex flex-col items-center gap-3 py-4">
            <Icon name="lucide:globe" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">No DNS providers connected</span>
            <SettingsAddDnsProvider @created="fetchDnsProviders" />
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="provider in dnsProviders"
              :key="provider.id"
              class="flex items-center justify-between rounded-lg border p-3"
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
            <div class="pt-2">
              <SettingsAddDnsProvider @created="fetchDnsProviders" />
            </div>
          </div>
        </template>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>

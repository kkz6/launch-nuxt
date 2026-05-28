<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { differenceInDays, format, formatDistanceToNow } from 'date-fns'
import { certificateService } from '~/services/certificateService'
import type { CertificateUsage, StoredCertificate } from '~/types'

// Loading states
const isGitLoading = ref(true)
const isServerProvidersLoading = ref(true)
const isStorageProvidersLoading = ref(true)
const isDnsProvidersLoading = ref(true)
const isStoredCertificatesLoading = ref(true)

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

// --- Stored SSL Certificates --------------------------------------
//
// Team-scoped SSL certificate library. Manages user-provided PEM bundles
// that PHP site SSL settings + Docker domain settings pick from. This
// section is the CRUD surface; the picker components and the actual
// hook-up at the site / docker-domain dialogs land in later phases.
const storedCertificates = ref<StoredCertificate[]>([])
const isAddCertificateOpen = ref(false)
const editingCertificate = ref<StoredCertificate | undefined>(undefined)
const isEditCertificateOpen = ref(false)

const fetchStoredCertificates = async () => {
  isStoredCertificatesLoading.value = true
  try {
    const res = await certificateService.list()
    storedCertificates.value = res.data
  } catch {
    toast.error('Failed to load SSL certificates')
  } finally {
    isStoredCertificatesLoading.value = false
  }
}

const editCertificate = (cert: StoredCertificate) => {
  editingCertificate.value = cert
  isEditCertificateOpen.value = true
}

// Wired to the AddCertificate sheet's `viewExisting` event — fired when
// the duplicate-fingerprint toast's action button is clicked. We open
// the existing certificate in the Edit sheet so the user can update its
// name / notes instead of being stuck on the duplicate.
const viewExistingCertificate = async (id: string) => {
  const existing = storedCertificates.value.find((c) => c.id === id)
  if (existing) {
    editCertificate(existing)
    return
  }
  // Library not yet refreshed — fetch the cert directly.
  try {
    const res = await certificateService.get(id)
    editCertificate(res.data)
  } catch {
    toast.error('Failed to open existing certificate')
  }
}

const handleCertificateCreated = (cert: StoredCertificate) => {
  storedCertificates.value = [cert, ...storedCertificates.value]
}

const handleCertificateUpdated = (cert: StoredCertificate) => {
  storedCertificates.value = storedCertificates.value.map((c) =>
    c.id === cert.id ? cert : c,
  )
}

// Relative expiry summary. <0 days → "expired"; 0..30 days → amber;
// >30 days → plain muted. Uses date-fns formatDistanceToNow for the
// "expires in N days" copy and a falls back to absolute date when the
// cert is more than ~3 months out (matches what people scan for in
// dashboards).
const certificateExpiryInfo = (cert: StoredCertificate) => {
  const notAfter = new Date(cert.not_after)
  const daysUntil = differenceInDays(notAfter, new Date())
  let label: string
  if (daysUntil < 0) {
    label = `expired ${formatDistanceToNow(notAfter, { addSuffix: true })}`
  } else if (daysUntil <= 90) {
    label = `expires ${formatDistanceToNow(notAfter, { addSuffix: true })}`
  } else {
    label = `expires ${format(notAfter, 'MMM d, yyyy')}`
  }
  // Tailwind class for the expiry text only — surrounding subtitle text
  // stays muted-foreground.
  let className = 'text-muted-foreground'
  if (daysUntil < 0) {
    className = 'text-destructive'
  } else if (daysUntil <= 30) {
    className = 'text-amber-600 dark:text-amber-400'
  }
  return { label, className }
}

const certificatePrimaryDomain = (cert: StoredCertificate): string => {
  if (cert.common_name && cert.common_name.trim()) return cert.common_name
  if (cert.domains && cert.domains.length > 0) return cert.domains[0]
  return cert.name
}

const certificateSubtitleSegments = (cert: StoredCertificate): string[] => {
  const segments: string[] = [certificatePrimaryDomain(cert)]
  if (cert.issuer && cert.issuer.trim()) segments.push(cert.issuer)
  return segments
}

const deleteCertificate = async (
  cert: StoredCertificate,
  opts: { force?: boolean } = {},
) => {
  if (!confirmationDialog.value) return

  // First pass: ask the user. On 409 we'll re-prompt with the usage
  // list and a force-delete affordance.
  if (!opts.force) {
    const result = await confirmationDialog.value.show({
      title: 'Delete SSL Certificate',
      description: `Delete "${cert.name}"? You can't undo this.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    })
    if (!result.ok) return
  }

  try {
    await certificateService.delete(cert.id, opts)
    storedCertificates.value = storedCertificates.value.filter((c) => c.id !== cert.id)
    toast.success(
      opts.force ? 'Certificate deleted, dependents reset to Let\'s Encrypt' : 'Certificate deleted',
    )
  } catch (err: unknown) {
    const e = err as {
      response?: { status?: number }
      data?: { message?: string; usages?: CertificateUsage[] }
    }

    if (e.response?.status === 409 && e.data?.usages?.length) {
      // In use. Surface the usages list and offer force-delete.
      const usages = e.data.usages
      const siteCount = usages.filter((u) => u.kind === 'site').length
      const domainCount = usages.filter((u) => u.kind === 'docker_domain').length
      const parts: string[] = []
      if (siteCount > 0) parts.push(`${siteCount} site${siteCount === 1 ? '' : 's'}`)
      if (domainCount > 0) parts.push(`${domainCount} docker domain${domainCount === 1 ? '' : 's'}`)
      const usedBy = parts.join(' and ')

      if (!confirmationDialog.value) return
      const forceResult = await confirmationDialog.value.show({
        title: 'Certificate in Use',
        description: `"${cert.name}" is currently used by ${usedBy}. Force delete will reset all dependents to Let's Encrypt and queue redeploys.`,
        confirmText: 'Force Delete & Reset',
        cancelText: 'Cancel',
        destructive: true,
        warning: usages.slice(0, 5).map((u) => `${u.kind === 'site' ? 'Site' : 'Docker domain'}: ${u.name}`).join(' · ') + (usages.length > 5 ? ` · …and ${usages.length - 5} more` : ''),
      })
      if (forceResult.ok) {
        await deleteCertificate(cert, { force: true })
      }
      return
    }

    toast.error(e.data?.message || 'Failed to delete certificate')
  }
}

// --- Docker registry credentials ----------------------------------
//
// Saved docker-image logins. Picked from the application + compose
// create dialogs; deploy scripts run `docker login` for each before
// pulling private images. Same row-card shape the storage/dns
// sections use; the add+edit dialog component handles both modes.

import {
  dockerService,
  type DockerRegistryCredential,
} from '~/services/dockerService'

const registryCredentials = ref<DockerRegistryCredential[]>([])
const isRegistryCredentialsLoading = ref(true)
const editingRegistryCredential = ref<DockerRegistryCredential | undefined>(undefined)
const isRegistryDialogOpen = ref(false)

const fetchRegistryCredentials = async () => {
  isRegistryCredentialsLoading.value = true
  try {
    const res = await dockerService.registryCredentials.list()
    registryCredentials.value = res.data
  } catch {
    toast.error('Failed to load registry credentials')
  } finally {
    isRegistryCredentialsLoading.value = false
  }
}

const openCreateRegistryDialog = () => {
  editingRegistryCredential.value = undefined
  isRegistryDialogOpen.value = true
}

const editRegistryCredential = (c: DockerRegistryCredential) => {
  editingRegistryCredential.value = c
  isRegistryDialogOpen.value = true
}

const handleRegistryDialogClosed = () => {
  editingRegistryCredential.value = undefined
}

const deleteRegistryCredential = async (c: DockerRegistryCredential) => {
  if (!confirmationDialog.value) return
  const result = await confirmationDialog.value.show({
    title: 'Delete Registry Credential',
    description: `Delete "${c.name}"? Applications referencing it will be disconnected (their next deploy will run without auth); compose stacks will silently drop the link.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })
  if (!result.ok) return
  try {
    await dockerService.registryCredentials.delete(c.id)
    registryCredentials.value = registryCredentials.value.filter((x) => x.id !== c.id)
    toast.success('Registry credential deleted')
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    toast.error(e.data?.message || 'Failed to delete credential')
  }
}

const registryDisplayHost = (c: DockerRegistryCredential): string => {
  if (c.registry_url && c.registry_url.trim()) return c.registry_url
  return 'Docker Hub'
}

onMounted(() => {
  fetchGitProviders()
  fetchServerProviders()
  fetchStorageProviders()
  fetchDnsProviders()
  fetchStoredCertificates()
  fetchRegistryCredentials()
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
    <div class="px-6 py-6">
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

    <!--
      Stored SSL Certificates. Team library of user-provided certs that
      PHP site SSL settings and Docker domain settings will pick from
      (Phases 4 and 5). The empty state mirrors the bordered-card
      pattern other sections use; the populated state shows each cert
      as a row with name, primary domain, issuer, and a relative-time
      expiry indicator coloured amber under 30 days and red on expiry.
    -->
    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">SSL Certificates</h3>

      <SettingsAddCertificate
        v-model:open="isAddCertificateOpen"
        @created="(cert) => handleCertificateCreated(cert)"
        @view-existing="viewExistingCertificate"
      />
      <SettingsEditCertificate
        v-if="editingCertificate"
        :key="editingCertificate.id"
        v-model:open="isEditCertificateOpen"
        :certificate="editingCertificate"
        @updated="(cert) => handleCertificateUpdated(cert)"
      />

      <div
        v-if="isStoredCertificatesLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div
          v-if="storedCertificates.length === 0"
          class="rounded-lg border p-4"
        >
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon
              name="lucide:shield-check"
              class="h-8 w-8 text-muted-foreground"
            />
            <span class="text-sm text-muted-foreground">
              No SSL certificates stored
            </span>
            <Button
              variant="outline"
              size="sm"
              @click="isAddCertificateOpen = true"
            >
              <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
              Add certificate
            </Button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="cert in storedCertificates"
            :key="cert.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon name="lucide:shield-check" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ cert.name }}</span>
                <p class="text-xs text-muted-foreground">
                  <template
                    v-for="(segment, idx) in certificateSubtitleSegments(cert)"
                    :key="idx"
                  >
                    <span v-if="idx > 0"> · </span>
                    {{ segment }}
                  </template>
                  <span> · </span>
                  <span :class="certificateExpiryInfo(cert).className">
                    {{ certificateExpiryInfo(cert).label }}
                  </span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="Edit"
                @click="editCertificate(cert)"
              >
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Delete"
                @click="deleteCertificate(cert)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            @click="isAddCertificateOpen = true"
          >
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            Add certificate
          </Button>
        </div>
      </template>
    </div>

    <!--
      Docker Registry Credentials. Same row-card shape as Storage /
      DNS Providers. The dialog handles both create + edit modes; on
      edit, leaving the password input blank keeps the stored value
      so users can rotate the label / username / URL without
      retyping the secret.
    -->
    <!--
      Last section in ConnectionsTab — uses pt-6 only (no bottom
      padding) because divide-y on the parent doesn't draw a line
      below the last child, and the outer container's bottom padding
      handles the rest. Same convention DNS Providers used to follow
      when it was the last section.
    -->
    <div class="px-6 pt-6">
      <h3 class="mb-4 text-base font-semibold">Docker Registry Credentials</h3>

      <SettingsRegistryCredentialDialog
        v-model:open="isRegistryDialogOpen"
        :credential="editingRegistryCredential"
        @created="fetchRegistryCredentials"
        @updated="fetchRegistryCredentials"
        @update:open="(v) => { if (!v) handleRegistryDialogClosed() }"
      />

      <div
        v-if="isRegistryCredentialsLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <!--
        Empty + populated states mirror the SSL Certificates section
        above: a centered card with icon + label + Connect button
        when there are no credentials, and row cards + a flat Connect
        button once at least one is stored. Keeps the two sections
        visually consistent within the same tab.
      -->
      <template v-else>
        <div
          v-if="registryCredentials.length === 0"
          class="rounded-lg border p-4"
        >
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon
              name="lucide:container"
              class="h-8 w-8 text-muted-foreground"
            />
            <span class="text-sm text-muted-foreground">
              No Docker registry credentials
            </span>
            <Button
              variant="outline"
              size="sm"
              @click="openCreateRegistryDialog"
            >
              <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
              Connect
            </Button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="c in registryCredentials"
            :key="c.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon name="lucide:container" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ c.name }}</span>
                <p class="text-xs text-muted-foreground">
                  {{ registryDisplayHost(c) }} · {{ c.username }}
                </p>
              </div>
            </div>
            <!--
              Edit + delete actions. Other sections only carry a
              delete because their credentials are OAuth-style (no
              user-rotatable secret); registry logins genuinely need
              an edit affordance for password rotation, so we keep
              both. Same ghost+sm style the others use for delete.
            -->
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="Edit"
                @click="editRegistryCredential(c)"
              >
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Delete"
                @click="deleteRegistryCredential(c)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" @click="openCreateRegistryDialog">
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            Connect
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

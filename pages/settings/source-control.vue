<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { format } from 'date-fns'

definePageMeta({
  layout: 'settings',
  middleware: 'auth',
})

useHead({ title: 'Source Control' })

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
const isLoading = ref(true)
const refreshingInstallations = ref<Record<string, boolean>>({})

const githubInstallations = computed(() => appInstallations.value.github || [])
const totalConnected = computed(() => githubInstallations.value.length)

const fetchProviders = async () => {
  try {
    const data = await $api<{ appInstallations: Record<string, AppInstallation[]> }>('/settings/git-providers')
    appInstallations.value = data.appInstallations
  } catch {
    toast.error('Failed to load source control providers')
  } finally {
    isLoading.value = false
  }
}

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

const openExternalLink = (url: string | undefined) => {
  if (url) {
    window.open(url, '_blank')
  }
}

onMounted(fetchProviders)

const providers = [
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
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Source Control</h1>
      <p class="text-muted-foreground">Connect your Git providers to deploy from repositories</p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <Card v-else class="h-full bg-transparent">
      <CardHeader>
        <div class="flex flex-row items-end justify-between space-y-2">
          <div>
            <CardTitle class="text-xl">Git Providers</CardTitle>
            <CardDescription class="text-muted-foreground">
              Connect to GitHub, GitLab, or Bitbucket to deploy your applications
            </CardDescription>
          </div>
          <GitAddProvider v-if="totalConnected > 0" :providers="providers" @install="handleInstallApp" />
        </div>
      </CardHeader>
      <CardContent class="space-y-2 pt-4">
        <div v-if="totalConnected === 0" class="flex flex-col items-center gap-3">
          <Icon name="simple-icons:git" class="h-8 w-8 self-center text-muted-foreground" />
          <span class="text-base text-muted-foreground">
            No source control providers connected
          </span>
          <GitAddProvider :providers="providers" @install="handleInstallApp" />
        </div>

        <div v-else class="space-y-4">
          <div class="flex items-center gap-2">
            <Icon name="simple-icons:github" class="h-6 w-6" />
            <h3 class="font-medium">GitHub</h3>
          </div>
          <div class="space-y-3">
            <Card
              v-for="installation in githubInstallations"
              :key="installation.id"
              class="bg-muted/30"
            >
              <CardContent class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <Avatar class="h-8 w-8">
                      <AvatarImage :src="installation.accountAvatarUrl" :alt="installation.accountLogin" />
                      <AvatarFallback>
                        {{ installation.accountLogin.charAt(0).toUpperCase() }}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="font-medium">{{ installation.accountLogin }}</h4>
                        <Badge variant="secondary" class="text-xs">
                          {{ installation.accountType }}
                        </Badge>
                        <Badge v-if="installation.repositorySelection" variant="outline" class="text-xs">
                          {{ getRepoLabel(installation) }}
                        </Badge>
                      </div>
                      <p v-if="installation.createdAt" class="text-xs text-muted-foreground">
                        Installed {{ format(new Date(installation.createdAt), 'MMM dd, yyyy') }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Refresh repositories"
                      :disabled="refreshingInstallations[`github-${installation.id}`]"
                      @click="handleRefreshRepositories(installation.id)"
                    >
                      <Icon
                        name="lucide:refresh-cw"
                        class="h-4 w-4"
                        :class="{ 'animate-spin': refreshingInstallations[`github-${installation.id}`] }"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Configure installation"
                      @click="handleConfigureInstallation"
                    >
                      <Icon name="lucide:settings" class="h-4 w-4" />
                    </Button>
                    <Button
                      v-if="installation.htmlUrl"
                      variant="ghost"
                      size="sm"
                      title="View on GitHub"
                      @click="openExternalLink(installation.htmlUrl)"
                    >
                      <Icon name="lucide:external-link" class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

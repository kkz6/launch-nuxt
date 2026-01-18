<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({ title: 'Dashboard' })

const { user } = useAuth()

// Redirect to onboarding if not onboarded
onMounted(() => {
  if (!user.value?.onboarded) {
    navigateTo('/onboarding')
  }
})

// Placeholder data - will be replaced with API calls
const isLoading = ref(false)

const servers = ref([
  { id: '1', name: 'production-web-01', status: 'connected', ip: '192.168.1.1', provider: 'digitalocean', sitesCount: 4 },
  { id: '2', name: 'production-web-02', status: 'connected', ip: '192.168.1.2', provider: 'hetzner', sitesCount: 3 },
  { id: '3', name: 'staging-server', status: 'disconnected', ip: '192.168.1.3', provider: 'vultr', sitesCount: 2 },
  { id: '4', name: 'dev-server', status: 'connected', ip: '192.168.1.4', provider: 'linode', sitesCount: 3 },
])

const recentActivity = ref([
  { id: '1', type: 'deployment', siteName: 'api.example.com', serverId: '1', siteId: 's1', serverName: 'production-web-01', status: 'finished', time: new Date(Date.now() - 1000 * 60 * 5).toISOString(), commitSha: 'a1b2c3d', commitMessage: 'Fix authentication bug' },
  { id: '2', type: 'deployment', siteName: 'app.example.com', serverId: '2', siteId: 's2', serverName: 'production-web-02', status: 'deploying', time: new Date(Date.now() - 1000 * 60 * 10).toISOString(), commitSha: 'e4f5g6h', commitMessage: 'Add new dashboard features' },
  { id: '3', type: 'deployment', siteName: 'staging.example.com', serverId: '3', siteId: 's3', serverName: 'staging-server', status: 'failed', time: new Date(Date.now() - 1000 * 60 * 30).toISOString(), commitSha: 'i7j8k9l', commitMessage: 'Update dependencies' },
  { id: '4', type: 'deployment', siteName: 'docs.example.com', serverId: '1', siteId: 's4', serverName: 'production-web-01', status: 'finished', time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), commitSha: 'm0n1o2p', commitMessage: 'Documentation updates' },
  { id: '5', type: 'deployment', siteName: 'api.example.com', serverId: '1', siteId: 's1', serverName: 'production-web-01', status: 'finished', time: new Date(Date.now() - 1000 * 60 * 120).toISOString(), commitSha: 'q3r4s5t', commitMessage: 'Performance improvements' },
])

// Limit displayed items
const displayedServers = computed(() => servers.value.slice(0, 8))
const displayedActivity = computed(() => recentActivity.value.slice(0, 6))

const getProviderIcon = (provider: string): string => {
  const name = provider?.toLowerCase() || ''
  if (name.includes('digitalocean')) return 'simple-icons:digitalocean'
  if (name.includes('hetzner')) return 'simple-icons:hetzner'
  if (name.includes('linode')) return 'simple-icons:linode'
  if (name.includes('vultr')) return 'simple-icons:vultr'
  return 'lucide:server'
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'finished':
      return 'bg-green-500'
    case 'deploying':
      return 'bg-blue-500 animate-pulse'
    case 'failed':
      return 'bg-red-500'
    default:
      return 'bg-yellow-500'
  }
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'finished':
      return 'Deployed'
    case 'deploying':
      return 'Deploying'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Empty State -->
      <div v-if="servers.length === 0" class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
        <Icon name="lucide:server" class="h-12 w-12 text-muted-foreground" />
        <div class="text-center">
          <p class="font-medium">No servers yet</p>
          <p class="mt-1 text-sm text-muted-foreground">Add your first server to get started</p>
        </div>
        <ServerCreateServerDialog />
      </div>

      <template v-else>
        <!-- Servers Section -->
        <div class="mb-8">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-medium">Servers</h2>
            <NuxtLink v-if="servers.length > 8" to="/servers" class="text-sm text-muted-foreground hover:text-foreground">
              View all {{ servers.length }}
            </NuxtLink>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NuxtLink
              v-for="server in displayedServers"
              :key="server.id"
              :to="`/servers/${server.id}`"
              class="group"
            >
              <div class="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                    <Icon :name="getProviderIcon(server.provider)" class="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-medium truncate">{{ server.name }}</span>
                      <span
                        class="h-1.5 w-1.5 shrink-0 rounded-full"
                        :class="server.status === 'connected' ? 'bg-green-500' : 'bg-red-500'"
                      />
                    </div>
                    <p class="text-xs text-muted-foreground">{{ server.sitesCount }} sites</p>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <!-- Recent Activity -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-medium">Recent Activity</h2>
          </div>

          <div v-if="recentActivity.length === 0" class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
            <Icon name="lucide:activity" class="h-8 w-8 text-muted-foreground" />
            <p class="text-sm text-muted-foreground">No recent activity</p>
          </div>

          <div v-else class="rounded-lg border bg-card">
            <NuxtLink
              v-for="(activity, index) in displayedActivity"
              :key="activity.id"
              :to="`/servers/${activity.serverId}/sites/${activity.siteId}?tab=deployments`"
              class="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
              :class="{ 'border-b': index < displayedActivity.length - 1 }"
            >
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="getStatusColor(activity.status)"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ activity.siteName }}</span>
                  <span class="text-muted-foreground">&middot;</span>
                  <span class="text-sm text-muted-foreground">{{ activity.serverName }}</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-muted-foreground">
                  <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">{{ activity.commitSha }}</code>
                  <span class="truncate">{{ activity.commitMessage }}</span>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm font-medium" :class="{
                  'text-green-600 dark:text-green-400': activity.status === 'finished',
                  'text-blue-600 dark:text-blue-400': activity.status === 'deploying',
                  'text-red-600 dark:text-red-400': activity.status === 'failed',
                }">
                  {{ getStatusLabel(activity.status) }}
                </p>
                <p class="text-xs text-muted-foreground">{{ formatDate(activity.time) }}</p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

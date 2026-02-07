<script setup lang="ts">
import { useDeploymentEvents } from '~/composables/useChannelEvents'
import type { Server, Site } from '~/types'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const serverId = computed(() => route.params.id as string)
const siteId = computed(() => route.params.siteId as string)

const server = ref<Server | null>(null)
const site = ref<Site | null>(null)
const isLoading = ref(true)

// Shared terminal state with navbar
const isTerminalOpen = useState('serverTerminalOpen', () => false)

// Get current team for WebSocket channel
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

// Subscribe to real-time deployment events
useDeploymentEvents(teamId, (data) => {
  // Refresh site data when deployment completes for this site
  if (data.site_id === siteId.value && (data.status === 'finished' || data.status === 'failed')) {
    fetchSite()
  }
})

// Valid tab values
const validTabs = ['general', 'deployments', 'files', 'queues', 'redirects', 'commands', 'settings']

// Get initial tab from query params or default to "general"
const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string
  return validTabs.includes(tabFromQuery) ? tabFromQuery : 'general'
}

const activeTab = ref(getInitialTab())

// Watch for tab changes from URL (navbar navigation)
watch(() => route.query.tab, (newTab) => {
  if (newTab && validTabs.includes(newTab as string)) {
    activeTab.value = newTab as string
  }
})

const fetchSite = async () => {
  try {
    const siteData = await $api<{ data: Site }>(`/servers/${serverId.value}/sites/${siteId.value}`)
    site.value = siteData.data
  } catch {
    // Silent fail on refresh
  }
}

onMounted(async () => {
  try {
    const [serverData, siteData] = await Promise.all([
      $api<{ data: Server }>(`/servers/${serverId.value}`),
      $api<{ data: Site }>(`/servers/${serverId.value}/sites/${siteId.value}`),
    ])
    server.value = serverData.data
    site.value = siteData.data
    useHead({ title: site.value?.address || 'Site' })
  } catch {
    navigateTo(`/servers/${serverId.value}`)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="site && server" class="pb-10">
    <!-- Tab Content -->
    <div v-if="activeTab === 'general'" class="space-y-4">
      <SiteDeployBlock v-if="site.type !== 'wordpress'" :server="server" :site="site" />
      <SiteLoadBalancedBanner :site="site" />
      <SiteOverview :server="server" :site="site" />
      <SiteLaravelFeatures
        v-if="site.type === 'laravel'"
        :server-id="server.id"
        :site="site"
        @updated="fetchSite"
      />
    </div>

    <div v-else-if="activeTab === 'deployments'">
      <SiteDeployments :server-id="server.id" :site-id="site.id" :site="site" />
    </div>

    <div v-else-if="activeTab === 'files'">
      <SiteFiles :server-id="server.id" :site-id="site.id" />
    </div>

    <div v-else-if="activeTab === 'queues'">
      <SiteQueues :server-id="server.id" :site-id="site.id" :site="site" :auto-restart-queue="site.auto_restart_queue" />
    </div>

    <div v-else-if="activeTab === 'redirects'">
      <SiteRedirects :server-id="server.id" :site-id="site.id" :site-address="site.address" />
    </div>

    <div v-else-if="activeTab === 'commands'">
      <SiteCommands :server-id="server.id" :site-id="site.id" />
    </div>

    <div v-else-if="activeTab === 'settings'">
      <SiteSettings :server-id="server.id" :site="site" @updated="fetchSite" />
    </div>

    <!-- Terminal Panel -->
    <SiteTerminalPanel
      :server="server"
      :site="site"
      :is-open="isTerminalOpen"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight, Terminal } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import type { Server, Site, Deployment } from '~/types'

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
const isTerminalOpen = ref(false)

const modifierKey = computed(() => {
  if (import.meta.client) {
    return navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'
  }
  return 'Ctrl'
})

// Valid tab values
const validTabs = ['general', 'deployments', 'files', 'logs', 'queues', 'commands', 'settings']

// Get initial tab from query params or default to "general"
const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string
  return validTabs.includes(tabFromQuery) ? tabFromQuery : 'general'
}

const activeTab = ref(getInitialTab())

// Sync tab changes to URL query params
watch(activeTab, (newTab) => {
  router.replace({
    query: { ...route.query, tab: newTab },
  })
})

// Scroll state for tabs
const scrollRef = ref<HTMLDivElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const checkScroll = () => {
  const el = scrollRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth
}

const scrollBy = (amount: number) => {
  scrollRef.value?.scrollBy({ left: amount, behavior: 'smooth' })
}

const applicationTypes: Record<string, string> = {
  laravel: 'Laravel',
  wordpress: 'WordPress',
  generic: 'Generic PHP',
}

const serviceProviders: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  hetzner: 'Hetzner',
  linode: 'Linode',
  vultr: 'Vultr',
  aws: 'AWS',
  custom_server: 'Custom Server',
}

interface TabConfig {
  value: string
  label: string
  icon: string
}

const allTabs: TabConfig[] = [
  { value: 'general', label: 'Overview', icon: 'lucide:layout-dashboard' },
  { value: 'deployments', label: 'Deployments', icon: 'lucide:git-branch' },
  { value: 'files', label: 'Files', icon: 'lucide:file-text' },
  { value: 'logs', label: 'Logs', icon: 'lucide:scroll-text' },
  { value: 'queues', label: 'Queues', icon: 'lucide:database' },
  { value: 'commands', label: 'Commands', icon: 'lucide:terminal' },
  { value: 'settings', label: 'Settings', icon: 'lucide:settings' },
]

const availableTabs = computed(() => {
  if (!site.value) return allTabs
  const siteType = site.value.type
  if (siteType === 'wordpress') {
    return allTabs.filter((t) => !['deployments', 'queues'].includes(t.value))
  }
  if (siteType === 'generic') {
    return allTabs.filter((t) => t.value !== 'queues')
  }
  return allTabs
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

    // Initialize scroll check
    nextTick(() => {
      checkScroll()
      scrollRef.value?.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
    })
  } catch {
    navigateTo(`/servers/${serverId.value}`)
  } finally {
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  scrollRef.value?.removeEventListener('scroll', checkScroll)
  window.removeEventListener('resize', checkScroll)
})
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="site && server" class="pb-10">
    <div class="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <NuxtLink to="/servers">Servers</NuxtLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <NuxtLink :to="`/servers/${server.id}`">{{ server.name }}</NuxtLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{{ site.address }}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header class="mb-6 flex w-full items-center justify-between gap-4 max-sm:flex-wrap">
        <div class="flex w-fit flex-col justify-between gap-2">
          <div class="flex flex-row flex-wrap items-center gap-2 xl:gap-4">
            <h1 class="flex items-center gap-2 text-xl font-bold lg:text-3xl">
              {{ site.address }}
              <a :href="site.url" target="_blank" rel="noreferrer">
                <Icon name="lucide:external-link" class="h-5 w-5 text-gray-400" />
              </a>
            </h1>
          </div>
          <div class="flex h-fit w-fit flex-row gap-2">
            <Badge>{{ applicationTypes[site.type] }}</Badge>
            <Badge v-if="server.provider" variant="outline">
              {{ serviceProviders[server.provider] || server.provider }}
            </Badge>
            <Badge v-if="site.zero_downtime_deployment" variant="secondary">
              Zero Downtime
            </Badge>
          </div>
        </div>
        <SiteDeployApplication
          v-if="site.type !== 'wordpress'"
          :server-id="server.id"
          :site-id="site.id"
          :is-deploying="site.latest_deployment?.status === 'pending'"
          as-icon
        />
      </header>
    </div>

    <Tabs v-model="activeTab" class="w-full">
      <div class="flex w-full items-center gap-4">
        <!-- Tabs with scroll -->
        <div class="relative min-w-0 flex-1">
          <!-- Left scroll button -->
          <div class="absolute inset-y-0 left-0 z-10 flex items-center">
            <button
              v-if="canScrollLeft"
              class="mb-3 rounded-full bg-background p-1 shadow"
              aria-label="Scroll left"
              @click="scrollBy(-100)"
            >
              <ChevronLeft class="h-4 w-4" />
            </button>
          </div>

          <!-- Right scroll button -->
          <div class="absolute inset-y-0 right-0 z-10 flex items-center">
            <button
              v-if="canScrollRight"
              class="mb-3 rounded-full bg-background p-1 shadow"
              aria-label="Scroll right"
              @click="scrollBy(100)"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>

          <div
            ref="scrollRef"
            class="scrollbar-none w-full overflow-x-auto whitespace-nowrap"
            :style="{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }"
          >
            <TabsList class="mb-3 flex h-auto min-w-max justify-start -space-x-px bg-background p-0">
              <TabsTrigger
                v-for="tab in availableTabs"
                :key="tab.value"
                :value="tab.value"
                class="relative w-[140px] whitespace-nowrap rounded-none border border-border py-2 shadow-sm shadow-black/5 first:rounded-s last:rounded-e after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-muted data-[state=active]:after:bg-primary"
              >
                <Icon :name="tab.icon" class="-ms-0.5 me-1.5 h-4 w-4 shrink-0 opacity-60" />
                {{ tab.label }}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <!-- Terminal Button -->
        <div v-if="server.connected" class="flex-shrink-0">
          <TooltipProvider :delay-duration="0">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  class="relative mb-3"
                  variant="ghost"
                  size="icon"
                  @click="isTerminalOpen = true"
                >
                  <Terminal class="h-4 w-4" />
                  <span
                    v-if="isTerminalOpen"
                    class="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 animate-pulse rounded-full bg-green-500"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span class="flex items-center gap-2">
                  Terminal
                  <kbd class="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
                    {{ modifierKey }}+`
                  </kbd>
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <TabsContent value="general" class="space-y-4 pt-2.5">
        <SiteDeployBlock v-if="site.type !== 'wordpress'" :server="server" :site="site" />
        <SiteOverview :server="server" :site="site" />
        <SiteLaravelFeatures
          v-if="site.type === 'laravel'"
          :server-id="server.id"
          :site="site"
          @updated="fetchSite"
        />
      </TabsContent>

      <TabsContent value="deployments" class="pt-2.5">
        <SiteDeployments :server-id="server.id" :site-id="site.id" :site="site" />
      </TabsContent>

      <TabsContent value="files" class="pt-2.5">
        <SiteFiles :server-id="server.id" :site-id="site.id" />
      </TabsContent>

      <TabsContent value="logs" class="pt-2.5">
        <ServerShowLogs :server-id="server.id" type="site" :site-id="site.id" />
      </TabsContent>

      <TabsContent value="queues" class="pt-2.5">
        <SiteQueues :server-id="server.id" :site-id="site.id" :auto-restart-queue="site.auto_restart_queue" />
      </TabsContent>

      <TabsContent value="commands" class="pt-2.5">
        <SiteCommands :server-id="server.id" :site-id="site.id" />
      </TabsContent>

      <TabsContent value="settings" class="pt-2.5">
        <SiteSettings :server-id="server.id" :site="site" @updated="fetchSite" />
      </TabsContent>
    </Tabs>

    <!-- Terminal Panel -->
    <SiteTerminalPanel
      :server="server"
      :site="site"
      :is-open="isTerminalOpen"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

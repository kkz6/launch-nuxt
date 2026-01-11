<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Badge } from '~/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'
import type { Server, Site } from '~/types'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const serverId = computed(() => route.params.id as string)

const server = ref<Server | null>(null)
const sites = ref<Site[]>([])
const activeTab = ref('sites')
const isLoading = ref(true)

const tabs = [
  { value: 'sites', label: 'Sites', icon: 'lucide:globe' },
  { value: 'databases', label: 'Databases', icon: 'lucide:database' },
  { value: 'networks', label: 'Networks', icon: 'lucide:network' },
  { value: 'logs', label: 'Logs', icon: 'lucide:scroll-text' },
  { value: 'daemons', label: 'Daemons', icon: 'lucide:activity' },
  { value: 'schedulers', label: 'Schedulers', icon: 'lucide:clock' },
  { value: 'advanced', label: 'Advanced', icon: 'lucide:terminal' },
]

const serviceProviders: Record<string, string> = {
  digitalocean: 'DigitalOcean',
  hetzner: 'Hetzner',
  linode: 'Linode',
  vultr: 'Vultr',
  aws: 'AWS',
  custom_server: 'Custom Server',
}

onMounted(async () => {
  try {
    const [serverData, sitesData] = await Promise.all([
      $api<{ data: Server }>(`/servers/${serverId.value}`),
      $api<{ data: Site[] }>(`/servers/${serverId.value}/sites`),
    ])
    server.value = serverData.data
    sites.value = sitesData.data
    useHead({ title: server.value?.name || 'Server' })
  } catch {
    navigateTo('/servers')
  } finally {
    isLoading.value = false
  }
})

const copyIp = () => {
  if (server.value?.public_ipv4) {
    navigator.clipboard.writeText(server.value.public_ipv4)
  }
}
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="server" class="pb-10">
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
            <BreadcrumbLink>{{ server.name }}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header class="mb-6 flex w-full items-center justify-between gap-4 max-sm:flex-wrap">
        <div class="flex w-fit flex-col justify-between gap-2">
          <div class="flex flex-row flex-wrap items-center gap-2 xl:gap-4">
            <h1 class="flex items-center gap-2 text-xl font-bold lg:text-3xl">
              {{ server.name }}
            </h1>
          </div>
          <div v-if="server.provider" class="flex h-fit w-fit flex-row gap-2">
            <Badge :variant="server.connected ? 'default' : 'destructive'">
              {{ server.connected ? 'Connected' : 'Disconnected' }}
            </Badge>
            <Badge
              variant="outline"
              class="cursor-pointer"
              @click="copyIp"
            >
              {{ server.public_ipv4 }}
            </Badge>
            <Badge>
              {{ server.provider === 'custom_server' ? 'Custom Server' : serviceProviders[server.provider] || server.provider }}
            </Badge>
          </div>
        </div>
        <p v-if="server.description" class="max-w-6xl text-sm text-muted-foreground">
          {{ server.description }}
        </p>
      </header>
    </div>

    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="mb-3 flex h-auto justify-start gap-0 bg-background p-0">
        <TabsTrigger
          v-for="tab in tabs"
          :key="tab.value"
          :value="tab.value"
          class="relative w-[120px] overflow-hidden whitespace-nowrap rounded-none border border-border py-2 shadow-sm shadow-black/5 first:rounded-s last:rounded-e data-[state=active]:bg-muted data-[state=active]:after:bg-primary after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5"
        >
          <Icon :name="tab.icon" class="-ms-0.5 me-1.5 h-4 w-4 opacity-60" />
          {{ tab.label }}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sites" class="pt-2.5">
        <ServerShowSites :sites="sites" :server="server" />
      </TabsContent>

      <TabsContent value="databases" class="pt-2.5">
        <ServerShowDatabases :server-id="server.id" />
      </TabsContent>

      <TabsContent value="networks" class="pt-2.5">
        <ServerShowNetworks :server-id="server.id" />
      </TabsContent>

      <TabsContent value="logs" class="pt-2.5">
        <ServerShowLogs :server-id="server.id" />
      </TabsContent>

      <TabsContent value="daemons" class="pt-2.5">
        <ServerShowDaemons :server-id="server.id" />
      </TabsContent>

      <TabsContent value="schedulers" class="pt-2.5">
        <ServerShowSchedulers :server-id="server.id" />
      </TabsContent>

      <TabsContent value="advanced" class="pt-2.5">
        <ServerAdvancedSettings :server="server" />
      </TabsContent>
    </Tabs>
  </div>
</template>

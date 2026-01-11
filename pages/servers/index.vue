<script setup lang="ts">
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { Server } from '~/types'

definePageMeta({
  middleware: 'auth',
})

useHead({
  title: 'Servers',
})

const servers = ref<Server[]>([])
const isLoading = ref(true)

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
    const response = await $api<{ data: Server[] }>('/servers')
    servers.value = response.data
  } catch {
    // Handle error silently
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Servers</h1>
        <p class="text-muted-foreground">Manage your cloud servers</p>
      </div>
      <Button as-child>
        <NuxtLink to="/servers/create">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Server
        </NuxtLink>
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="servers.length === 0" class="flex flex-col items-center justify-center py-12">
      <Icon name="lucide:server" class="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 class="text-lg font-semibold">No servers yet</h3>
      <p class="mb-4 text-muted-foreground">Get started by creating your first server</p>
      <Button as-child>
        <NuxtLink to="/servers/create">Create Server</NuxtLink>
      </Button>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="server in servers"
        :key="server.id"
        :to="`/servers/${server.id}`"
        class="block"
      >
        <Card class="transition-colors hover:bg-muted/50">
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-lg">{{ server.name }}</CardTitle>
              <Badge :variant="server.connected ? 'default' : 'destructive'">
                {{ server.connected ? 'Connected' : 'Disconnected' }}
              </Badge>
            </div>
            <CardDescription class="flex items-center gap-2">
              <Icon name="lucide:globe" class="h-3 w-3" />
              {{ server.public_ipv4 }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">
                {{ serviceProviders[server.provider] || server.provider }}
              </span>
              <span class="text-muted-foreground">
                {{ server.sites_count }} {{ server.sites_count === 1 ? 'site' : 'sites' }}
              </span>
            </div>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>

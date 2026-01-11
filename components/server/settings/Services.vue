<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { Service } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const services = ref<Service[]>([])
const isLoading = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchServices = async () => {
  try {
    const data = await $api<{ data: Service[] }>(`/servers/${props.serverId}/services`)
    services.value = data.data
  } catch {
    toast.error('Failed to load services')
  } finally {
    isLoading.value = false
  }
}

const serviceAction = async (service: Service, action: 'start' | 'stop' | 'restart') => {
  if (!confirmationDialog.value) return

  const actionLabels = { start: 'Start', stop: 'Stop', restart: 'Restart' }
  const result = await confirmationDialog.value.show({
    title: `${actionLabels[action]} Service`,
    description: `Are you sure you want to ${action} "${service.name}"?`,
    confirmText: actionLabels[action],
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/services/${service.id}/${action}`, {
        method: 'POST',
      })
      toast.success(`Service ${action} initiated`)
      fetchServices()
    } catch {
      toast.error(`Failed to ${action} service`)
    }
  }
}

const statusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case 'running':
      return 'default'
    case 'stopped':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const serviceIcons: Record<string, string> = {
  nginx: 'lucide:server',
  mysql: 'lucide:database',
  mariadb: 'lucide:database',
  postgresql: 'lucide:database',
  redis: 'lucide:layers',
  memcached: 'lucide:layers',
  supervisor: 'lucide:activity',
  php: 'lucide:file-code',
}

onMounted(fetchServices)
</script>

<template>
  <Card>
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle>Services</CardTitle>
        <CardDescription>Manage system services on this server</CardDescription>
      </div>
      <Button variant="outline" @click="fetchServices">
        <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </CardHeader>
    <CardContent>
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="space-y-4">
          <div
            v-for="service in services"
            :key="service.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-4">
              <Icon
                :name="serviceIcons[service.software] || 'lucide:box'"
                class="h-8 w-8 text-muted-foreground"
              />
              <div>
                <p class="font-medium">{{ service.name }}</p>
                <p class="text-sm text-muted-foreground">{{ service.version }}</p>
              </div>
              <Badge :variant="statusVariant(service.status)">
                {{ service.status }}
              </Badge>
            </div>
            <div class="flex gap-2">
              <Button
                v-if="service.status === 'stopped'"
                variant="outline"
                size="sm"
                @click="serviceAction(service, 'start')"
              >
                <Icon name="lucide:play" class="mr-1 h-4 w-4" />
                Start
              </Button>
              <Button
                v-if="service.status === 'running'"
                variant="outline"
                size="sm"
                @click="serviceAction(service, 'restart')"
              >
                <Icon name="lucide:rotate-ccw" class="mr-1 h-4 w-4" />
                Restart
              </Button>
              <Button
                v-if="service.status === 'running'"
                variant="outline"
                size="sm"
                @click="serviceAction(service, 'stop')"
              >
                <Icon name="lucide:square" class="mr-1 h-4 w-4" />
                Stop
              </Button>
            </div>
          </div>

          <div v-if="services.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Icon name="lucide:boxes" class="mb-3 h-8 w-8" />
            <p>No services found</p>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>
</template>

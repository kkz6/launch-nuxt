<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

interface ServiceStatusDetails {
  pid?: string
  memory_usage?: string
  started_at?: string
  processes?: string[]
  connections?: string[]
  additional_info?: Record<string, string>
}

interface Service {
  id: string
  server_id: string
  type: string
  type_label: string
  name: string
  version: string
  status: string
  status_label: string
  is_default: boolean
  software: string
  software_label: string
  created_at: string
  updated_at: string
  last_status_check?: string
  status_details?: ServiceStatusDetails
  status_output?: string
  image_path?: string
}

interface Props {
  serverId: string
}

const props = defineProps<Props>()

const services = ref<Service[]>([])
const isLoading = ref(true)
const loadingAction = ref<{ software: string; action: string } | null>(null)
const isInstallDialogOpen = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Status dialog state
const isStatusDialogOpen = ref(false)
const selectedServiceForStatus = ref<Service | null>(null)

// Map service types to image paths
const getServiceImagePath = (service: Service) => {
  const imageMap: Record<string, string> = {
    php: '/images/services/php.svg',
    mysql: '/images/services/mysql.svg',
    postgresql: '/images/services/postgresql.svg',
    webserver: '/images/services/webserver.svg',
    process_manager: '/images/services/process_manager.svg',
    memory_database: '/images/services/memory_database.svg',
    package_manager: '/images/services/package_manager.svg',
    bun: '/images/services/bun.svg',
    node: '/images/services/node.svg',
    launch_agent: '/images/services/launch_agent.svg',
  }

  // First check if we have a local mapping for this type
  if (imageMap[service.type]) {
    return imageMap[service.type]
  }

  // Transform API path from /images/software/ to /images/services/
  if (service.image_path) {
    return service.image_path.replace('/images/software/', '/images/services/')
  }

  return '/images/services/package_manager.svg'
}

const fetchServices = async () => {
  try {
    const data = await $api<{ data: Service[] }>(`/servers/${props.serverId}/services`)
    services.value = data.data || []
  } catch {
    toast.error('Failed to load services')
  } finally {
    isLoading.value = false
  }
}

const serviceAction = async (service: Service, action: 'start' | 'stop' | 'restart') => {
  if (!confirmationDialog.value) return

  const actionLabels: Record<string, string> = { start: 'Start', stop: 'Stop', restart: 'Restart' }
  const result = await confirmationDialog.value.show({
    title: `${actionLabels[action]} Service`,
    description: `Are you sure you want to ${action} "${service.name}"?`,
    confirmText: actionLabels[action],
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  loadingAction.value = { software: service.software, action }

  try {
    await $api(`/servers/${props.serverId}/services/${service.id}/${action}`, {
      method: 'POST',
    })
    toast.success(`${service.name} ${action} initiated`)
    fetchServices()
  } catch {
    toast.error(`Failed to ${action} service`)
  } finally {
    loadingAction.value = null
  }
}

const checkStatus = async (service: Service) => {
  loadingAction.value = { software: service.software, action: 'status' }

  try {
    toast.info(`Checking status of ${service.name}...`)
    const response = await $api<{
      status: string
      status_label: string
      last_status_check: string
      status_details?: ServiceStatusDetails
      status_output?: string
    }>(`/servers/${props.serverId}/services/${service.id}/status`, {
      method: 'POST',
    })

    // Update the service with new status data
    const serviceIndex = services.value.findIndex(s => s.id === service.id)
    if (serviceIndex !== -1) {
      services.value[serviceIndex] = {
        ...services.value[serviceIndex],
        status: response.status,
        status_label: response.status_label,
        last_status_check: response.last_status_check,
        status_details: response.status_details,
        status_output: response.status_output,
      }
    }

    toast.success(`Status checked for ${service.name}`)

    // Open the status dialog
    selectedServiceForStatus.value = services.value[serviceIndex]
    isStatusDialogOpen.value = true
  } catch {
    toast.error(`Failed to check status of ${service.name}`)
  } finally {
    loadingAction.value = null
  }
}

const handleStatusRefresh = async () => {
  if (selectedServiceForStatus.value) {
    await checkStatus(selectedServiceForStatus.value)
  }
}

const openStatusDialog = (service: Service) => {
  selectedServiceForStatus.value = service
  isStatusDialogOpen.value = true
}

const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' => {
  if (!status) return 'secondary'
  switch (status.toLowerCase()) {
    case 'running':
      return 'success'
    case 'stopped':
    case 'failed':
      return 'destructive'
    case 'pending':
      return 'warning'
    case 'installed':
      return 'default'
    default:
      return 'secondary'
  }
}

// Check if a service can be started/stopped/restarted based on status
const canStart = (service: Service) => service.status === 'stopped'
const canStop = (service: Service) => service.status === 'running'
const canRestart = (service: Service) => service.status === 'running'
const hasActions = (_service: Service) => true // Always show dropdown for Check Status

const sortedServices = computed(() =>
  [...services.value].sort((a, b) => a.name.localeCompare(b.name))
)

onMounted(fetchServices)
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Install Service Dialog -->
    <ServerSettingsInstallServiceDialog
      v-model:open="isInstallDialogOpen"
      :server-id="serverId"
      @installed="fetchServices"
    />

    <!-- Service Status Dialog -->
    <ServerSettingsServiceStatusDialog
      v-if="selectedServiceForStatus"
      v-model:open="isStatusDialogOpen"
      :service="selectedServiceForStatus"
      :get-image-path="getServiceImagePath"
      @refresh="handleStatusRefresh"
    />

    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>
            {{ services.length }} service{{ services.length !== 1 ? 's' : '' }} installed
          </CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" @click="fetchServices">
            <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button @click="isInstallDialogOpen = true">
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            Install Service
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <template v-else>
          <!-- Empty State -->
          <div v-if="services.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Icon name="lucide:package" class="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 class="mb-2 text-xl font-semibold">No services installed</h2>
            <p class="mb-8 max-w-md text-muted-foreground">
              Services like databases, caching systems, and runtimes help power your applications.
            </p>
            <Button size="lg" @click="isInstallDialogOpen = true">
              <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
              Install Your First Service
            </Button>
          </div>

          <!-- Services Table -->
          <div v-else class="overflow-hidden rounded-lg border">
            <!-- Table Header -->
            <div class="hidden border-b bg-muted/50 px-6 py-3 md:grid md:grid-cols-12 md:gap-4">
              <div class="col-span-4 text-sm font-medium text-muted-foreground">Service</div>
              <div class="col-span-2 text-sm font-medium text-muted-foreground">Version</div>
              <div class="col-span-2 text-sm font-medium text-muted-foreground">Status</div>
              <div class="col-span-4 text-right text-sm font-medium text-muted-foreground">Actions</div>
            </div>

            <!-- Table Body -->
            <div class="divide-y">
              <div
                v-for="service in sortedServices"
                :key="service.id"
                class="px-4 py-4 transition-colors hover:bg-muted/30 md:px-6"
              >
                <!-- Mobile Layout -->
                <div class="flex flex-col gap-3 md:hidden">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                        <img
                          :src="getServiceImagePath(service)"
                          :alt="service.name"
                          class="h-6 w-6 object-contain"
                          @error="($event.target as HTMLImageElement).style.display = 'none'"
                        >
                      </div>
                      <div class="min-w-0">
                        <div class="truncate font-medium">{{ service.name }}</div>
                        <div class="font-mono text-xs text-muted-foreground">v{{ service.version }}</div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <Icon
                        v-if="loadingAction?.software === service.software"
                        name="lucide:loader-2"
                        class="h-4 w-4 animate-spin text-muted-foreground"
                      />
                      <DropdownMenu v-if="hasActions(service)">
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="sm">
                            <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-48">
                          <DropdownMenuItem v-if="canStart(service)" @click="serviceAction(service, 'start')">
                            <Icon name="lucide:play" class="mr-2 h-4 w-4" />
                            Start
                          </DropdownMenuItem>
                          <DropdownMenuItem v-if="canStop(service)" @click="serviceAction(service, 'stop')">
                            <Icon name="lucide:power" class="mr-2 h-4 w-4" />
                            Stop
                          </DropdownMenuItem>
                          <DropdownMenuItem v-if="canRestart(service)" @click="serviceAction(service, 'restart')">
                            <Icon name="lucide:rotate-ccw" class="mr-2 h-4 w-4" />
                            Restart
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="checkStatus(service)">
                            <Icon name="lucide:activity" class="mr-2 h-4 w-4" />
                            Check Status
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <Badge :variant="getStatusVariant(service.status)">
                      {{ service.status_label }}
                    </Badge>
                    <span v-if="service.last_status_check" class="text-xs text-muted-foreground">
                      Checked: {{ new Date(service.last_status_check).toLocaleTimeString() }}
                    </span>
                  </div>
                </div>

                <!-- Desktop Layout -->
                <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                  <div class="col-span-4 flex items-center gap-3">
                    <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <img
                        :src="getServiceImagePath(service)"
                        :alt="service.name"
                        class="h-6 w-6 object-contain"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      >
                    </div>
                    <div class="min-w-0">
                      <div class="truncate font-medium">{{ service.name }}</div>
                      <div v-if="service.last_status_check" class="text-xs text-muted-foreground">
                        Last checked: {{ new Date(service.last_status_check).toLocaleTimeString() }}
                      </div>
                      <div v-else class="text-xs text-muted-foreground">{{ service.type_label }}</div>
                    </div>
                  </div>

                  <div class="col-span-2">
                    <span class="font-mono text-sm">{{ service.version }}</span>
                  </div>

                  <div class="col-span-2">
                    <Badge :variant="getStatusVariant(service.status)">
                      {{ service.status_label }}
                    </Badge>
                  </div>

                  <div class="col-span-4 flex items-center justify-end gap-2">
                    <Icon
                      v-if="loadingAction?.software === service.software"
                      name="lucide:loader-2"
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                    <DropdownMenu v-if="hasActions(service)">
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" size="sm">
                          <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="w-48">
                        <DropdownMenuItem v-if="canStart(service)" @click="serviceAction(service, 'start')">
                          <Icon name="lucide:play" class="mr-2 h-4 w-4" />
                          Start
                        </DropdownMenuItem>
                        <DropdownMenuItem v-if="canStop(service)" @click="serviceAction(service, 'stop')">
                          <Icon name="lucide:power" class="mr-2 h-4 w-4" />
                          Stop
                        </DropdownMenuItem>
                        <DropdownMenuItem v-if="canRestart(service)" @click="serviceAction(service, 'restart')">
                          <Icon name="lucide:rotate-ccw" class="mr-2 h-4 w-4" />
                          Restart
                        </DropdownMenuItem>
                        <DropdownMenuSeparator v-if="canStart(service) || canStop(service) || canRestart(service)" />
                        <DropdownMenuItem @click="checkStatus(service)">
                          <Icon name="lucide:activity" class="mr-2 h-4 w-4" />
                          Check Status
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

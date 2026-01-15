<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'

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

// WebSocket for real-time status updates
const {
  services: liveStatuses,
  isConnected: wsConnected,
  isConnecting: wsConnecting,
  error: wsError,
  lastUpdated: wsLastUpdated,
  reconnect: wsReconnect,
} = useServiceStatus({
  serverId: props.serverId,
  interval: 5,
})

// Get live status for a service
const getLiveStatus = (serviceId: string) => {
  return liveStatuses.value.find(s => s.id === serviceId)
}

// Get display status (prefer live status over API status)
const getDisplayStatus = (service: Service) => {
  const live = getLiveStatus(service.id)
  if (live) {
    return {
      status: live.status,
      label: live.status.charAt(0).toUpperCase() + live.status.slice(1),
      memory: live.memory,
      uptime: live.uptime,
      pid: live.pid,
      isLive: true,
    }
  }
  return {
    status: service.status,
    label: service.status_label,
    memory: service.status_details?.memory_usage,
    uptime: undefined,
    pid: service.status_details?.pid ? Number(service.status_details.pid) : undefined,
    isLive: false,
  }
}

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

  if (imageMap[service.type]) {
    return imageMap[service.type]
  }

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
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'unknown':
      return 'warning'
    case 'pending':
      return 'warning'
    case 'installed':
      return 'default'
    default:
      return 'secondary'
  }
}

// Check if a service can be started/stopped/restarted based on live status
const canStart = (service: Service) => {
  const live = getLiveStatus(service.id)
  const status = live?.status || service.status
  return status === 'stopped' || status === 'failed'
}

const canStop = (service: Service) => {
  const live = getLiveStatus(service.id)
  const status = live?.status || service.status
  return status === 'running'
}

const canRestart = (service: Service) => {
  const live = getLiveStatus(service.id)
  const status = live?.status || service.status
  return status === 'running'
}

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
      :live-status="getLiveStatus(selectedServiceForStatus.id)"
      :last-updated="wsLastUpdated"
    />

    <div class="flex items-start justify-between">
      <div>
        <h3 class="flex items-center gap-2 text-lg font-medium">
          Services
          <!-- Connection Status Indicator -->
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
                  :class="[
                    wsConnected
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : wsConnecting
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
                  ]"
                  @click="!wsConnected && !wsConnecting && wsReconnect()"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="[
                      wsConnected
                        ? 'bg-emerald-500 animate-pulse'
                        : wsConnecting
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-red-500',
                    ]"
                  />
                  {{ wsConnected ? 'Live' : wsConnecting ? 'Connecting' : 'Disconnected' }}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p v-if="wsConnected && wsLastUpdated">
                  Last updated: {{ wsLastUpdated.toLocaleTimeString() }}
                </p>
                <p v-else-if="wsConnecting">Connecting to status stream...</p>
                <p v-else-if="wsError">{{ wsError }}</p>
                <p v-else>Click to reconnect</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ services.length }} service{{ services.length !== 1 ? 's' : '' }} installed
        </p>
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
    </div>

    <div>
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
              <div class="col-span-3 text-sm font-medium text-muted-foreground">Service</div>
              <div class="col-span-2 text-sm font-medium text-muted-foreground">Status</div>
              <div class="col-span-2 text-sm font-medium text-muted-foreground">Memory</div>
              <div class="col-span-2 text-sm font-medium text-muted-foreground">Uptime</div>
              <div class="col-span-3 text-right text-sm font-medium text-muted-foreground">Actions</div>
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
                      <DropdownMenu>
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
                          <DropdownMenuItem @click="openStatusDialog(service)">
                            <Icon name="lucide:activity" class="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge :variant="getStatusVariant(getDisplayStatus(service).status)">
                      {{ getDisplayStatus(service).label }}
                    </Badge>
                    <span v-if="getDisplayStatus(service).memory" class="text-xs text-muted-foreground">
                      {{ getDisplayStatus(service).memory }}
                    </span>
                    <span v-if="getDisplayStatus(service).uptime" class="text-xs text-muted-foreground">
                      {{ getDisplayStatus(service).uptime }}
                    </span>
                  </div>
                </div>

                <!-- Desktop Layout -->
                <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                  <div class="col-span-3 flex items-center gap-3">
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
                      <div class="text-xs text-muted-foreground">v{{ service.version }}</div>
                    </div>
                  </div>

                  <div class="col-span-2">
                    <div class="flex items-center gap-2">
                      <Badge :variant="getStatusVariant(getDisplayStatus(service).status)">
                        {{ getDisplayStatus(service).label }}
                      </Badge>
                      <TooltipProvider v-if="getDisplayStatus(service).pid">
                        <Tooltip>
                          <TooltipTrigger>
                            <span class="text-xs text-muted-foreground">
                              PID {{ getDisplayStatus(service).pid }}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Process ID</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  <div class="col-span-2">
                    <span v-if="getDisplayStatus(service).memory" class="text-sm">
                      {{ getDisplayStatus(service).memory }}
                    </span>
                    <span v-else class="text-sm text-muted-foreground">—</span>
                  </div>

                  <div class="col-span-2">
                    <span v-if="getDisplayStatus(service).uptime" class="text-sm">
                      {{ getDisplayStatus(service).uptime }}
                    </span>
                    <span v-else class="text-sm text-muted-foreground">—</span>
                  </div>

                  <div class="col-span-3 flex items-center justify-end gap-2">
                    <Icon
                      v-if="loadingAction?.software === service.software"
                      name="lucide:loader-2"
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                    <DropdownMenu>
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
                        <DropdownMenuItem @click="openStatusDialog(service)">
                          <Icon name="lucide:activity" class="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
  </div>
</template>

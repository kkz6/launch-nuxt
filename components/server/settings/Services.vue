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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import type { LogInfo } from '~/types'

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
  serverType?: string
}

const props = defineProps<Props>()

const isLoadBalancer = computed(() => props.serverType === 'loadbalancer')

const services = ref<Service[]>([])
const isLoading = ref(true)
const loadingAction = ref<{ software: string; action: string } | null>(null)
const isInstallDialogOpen = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Launch Agent update banner
interface AgentVersionInfo {
  service_id: string
  installed: string
  latest: string
  update_available: boolean
}
const agentVersion = ref<AgentVersionInfo | null>(null)
const isUpdatingAgent = ref(false)

// Status dialog state
const isStatusDialogOpen = ref(false)
const selectedServiceForStatus = ref<Service | null>(null)

// Log sheet state
const logsByService = ref<Map<string, LogInfo>>(new Map())
const isLogSheetOpen = ref(false)
const selectedLog = ref<LogInfo | null>(null)

const fetchLogs = async () => {
  try {
    const data = await $api<{ data: LogInfo[] }>(`/servers/${props.serverId}/logs`)
    const map = new Map<string, LogInfo>()
    for (const log of data.data || []) {
      map.set(log.software, log)
    }
    logsByService.value = map
  } catch {
    // Silent fail - logs are optional
  }
}

const openLogSheet = (service: Service) => {
  const log = logsByService.value.get(service.software)
  if (log) {
    selectedLog.value = log
    isLogSheetOpen.value = true
  }
}

// PHP dialog states
const isExtensionsDialogOpen = ref(false)
const isOpcacheDialogOpen = ref(false)
const selectedPhpService = ref<any>(null)

const fetchPhpVersionData = async (service: Service): Promise<any | null> => {
  try {
    const response = await $api<any[] | { data: any[] }>(`/servers/${props.serverId}/php`)
    const phpVersions = Array.isArray(response) ? response : (response.data || [])
    return phpVersions.find((v: any) => v.details?.id === service.id) || null
  } catch {
    toast.error('Failed to load PHP data')
    return null
  }
}

const openExtensionsDialog = async (service: Service) => {
  const match = await fetchPhpVersionData(service)
  if (match) {
    selectedPhpService.value = match
    isExtensionsDialogOpen.value = true
  }
}

const openOpcacheDialog = async (service: Service) => {
  const match = await fetchPhpVersionData(service)
  if (match) {
    selectedPhpService.value = match
    isOpcacheDialogOpen.value = true
  }
}

const setPhpDefault = async (service: Service) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Set ${service.name} as default`,
    description: 'This will make this version the default CLI PHP version.',
    confirmText: 'Set Default',
    cancelText: 'Cancel',
  })

  if (!ok) return

  loadingAction.value = { software: service.software, action: 'default' }
  try {
    await $api(`/servers/${props.serverId}/php/${service.software}/default`, {
      method: 'POST',
    })
    toast.success('Default PHP version updated')
    fetchServices()
  } catch {
    toast.error('Failed to set default PHP version')
  } finally {
    loadingAction.value = null
  }
}

const patchPhpVersion = async (service: Service) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Patch ${service.name}`,
    description: 'This will update PHP to the latest patch version.',
    confirmText: 'Patch',
    cancelText: 'Cancel',
  })

  if (!ok) return

  loadingAction.value = { software: service.software, action: 'patch' }
  try {
    await $api(`/servers/${props.serverId}/php/${service.software}/patch`, {
      method: 'POST',
    })
    toast.success('PHP patch initiated')
    fetchServices()
  } catch {
    toast.error('Failed to patch PHP version')
  } finally {
    loadingAction.value = null
  }
}

const uninstallPhpVersion = async (service: Service) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Uninstall ${service.name}`,
    description: 'Are you sure? This will remove this PHP version and all its configurations.',
    confirmText: 'Uninstall',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (!ok) return

  loadingAction.value = { software: service.software, action: 'uninstall' }
  try {
    await $api(`/servers/${props.serverId}/services/${service.id}`, {
      method: 'POST',
      body: { operation: 'remove' },
    })
    toast.success('PHP version removal initiated')
    fetchServices()
  } catch {
    toast.error('Failed to uninstall PHP version')
  } finally {
    loadingAction.value = null
  }
}

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

// Listen for service broadcast events (install, remove, status changes)
const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

useServiceEvents(teamId, (data) => {
  const eventServerId = data.server_id
  if (eventServerId === props.serverId) {
    fetchServices()
  }
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

// Prefer the live-probed version (e.g. the real launch-agent version)
// over the stored value, which can be an install-time placeholder like
// "latest".
const displayVersion = (service: Service) => {
  return getLiveStatus(service.id)?.version || service.version
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
    // Docker / Traefik are keyed by their ServiceType string (not the
    // software name): container_runtime = Docker, reverse_proxy = Traefik.
    container_runtime: '/images/services/docker.svg',
    reverse_proxy: '/images/services/traefik.svg',
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

const fetchAgentVersion = async () => {
  try {
    const data = await $api<{ data: AgentVersionInfo }>(`/servers/${props.serverId}/agent-version`)
    agentVersion.value = data.data || null
  } catch {
    // Non-fatal: GitHub lookup unavailable or agent not installed —
    // the banner just doesn't render.
    agentVersion.value = null
  }
}

const updateAgent = async () => {
  const info = agentVersion.value
  if (!info?.service_id) return

  isUpdatingAgent.value = true
  try {
    await $api(`/servers/${props.serverId}/services/${info.service_id}/update`, {
      method: 'POST',
    })
    toast.success(`Updating Launch Agent to v${info.latest}…`)
    // The install runs over SSH; give it a moment, then refresh the
    // services list + re-check the version so the banner clears.
    setTimeout(() => {
      fetchServices()
      fetchAgentVersion()
    }, 4000)
  } catch {
    toast.error('Failed to start Launch Agent update')
  } finally {
    isUpdatingAgent.value = false
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
    case 'installing':
    case 'uninstalling':
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

onMounted(() => {
  fetchServices()
  fetchLogs()
  fetchAgentVersion()
})
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Launch Agent update banner -->
    <div
      v-if="agentVersion?.update_available"
      class="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800/60 dark:bg-amber-950/30"
    >
      <div class="flex items-start gap-2.5">
        <Icon name="lucide:arrow-up-circle" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div class="text-sm">
          <p class="font-medium text-amber-900 dark:text-amber-200">
            Launch Agent update available
          </p>
          <p class="text-amber-700 dark:text-amber-300/90">
            Version <span class="font-semibold">v{{ agentVersion.latest }}</span> is available<template v-if="agentVersion.installed">
              — this server runs <span class="font-semibold">v{{ agentVersion.installed }}</span></template>.
          </p>
        </div>
      </div>
      <Button size="sm" :disabled="isUpdatingAgent" class="shrink-0" @click="updateAgent">
        <Icon v-if="isUpdatingAgent" name="lucide:loader-2" class="mr-1.5 h-3.5 w-3.5 animate-spin" />
        <Icon v-else name="lucide:download" class="mr-1.5 h-3.5 w-3.5" />
        {{ isUpdatingAgent ? 'Updating…' : `Update to v${agentVersion.latest}` }}
      </Button>
    </div>

    <!-- Install Service Dialog -->
    <ServerSettingsInstallServiceDialog
      v-model:open="isInstallDialogOpen"
      :server-id="serverId"
      @installed="fetchServices"
    />

    <!-- PHP Extensions Dialog -->
    <ServerSettingsPhpExtensionsDialog
      v-if="selectedPhpService"
      v-model:open="isExtensionsDialogOpen"
      :server-id="serverId"
      :service="selectedPhpService"
      @updated="fetchServices"
    />

    <!-- PHP OPcache Dialog -->
    <ServerSettingsPhpOpcacheDialog
      v-if="selectedPhpService"
      v-model:open="isOpcacheDialogOpen"
      :server-id="serverId"
      :service="selectedPhpService"
      @updated="fetchServices"
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
        <Button v-if="!isLoadBalancer" @click="isInstallDialogOpen = true">
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
            <Button v-if="!isLoadBalancer" size="lg" @click="isInstallDialogOpen = true">
              <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
              Install Your First Service
            </Button>
          </div>

          <!-- Services Table -->
          <div v-else class="overflow-hidden rounded-lg border">
            <!-- Table Header -->
            <div class="hidden border-b bg-muted/50 px-6 py-3 md:grid md:grid-cols-12 md:gap-4">
              <div class="col-span-5 text-sm font-medium text-muted-foreground">Service</div>
              <div class="col-span-4 text-sm font-medium text-muted-foreground">Status</div>
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
                        <div class="flex items-center gap-1.5">
                          <span class="truncate font-medium">{{ service.name }}</span>
                          <TooltipProvider v-if="service.type === 'php' && service.is_default">
                            <Tooltip>
                              <TooltipTrigger>
                                <Icon name="lucide:star" class="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
                              </TooltipTrigger>
                              <TooltipContent>Default CLI version</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div class="font-mono text-xs text-muted-foreground">v{{ displayVersion(service) }}</div>
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
                          <DropdownMenuItem v-if="logsByService.has(service.software)" @click="openLogSheet(service)">
                            <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
                            View Logs
                          </DropdownMenuItem>
                          <template v-if="service.type === 'php'">
                            <DropdownMenuSeparator />
                            <DropdownMenuItem @click="openOpcacheDialog(service)">
                              <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                              OPcache
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="openExtensionsDialog(service)">
                              <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                              Extensions
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem v-if="!service.is_default" @click="setPhpDefault(service)">
                              <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                              Set as Default
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="patchPhpVersion(service)">
                              <Icon name="lucide:wrench" class="mr-2 h-4 w-4" />
                              Patch Version
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem class="text-destructive focus:text-destructive" @click="uninstallPhpVersion(service)">
                              <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                              Uninstall
                            </DropdownMenuItem>
                          </template>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Badge :variant="getStatusVariant(getDisplayStatus(service).status)" class="cursor-help">
                            {{ getDisplayStatus(service).label }}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent class="max-w-xs">
                          <div class="space-y-1.5 text-sm">
                            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span class="text-muted-foreground">Status:</span>
                              <span :class="getDisplayStatus(service).status === 'running' ? 'text-green-500' : 'text-red-500'">
                                {{ getDisplayStatus(service).label }}
                              </span>
                              <template v-if="getDisplayStatus(service).pid">
                                <span class="text-muted-foreground">PID:</span>
                                <span>{{ getDisplayStatus(service).pid }}</span>
                              </template>
                              <template v-if="getDisplayStatus(service).memory">
                                <span class="text-muted-foreground">Memory:</span>
                                <span>{{ getDisplayStatus(service).memory }}</span>
                              </template>
                              <template v-if="getDisplayStatus(service).uptime">
                                <span class="text-muted-foreground">Uptime:</span>
                                <span>{{ getDisplayStatus(service).uptime }}</span>
                              </template>
                              <span class="text-muted-foreground">Version:</span>
                              <span>{{ displayVersion(service) }}</span>
                            </div>
                            <p v-if="service.last_status_check" class="border-t pt-1.5 text-xs text-muted-foreground">
                              Last checked: {{ new Date(service.last_status_check).toLocaleTimeString() }}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <!-- Desktop Layout -->
                <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                  <div class="col-span-5 flex items-center gap-3">
                    <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                      <img
                        :src="getServiceImagePath(service)"
                        :alt="service.name"
                        class="h-6 w-6 object-contain"
                        @error="($event.target as HTMLImageElement).style.display = 'none'"
                      >
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="truncate font-medium">{{ service.name }}</span>
                        <TooltipProvider v-if="service.type === 'php' && service.is_default">
                          <Tooltip>
                            <TooltipTrigger>
                              <Icon name="lucide:star" class="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>Default CLI version</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div class="text-xs text-muted-foreground">v{{ displayVersion(service) }}</div>
                    </div>
                  </div>

                  <div class="col-span-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Badge :variant="getStatusVariant(getDisplayStatus(service).status)" class="cursor-help">
                            {{ getDisplayStatus(service).label }}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent class="max-w-xs">
                          <div class="space-y-1.5 text-sm">
                            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span class="text-muted-foreground">Status:</span>
                              <span :class="getDisplayStatus(service).status === 'running' ? 'text-green-500' : 'text-red-500'">
                                {{ getDisplayStatus(service).label }}
                              </span>
                              <template v-if="getDisplayStatus(service).pid">
                                <span class="text-muted-foreground">PID:</span>
                                <span>{{ getDisplayStatus(service).pid }}</span>
                              </template>
                              <template v-if="getDisplayStatus(service).memory">
                                <span class="text-muted-foreground">Memory:</span>
                                <span>{{ getDisplayStatus(service).memory }}</span>
                              </template>
                              <template v-if="getDisplayStatus(service).uptime">
                                <span class="text-muted-foreground">Uptime:</span>
                                <span>{{ getDisplayStatus(service).uptime }}</span>
                              </template>
                              <span class="text-muted-foreground">Version:</span>
                              <span>{{ displayVersion(service) }}</span>
                            </div>
                            <p v-if="service.last_status_check" class="border-t pt-1.5 text-xs text-muted-foreground">
                              Last checked: {{ new Date(service.last_status_check).toLocaleTimeString() }}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                        <DropdownMenuItem v-if="logsByService.has(service.software)" @click="openLogSheet(service)">
                          <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
                          View Logs
                        </DropdownMenuItem>
                        <template v-if="service.type === 'php'">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem @click="openOpcacheDialog(service)">
                            <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                            OPcache
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="openExtensionsDialog(service)">
                            <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                            Extensions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem v-if="!service.is_default" @click="setPhpDefault(service)">
                            <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                            Set as Default
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="patchPhpVersion(service)">
                            <Icon name="lucide:wrench" class="mr-2 h-4 w-4" />
                            Patch Version
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem class="text-destructive focus:text-destructive" @click="uninstallPhpVersion(service)">
                            <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                            Uninstall
                          </DropdownMenuItem>
                        </template>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

    <!-- Log Viewer Sheet -->
    <Sheet v-model:open="isLogSheetOpen">
      <SheetContent class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-5xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{{ selectedLog?.name || 'Logs' }}</SheetTitle>
          <SheetDescription>Service logs</SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex-1 min-h-0 flex flex-col">
          <ServerLogViewer
            v-if="isLogSheetOpen && selectedLog"
            :key="selectedLog.software"
            :server-id="serverId"
            entity="server"
            :entity-id="serverId"
            :software="selectedLog.software"
            :route="selectedLog.show_route"
            no-timestamp
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

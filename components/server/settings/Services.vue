<script setup lang="ts">
import { reactive, toRefs } from 'vue'
import { toast } from 'vue-sonner'
import { useIntervalFn } from '@vueuse/core'
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
import {
  hasPendingDefaultPhpChange,
  phpDefaultEndpoint,
  phpPatchErrorSummary,
  phpPatchEndpoint,
  updatingPhpServiceIds,
} from '~/utils/phpVersions'

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
  default_change_pending?: boolean
  can_remove?: boolean
  software: string
  software_label: string
  created_at: string
  updated_at: string
  last_status_check?: string
  status_details?: ServiceStatusDetails
  status_output?: string
  task_id?: string
  patch_status?: string
  patch_error?: string
  image_path?: string
}

interface Props {
  serverId: string
  serverType?: string
}

const props = defineProps<Props>()

const isLoadBalancer = computed(() => props.serverType === 'loadbalancer')

const confirmationDialog = ref<InstanceType<
  typeof import('~/components/shared/ConfirmationDialog.vue').default
> | null>(null)

interface AgentVersionInfo {
  service_id: string
  installed: string
  latest: string
  update_available: boolean
}
interface ServiceOperationEvent {
  server_id?: string
  service_id?: string
  operation?: string
  task_id?: string
  status?: string
  output?: string
  error?: string
  version?: string
}

interface TaskLogSelection {
  taskId: string
  title: string
  description: string
  error?: string
}

const AGENT_UPDATE_TTL_MS = 5 * 60 * 1000

interface ServicesState {
  services: Service[]
  isLoading: boolean
  loadingAction: { software: string; action: string } | null
  isInstallDialogOpen: boolean
  agentVersion: AgentVersionInfo | null
  isUpdatingAgent: boolean
  agentUpdateStartedAt: number | null
  agentUpdateTaskId: string | null
  isStatusDialogOpen: boolean
  selectedServiceForStatus: Service | null
  logsByService: Map<string, LogInfo>
  isLogSheetOpen: boolean
  selectedLog: LogInfo | null
  isTaskLogSheetOpen: boolean
  selectedTaskLog: TaskLogSelection | null
  isExtensionsDialogOpen: boolean
  isOpcacheDialogOpen: boolean
  selectedPhpService: any
  patchingServiceIds: Set<string>
  phpPatchLogsByService: Map<string, TaskLogSelection>
}

const state = reactive({
  services: [],
  isLoading: true,
  loadingAction: null,
  isInstallDialogOpen: false,
  agentVersion: null,
  isUpdatingAgent: false,
  agentUpdateStartedAt: null,
  agentUpdateTaskId: null,
  isStatusDialogOpen: false,
  selectedServiceForStatus: null,
  logsByService: new Map(),
  isLogSheetOpen: false,
  selectedLog: null,
  isTaskLogSheetOpen: false,
  selectedTaskLog: null,
  isExtensionsDialogOpen: false,
  isOpcacheDialogOpen: false,
  selectedPhpService: null,
  patchingServiceIds: new Set(),
  phpPatchLogsByService: new Map(),
}) as ServicesState

const {
  services,
  isLoading,
  loadingAction,
  isInstallDialogOpen,
  agentVersion,
  isUpdatingAgent,
  agentUpdateStartedAt,
  agentUpdateTaskId,
  isStatusDialogOpen,
  selectedServiceForStatus,
  logsByService,
  isLogSheetOpen,
  selectedLog,
  isTaskLogSheetOpen,
  selectedTaskLog,
  isExtensionsDialogOpen,
  isOpcacheDialogOpen,
  selectedPhpService,
  patchingServiceIds,
  phpPatchLogsByService,
} = toRefs(state)

const setPhpPatching = (serviceId: string, isPatching: boolean) => {
  const next = new Set(patchingServiceIds.value)
  if (isPatching) {
    next.add(serviceId)
  } else {
    next.delete(serviceId)
  }
  patchingServiceIds.value = next
}

const setPhpPatchLog = (
  serviceId: string,
  selection: TaskLogSelection | null,
) => {
  const next = new Map(phpPatchLogsByService.value)
  if (selection) {
    next.set(serviceId, selection)
  } else {
    next.delete(serviceId)
  }
  phpPatchLogsByService.value = next
}

const openTaskLog = (selection: TaskLogSelection) => {
  selectedTaskLog.value = selection
  isTaskLogSheetOpen.value = true
}

const openAgentUpdateLog = () => {
  if (!agentUpdateTaskId.value) return

  openTaskLog({
    taskId: agentUpdateTaskId.value,
    title: 'Launch Agent update log',
    description: 'Output from the update script running on this server.',
  })
}

const openPhpPatchLog = (serviceId: string) => {
  const selection = phpPatchLogsByService.value.get(serviceId)
  if (selection) openTaskLog(selection)
}

const isPhpPatching = (service: Service) =>
  service.type === 'php' &&
  (patchingServiceIds.value.has(service.id) || service.status === 'updating')

const isServiceActionPending = (service: Service) =>
  loadingAction.value?.software === service.software ||
  service.default_change_pending ||
  isPhpPatching(service)

const agentUpdateStorageKey = computed(
  () => `launch:agent-update:${props.serverId}`,
)
const readUpdateStarted = (): number | null => {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(agentUpdateStorageKey.value)
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  if (Date.now() - n > AGENT_UPDATE_TTL_MS) {
    window.localStorage.removeItem(agentUpdateStorageKey.value)
    return null
  }
  return n
}

const writeUpdateStarted = (ts: number | null) => {
  agentUpdateStartedAt.value = ts
  if (typeof window === 'undefined') return
  if (ts === null) {
    window.localStorage.removeItem(agentUpdateStorageKey.value)
  } else {
    window.localStorage.setItem(agentUpdateStorageKey.value, String(ts))
  }
}

const agentUpdateInProgress = computed(() => {
  if (!agentUpdateStartedAt.value) return false
  if (Date.now() - agentUpdateStartedAt.value > AGENT_UPDATE_TTL_MS)
    return false
  const v = agentVersion.value
  if (!v) return true
  if (v.update_available === false) return false
  if (v.installed && v.latest && v.installed === v.latest) return false
  return true
})

let agentPollTimer: ReturnType<typeof setInterval> | null = null
const stopAgentPoll = () => {
  if (agentPollTimer) {
    clearInterval(agentPollTimer)
    agentPollTimer = null
  }
}
const startAgentPoll = () => {
  stopAgentPoll()
  agentPollTimer = setInterval(() => {
    fetchAgentVersion()
    if (!agentUpdateInProgress.value) {
      stopAgentPoll()
    }
  }, 5000)
}

const fetchLogs = async () => {
  try {
    const data = await $api<{ data: LogInfo[] }>(
      `/servers/${props.serverId}/logs`,
    )
    const map = new Map<string, LogInfo>()
    for (const log of data.data || []) {
      map.set(log.software, log)
    }
    logsByService.value = map
  } catch {}
}

const openLogSheet = (service: Service) => {
  const log = logsByService.value.get(service.software)
  if (log) {
    selectedLog.value = log
    isLogSheetOpen.value = true
  }
}

const fetchPhpVersionData = async (service: Service): Promise<any | null> => {
  try {
    const response = await $api<any[] | { data: any[] }>(
      `/servers/${props.serverId}/php`,
    )
    const phpVersions = Array.isArray(response) ? response : response.data || []
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
    await $api(phpDefaultEndpoint(props.serverId, service.id), {
      method: 'POST',
    })
    service.default_change_pending = true
    toast.success('Default PHP version update queued')
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
    await $api(phpPatchEndpoint(props.serverId, service.id), {
      method: 'POST',
    })
    setPhpPatching(service.id, true)
    toast.success(`${service.name} patch queued`)
    await fetchServices()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || `Failed to patch ${service.name}`)
  } finally {
    loadingAction.value = null
  }
}

const uninstallService = async (service: Service) => {
  if (!confirmationDialog.value) return

  const { ok } = await confirmationDialog.value.show({
    title: `Uninstall ${service.name}`,
    description:
      'Are you sure? This will remove the service and its configuration from the server.',
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
    toast.success(`${service.name} removal initiated`)
    fetchServices()
  } catch {
    toast.error(`Failed to uninstall ${service.name}`)
  } finally {
    loadingAction.value = null
  }
}

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

const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

useServiceEvents(teamId, (data, eventName) => {
  const event = data as ServiceOperationEvent
  const eventServerId = event.server_id
  if (eventServerId === props.serverId) {
    if (eventName === 'php.patch' && event.service_id) {
      const isPatching =
        event.status === 'queued' ||
        event.status === 'running' ||
        event.status === 'updating'
      setPhpPatching(event.service_id, isPatching)
      const phpLabel = event.version ? `PHP ${event.version}` : 'PHP'
      const error = phpPatchErrorSummary(event.output)

      if (event.status === 'queued') {
        setPhpPatchLog(event.service_id, null)
      } else {
        const taskId =
          event.task_id ||
          phpPatchLogsByService.value.get(event.service_id)?.taskId
        if (taskId) {
          setPhpPatchLog(event.service_id, {
            taskId,
            title: `${phpLabel} patch log`,
            description:
              'Output from the PHP patch task running on this server.',
            error: event.status === 'failed' ? error || undefined : undefined,
          })
        }
      }

      if (event.status === 'finished') {
        setPhpPatchLog(event.service_id, null)
        toast.success(`${phpLabel} patched successfully`)
      } else if (event.status === 'failed') {
        const patchLog = phpPatchLogsByService.value.get(event.service_id)
        if (patchLog) openTaskLog(patchLog)
        toast.error(
          error
            ? `${phpLabel} patch failed: ${error}`
            : `${phpLabel} patch failed`,
        )
      }
    }
    if (eventName === 'php.default_change') {
      const phpLabel = event.version ? `PHP ${event.version}` : 'PHP'
      if (event.status === 'finished') {
        toast.success(`${phpLabel} is now the default`)
      } else if (event.status === 'failed') {
        const error = phpPatchErrorSummary(event.error || event.output)
        toast.error(
          error
            ? `Default PHP update failed: ${error}`
            : 'Default PHP update failed',
        )
      }
    }
    if (event.operation === 'update' && event.task_id) {
      agentUpdateTaskId.value = event.task_id
    }
    if (event.operation === 'update' && event.status === 'failed') {
      writeUpdateStarted(null)
      stopAgentPoll()
      toast.error(
        'Launch Agent update failed. Open the update log for details.',
      )
      const taskId = event.task_id || agentUpdateTaskId.value
      if (taskId) {
        openTaskLog({
          taskId,
          title: 'Launch Agent update log',
          description: 'Output from the update script running on this server.',
          error: phpPatchErrorSummary(event.output) || undefined,
        })
      }
    }
    fetchServices()
  }
})

const getLiveStatus = (serviceId: string) => {
  return liveStatuses.value.find((s) => s.id === serviceId)
}

const STATUS_FRESHNESS_MS = 5 * 60 * 1000
const isPersistedStatusFresh = (service: Service): boolean => {
  if (!service.last_status_check) return false
  const checkedAt = Date.parse(service.last_status_check)
  if (Number.isNaN(checkedAt)) return false
  return Date.now() - checkedAt < STATUS_FRESHNESS_MS
}

const getDisplayStatus = (service: Service) => {
  if (isPhpPatching(service)) {
    return {
      status: 'updating',
      label: 'Patching',
      memory: undefined,
      uptime: undefined,
      pid: undefined,
      isLive: false,
    }
  }
  if (service.type === 'php' && service.status === 'failed') {
    return {
      status: 'failed',
      label: service.status_label || 'Failed',
      memory: undefined,
      uptime: undefined,
      pid: undefined,
      isLive: false,
    }
  }
  if (service.software === 'launch_agent' && agentUpdateInProgress.value) {
    return {
      status: 'updating',
      label: 'Updating',
      memory: undefined,
      uptime: undefined,
      pid: undefined,
      isLive: false,
    }
  }
  const live = getLiveStatus(service.id)
  if (live) {
    return {
      status: live.status,
      label: live.status === 'missing'
        ? 'Not Installed'
        : live.status.charAt(0).toUpperCase() + live.status.slice(1),
      memory: live.memory,
      uptime: live.uptime,
      pid: live.pid,
      isLive: true,
    }
  }
  if (!isPersistedStatusFresh(service)) {
    return {
      status: 'checking',
      label: 'Checking…',
      memory: undefined,
      uptime: undefined,
      pid: undefined,
      isLive: false,
    }
  }
  return {
    status: service.status,
    label: service.status_label,
    memory: service.status_details?.memory_usage,
    uptime: undefined,
    pid: service.status_details?.pid
      ? Number(service.status_details.pid)
      : undefined,
    isLive: false,
  }
}

const displayVersion = (service: Service) => {
  return getLiveStatus(service.id)?.version || service.version
}

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

let servicesFetchSequence = 0
let isServicePollInFlight = false

const loadServices = async (showError: boolean) => {
  const sequence = ++servicesFetchSequence
  try {
    const data = await $api<{ data: Service[] }>(
      `/servers/${props.serverId}/services`,
    )
    if (sequence !== servicesFetchSequence) return

    services.value = data.data || []
    patchingServiceIds.value = updatingPhpServiceIds(services.value)

    const persistedLogs = new Map(phpPatchLogsByService.value)
    for (const service of services.value) {
      if (
        service.type !== 'php' ||
        !service.task_id ||
        !service.patch_status ||
        (service.status === 'updating' && service.patch_status !== 'running')
      ) {
        continue
      }
      persistedLogs.set(service.id, {
        taskId: service.task_id,
        title: `${service.name} patch log`,
        description: 'Output from the PHP patch task on this server.',
        error:
          service.patch_status === 'failed'
            ? phpPatchErrorSummary(service.patch_error) || undefined
            : undefined,
      })
    }
    phpPatchLogsByService.value = persistedLogs
  } catch {
    if (showError) toast.error('Failed to load services')
  } finally {
    if (sequence === servicesFetchSequence) {
      isLoading.value = false
    }
  }
}

const fetchServices = () => loadServices(true)
const pollPhpOperations = async () => {
  if (isServicePollInFlight) return

  isServicePollInFlight = true
  try {
    await loadServices(false)
  } finally {
    isServicePollInFlight = false
  }
}

const fetchAgentVersion = async () => {
  try {
    const data = await $api<{ data: AgentVersionInfo }>(
      `/servers/${props.serverId}/agent-version`,
    )
    agentVersion.value = data.data || null
  } catch {
    agentVersion.value = null
  }
}

const updateAgent = async () => {
  const info = agentVersion.value
  if (!info?.service_id) return

  isUpdatingAgent.value = true
  try {
    await $api(
      `/servers/${props.serverId}/services/${info.service_id}/update`,
      {
        method: 'POST',
      },
    )
    toast.success(`Updating Launch Agent to v${info.latest}…`)
    agentUpdateTaskId.value = null
    writeUpdateStarted(Date.now())
    fetchServices()
    fetchAgentVersion()
    startAgentPoll()
  } catch {
    toast.error('Failed to start Launch Agent update')
  } finally {
    isUpdatingAgent.value = false
  }
}

const serviceAction = async (
  service: Service,
  action: 'start' | 'stop' | 'restart' | 'update',
) => {
  if (!confirmationDialog.value) return

  const actionLabels: Record<string, string> = {
    start: 'Start',
    stop: 'Stop',
    restart: 'Restart',
    update: 'Update',
  }
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
    if (action === 'update' && service.software === 'launch_agent') {
      agentUpdateTaskId.value = null
      writeUpdateStarted(Date.now())
      fetchAgentVersion()
      startAgentPoll()
    }
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

const getStatusVariant = (
  status?: string,
): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' => {
  if (!status) return 'secondary'
  switch (status.toLowerCase()) {
    case 'running':
      return 'success'
    case 'stopped':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'unknown':
    case 'missing':
      return 'warning'
    case 'pending':
    case 'installing':
    case 'uninstalling':
    case 'updating':
      return 'warning'
    case 'checking':
      return 'secondary'
    case 'installed':
      return 'default'
    default:
      return 'secondary'
  }
}

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
  [...services.value].sort((a, b) => a.name.localeCompare(b.name)),
)

const hasPendingPhpOperation = computed(
  () =>
    patchingServiceIds.value.size > 0 ||
    hasPendingDefaultPhpChange(services.value),
)

const { pause: pausePhpPatchPolling, resume: resumePhpPatchPolling } =
  useIntervalFn(pollPhpOperations, 5000, { immediate: false })

watch(
  hasPendingPhpOperation,
  (hasPendingOperation) => {
    if (hasPendingOperation) {
      resumePhpPatchPolling()
    } else {
      pausePhpPatchPolling()
    }
  },
  { immediate: true },
)

onMounted(() => {
  fetchServices()
  fetchLogs()
  fetchAgentVersion()
  const persisted = readUpdateStarted()
  if (persisted) {
    agentUpdateStartedAt.value = persisted
    startAgentPoll()
  }
})

watch(agentUpdateInProgress, (inProgress) => {
  if (!inProgress && agentUpdateStartedAt.value !== null) {
    writeUpdateStarted(null)
    stopAgentPoll()
    toast.success('Launch Agent updated')
  }
})

onBeforeUnmount(() => {
  stopAgentPoll()
  pausePhpPatchPolling()
})
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div
      v-if="agentUpdateInProgress"
      class="flex flex-col gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-blue-800/60 dark:bg-blue-950/30"
    >
      <div class="flex items-start gap-2.5">
        <Icon
          name="lucide:loader-2"
          class="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400"
        />
        <div class="text-sm">
          <p class="font-medium text-blue-900 dark:text-blue-200">
            Updating Launch Agent<template v-if="agentVersion?.latest">
              to
              <span class="font-semibold"
                >v{{ agentVersion.latest }}</span
              ></template
            >…
          </p>
          <p class="text-blue-700 dark:text-blue-300/90">
            The install script is running on this server. The status will
            refresh automatically.
          </p>
          <Button
            v-if="agentUpdateTaskId"
            variant="link"
            size="sm"
            class="mt-1 h-auto px-0 text-blue-800 dark:text-blue-200"
            @click="openAgentUpdateLog"
          >
            View update log
          </Button>
        </div>
      </div>
    </div>
    <div
      v-else-if="agentVersion?.update_available"
      class="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800/60 dark:bg-amber-950/30"
    >
      <div class="flex items-start gap-2.5">
        <Icon
          name="lucide:arrow-up-circle"
          class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div class="text-sm">
          <p class="font-medium text-amber-900 dark:text-amber-200">
            Launch Agent update available
          </p>
          <p class="text-amber-700 dark:text-amber-300/90">
            Version
            <span class="font-semibold">v{{ agentVersion.latest }}</span> is
            available<template v-if="agentVersion.installed">
              — this server runs
              <span class="font-semibold"
                >v{{ agentVersion.installed }}</span
              ></template
            >.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        :disabled="isUpdatingAgent"
        class="shrink-0"
        @click="updateAgent"
      >
        <Icon
          v-if="isUpdatingAgent"
          name="lucide:loader-2"
          class="mr-1.5 h-3.5 w-3.5 animate-spin"
        />
        <Icon v-else name="lucide:download" class="mr-1.5 h-3.5 w-3.5" />
        {{
          isUpdatingAgent ? 'Updating…' : `Update to v${agentVersion.latest}`
        }}
      </Button>
    </div>

    <ServerSettingsInstallServiceDialog
      v-model:open="isInstallDialogOpen"
      :server-id="serverId"
      @installed="fetchServices"
    />

    <ServerSettingsPhpExtensionsDialog
      v-if="selectedPhpService"
      v-model:open="isExtensionsDialogOpen"
      :server-id="serverId"
      :service="selectedPhpService"
      @updated="fetchServices"
    />

    <ServerSettingsPhpOpcacheDialog
      v-if="selectedPhpService"
      v-model:open="isOpcacheDialogOpen"
      :server-id="serverId"
      :service="selectedPhpService"
      @updated="fetchServices"
    />

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
                  {{
                    wsConnected
                      ? 'Live'
                      : wsConnecting
                        ? 'Connecting'
                        : 'Disconnected'
                  }}
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
          {{ services.length }} service{{ services.length !== 1 ? 's' : '' }}
          installed
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
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div
          v-if="services.length === 0"
          class="flex flex-col items-center justify-center py-16 text-center"
        >
          <div
            class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted"
          >
            <Icon name="lucide:package" class="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 class="mb-2 text-xl font-semibold">No services installed</h2>
          <p class="mb-8 max-w-md text-muted-foreground">
            Services like databases, caching systems, and runtimes help power
            your applications.
          </p>
          <Button
            v-if="!isLoadBalancer"
            size="lg"
            @click="isInstallDialogOpen = true"
          >
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            Install Your First Service
          </Button>
        </div>

        <div v-else class="overflow-hidden rounded-lg border">
          <div
            class="hidden border-b bg-muted/50 px-6 py-3 md:grid md:grid-cols-12 md:gap-4"
          >
            <div class="col-span-5 text-sm font-medium text-muted-foreground">
              Service
            </div>
            <div class="col-span-4 text-sm font-medium text-muted-foreground">
              Status
            </div>
            <div
              class="col-span-3 text-right text-sm font-medium text-muted-foreground"
            >
              Actions
            </div>
          </div>

          <div class="divide-y">
            <div
              v-for="service in sortedServices"
              :key="service.id"
              class="px-4 py-4 transition-colors hover:bg-muted/30 md:px-6"
            >
              <div class="flex flex-col gap-3 md:hidden">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted"
                    >
                      <img
                        :src="getServiceImagePath(service)"
                        :alt="service.name"
                        class="h-6 w-6 object-contain"
                        @error="
                          ($event.target as HTMLImageElement).style.display =
                            'none'
                        "
                      />
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="truncate font-medium">{{
                          service.name
                        }}</span>
                        <TooltipProvider
                          v-if="service.type === 'php' && service.is_default"
                        >
                          <Tooltip>
                            <TooltipTrigger>
                              <Icon
                                name="lucide:star"
                                class="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500"
                              />
                            </TooltipTrigger>
                            <TooltipContent>Default CLI version</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div class="font-mono text-xs text-muted-foreground">
                        v{{ displayVersion(service) }}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon
                      v-if="isServiceActionPending(service)"
                      name="lucide:loader-2"
                      class="h-4 w-4 animate-spin text-muted-foreground"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button
                          variant="ghost"
                          size="sm"
                          :disabled="isServiceActionPending(service)"
                        >
                          <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" class="w-48">
                        <DropdownMenuItem
                          v-if="canStart(service)"
                          @click="serviceAction(service, 'start')"
                        >
                          <Icon name="lucide:play" class="mr-2 h-4 w-4" />
                          Start
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="canStop(service)"
                          @click="serviceAction(service, 'stop')"
                        >
                          <Icon name="lucide:power" class="mr-2 h-4 w-4" />
                          Stop
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="canRestart(service)"
                          @click="serviceAction(service, 'restart')"
                        >
                          <Icon name="lucide:rotate-ccw" class="mr-2 h-4 w-4" />
                          Restart
                        </DropdownMenuItem>
                        <DropdownMenuSeparator
                          v-if="
                            canStart(service) ||
                            canStop(service) ||
                            canRestart(service)
                          "
                        />
                        <DropdownMenuItem @click="openStatusDialog(service)">
                          <Icon name="lucide:activity" class="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="service.software === 'launch_agent'"
                          @click="serviceAction(service, 'update')"
                        >
                          <Icon name="lucide:download" class="mr-2 h-4 w-4" />
                          Update Agent
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="logsByService.has(service.software)"
                          @click="openLogSheet(service)"
                        >
                          <Icon
                            name="lucide:scroll-text"
                            class="mr-2 h-4 w-4"
                          />
                          View Logs
                        </DropdownMenuItem>
                        <template v-if="service.type === 'php'">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem @click="openOpcacheDialog(service)">
                            <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                            OPcache
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            @click="openExtensionsDialog(service)"
                          >
                            <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                            Extensions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            v-if="!service.is_default"
                            @click="setPhpDefault(service)"
                          >
                            <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                            Set as Default
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            :disabled="isPhpPatching(service)"
                            @click="patchPhpVersion(service)"
                          >
                            <Icon
                              :name="
                                isPhpPatching(service)
                                  ? 'lucide:loader-2'
                                  : 'lucide:wrench'
                              "
                              class="mr-2 h-4 w-4"
                              :class="isPhpPatching(service) && 'animate-spin'"
                            />
                            {{
                              isPhpPatching(service)
                                ? 'Patching…'
                                : 'Patch Version'
                            }}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="phpPatchLogsByService.has(service.id)"
                            @click="openPhpPatchLog(service.id)"
                          >
                            <Icon
                              name="lucide:scroll-text"
                              class="mr-2 h-4 w-4"
                            />
                            View Patch Log
                          </DropdownMenuItem>
                        </template>
                        <template v-if="service.can_remove">
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            class="text-destructive focus:text-destructive"
                            @click="uninstallService(service)"
                          >
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
                        <Badge
                          :variant="
                            getStatusVariant(getDisplayStatus(service).status)
                          "
                          class="cursor-help"
                        >
                          {{ getDisplayStatus(service).label }}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-xs">
                        <div class="space-y-1.5 text-sm">
                          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span class="text-muted-foreground">Status:</span>
                            <span
                              :class="
                                getDisplayStatus(service).status === 'running'
                                  ? 'text-green-500'
                                  : 'text-red-500'
                              "
                            >
                              {{ getDisplayStatus(service).label }}
                            </span>
                            <template v-if="getDisplayStatus(service).pid">
                              <span class="text-muted-foreground">PID:</span>
                              <span>{{ getDisplayStatus(service).pid }}</span>
                            </template>
                            <template v-if="getDisplayStatus(service).memory">
                              <span class="text-muted-foreground">Memory:</span>
                              <span>{{
                                getDisplayStatus(service).memory
                              }}</span>
                            </template>
                            <template v-if="getDisplayStatus(service).uptime">
                              <span class="text-muted-foreground">Uptime:</span>
                              <span>{{
                                getDisplayStatus(service).uptime
                              }}</span>
                            </template>
                            <span class="text-muted-foreground">Version:</span>
                            <span>{{ displayVersion(service) }}</span>
                          </div>
                          <p
                            v-if="service.last_status_check"
                            class="border-t pt-1.5 text-xs text-muted-foreground"
                          >
                            Last checked:
                            {{
                              new Date(
                                service.last_status_check,
                              ).toLocaleTimeString()
                            }}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div class="hidden items-center gap-4 md:grid md:grid-cols-12">
                <div class="col-span-5 flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted"
                  >
                    <img
                      :src="getServiceImagePath(service)"
                      :alt="service.name"
                      class="h-6 w-6 object-contain"
                      @error="
                        ($event.target as HTMLImageElement).style.display =
                          'none'
                      "
                    />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="truncate font-medium">{{
                        service.name
                      }}</span>
                      <TooltipProvider
                        v-if="service.type === 'php' && service.is_default"
                      >
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon
                              name="lucide:star"
                              class="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500"
                            />
                          </TooltipTrigger>
                          <TooltipContent>Default CLI version</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div class="text-xs text-muted-foreground">
                      v{{ displayVersion(service) }}
                    </div>
                  </div>
                </div>

                <div class="col-span-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Badge
                          :variant="
                            getStatusVariant(getDisplayStatus(service).status)
                          "
                          class="cursor-help"
                        >
                          {{ getDisplayStatus(service).label }}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-xs">
                        <div class="space-y-1.5 text-sm">
                          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <span class="text-muted-foreground">Status:</span>
                            <span
                              :class="
                                getDisplayStatus(service).status === 'running'
                                  ? 'text-green-500'
                                  : 'text-red-500'
                              "
                            >
                              {{ getDisplayStatus(service).label }}
                            </span>
                            <template v-if="getDisplayStatus(service).pid">
                              <span class="text-muted-foreground">PID:</span>
                              <span>{{ getDisplayStatus(service).pid }}</span>
                            </template>
                            <template v-if="getDisplayStatus(service).memory">
                              <span class="text-muted-foreground">Memory:</span>
                              <span>{{
                                getDisplayStatus(service).memory
                              }}</span>
                            </template>
                            <template v-if="getDisplayStatus(service).uptime">
                              <span class="text-muted-foreground">Uptime:</span>
                              <span>{{
                                getDisplayStatus(service).uptime
                              }}</span>
                            </template>
                            <span class="text-muted-foreground">Version:</span>
                            <span>{{ displayVersion(service) }}</span>
                          </div>
                          <p
                            v-if="service.last_status_check"
                            class="border-t pt-1.5 text-xs text-muted-foreground"
                          >
                            Last checked:
                            {{
                              new Date(
                                service.last_status_check,
                              ).toLocaleTimeString()
                            }}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div class="col-span-3 flex items-center justify-end gap-2">
                  <Icon
                    v-if="isServiceActionPending(service)"
                    name="lucide:loader-2"
                    class="h-4 w-4 animate-spin text-muted-foreground"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        size="sm"
                        :disabled="isServiceActionPending(service)"
                      >
                        <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                      <DropdownMenuItem
                        v-if="canStart(service)"
                        @click="serviceAction(service, 'start')"
                      >
                        <Icon name="lucide:play" class="mr-2 h-4 w-4" />
                        Start
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="canStop(service)"
                        @click="serviceAction(service, 'stop')"
                      >
                        <Icon name="lucide:power" class="mr-2 h-4 w-4" />
                        Stop
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="canRestart(service)"
                        @click="serviceAction(service, 'restart')"
                      >
                        <Icon name="lucide:rotate-ccw" class="mr-2 h-4 w-4" />
                        Restart
                      </DropdownMenuItem>
                      <DropdownMenuSeparator
                        v-if="
                          canStart(service) ||
                          canStop(service) ||
                          canRestart(service)
                        "
                      />
                      <DropdownMenuItem @click="openStatusDialog(service)">
                        <Icon name="lucide:activity" class="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        v-if="logsByService.has(service.software)"
                        @click="openLogSheet(service)"
                      >
                        <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
                        View Logs
                      </DropdownMenuItem>
                      <template v-if="service.type === 'php'">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem @click="openOpcacheDialog(service)">
                          <Icon name="lucide:zap" class="mr-2 h-4 w-4" />
                          OPcache
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          @click="openExtensionsDialog(service)"
                        >
                          <Icon name="lucide:package" class="mr-2 h-4 w-4" />
                          Extensions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          v-if="!service.is_default"
                          @click="setPhpDefault(service)"
                        >
                          <Icon name="lucide:star" class="mr-2 h-4 w-4" />
                          Set as Default
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          :disabled="isPhpPatching(service)"
                          @click="patchPhpVersion(service)"
                        >
                          <Icon
                            :name="
                              isPhpPatching(service)
                                ? 'lucide:loader-2'
                                : 'lucide:wrench'
                            "
                            class="mr-2 h-4 w-4"
                            :class="isPhpPatching(service) && 'animate-spin'"
                          />
                          {{
                            isPhpPatching(service)
                              ? 'Patching…'
                              : 'Patch Version'
                          }}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="phpPatchLogsByService.has(service.id)"
                          @click="openPhpPatchLog(service.id)"
                        >
                          <Icon
                            name="lucide:scroll-text"
                            class="mr-2 h-4 w-4"
                          />
                          View Patch Log
                        </DropdownMenuItem>
                      </template>
                      <template v-if="service.can_remove">
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          class="text-destructive focus:text-destructive"
                          @click="uninstallService(service)"
                        >
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

    <Sheet v-model:open="isLogSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-5xl flex flex-col"
      >
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

    <Sheet v-model:open="isTaskLogSheetOpen">
      <SheetContent
        class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-5xl flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>{{ selectedTaskLog?.title || 'Task log' }}</SheetTitle>
          <SheetDescription>
            {{
              selectedTaskLog?.description ||
              'Output from the task running on this server.'
            }}
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex-1 min-h-0 flex flex-col">
          <div
            v-if="selectedTaskLog?.error"
            class="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {{ selectedTaskLog.error }}
          </div>
          <ServerLogViewer
            v-if="isTaskLogSheetOpen && selectedTaskLog"
            :key="selectedTaskLog.taskId"
            :server-id="serverId"
            entity="task"
            :entity-id="selectedTaskLog.taskId"
            no-timestamp
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

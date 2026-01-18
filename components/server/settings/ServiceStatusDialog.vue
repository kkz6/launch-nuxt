<script setup lang="ts">
import { Badge } from '~/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Separator } from '~/components/ui/separator'

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

interface LiveStatus {
  status: string
  memory?: string
  uptime?: string
  pid?: number
}

interface Props {
  service: Service
  getImagePath: (service: Service) => string
  liveStatus?: LiveStatus | null
  lastUpdated?: Date | null
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'running':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
    case 'stopped':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
    case 'installed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-800'
  }
}

const getStatusIconName = (status?: string) => {
  switch (status) {
    case 'running':
      return 'lucide:play'
    case 'stopped':
      return 'lucide:server'
    case 'failed':
      return 'lucide:zap'
    case 'pending':
      return 'lucide:loader-2'
    default:
      return 'lucide:activity'
  }
}

const formatRelativeTime = (date?: Date | null) => {
  if (!date) return 'Never'
  try {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)

    if (diffSecs < 5) return 'Just now'
    if (diffSecs < 60) return `${diffSecs} seconds ago`
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  } catch {
    return 'Unknown'
  }
}

// Get display values preferring live data
const displayStatus = computed(() => props.liveStatus?.status || props.service.status)
const displayStatusLabel = computed(() => {
  const status = displayStatus.value
  return status.charAt(0).toUpperCase() + status.slice(1)
})
const displayMemory = computed(() => props.liveStatus?.memory || props.service.status_details?.memory_usage)
const displayUptime = computed(() => props.liveStatus?.uptime)
const displayPid = computed(() => props.liveStatus?.pid || (props.service.status_details?.pid ? Number(props.service.status_details.pid) : undefined))

const statusDetails = computed(() => props.service.status_details)

// Filter out empty values from additional_info
const filteredAdditionalInfo = computed(() => {
  if (!statusDetails.value?.additional_info) return null
  const filtered = Object.entries(statusDetails.value.additional_info)
    .filter(([_, value]) => value && String(value).trim() !== '')
  return filtered.length > 0 ? Object.fromEntries(filtered) : null
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader class="border-b border-border p-4 pb-3">
        <div class="flex w-full items-center justify-between">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div class="relative flex-shrink-0">
              <img
                :src="getImagePath(service)"
                class="size-10 object-contain"
                :alt="service.name"
              >
              <div class="absolute -bottom-1 -right-1">
                <Icon
                  :name="getStatusIconName(displayStatus)"
                  :class="[
                    'h-4 w-4',
                    displayStatus === 'running' && 'text-green-600 dark:text-green-500',
                    displayStatus === 'stopped' && 'text-red-600 dark:text-red-500',
                    displayStatus === 'failed' && 'text-red-600 dark:text-red-500',
                    displayStatus === 'pending' && 'animate-spin text-yellow-600 dark:text-yellow-500',
                    !['running', 'stopped', 'failed', 'pending'].includes(displayStatus) && 'text-muted-foreground',
                  ]"
                />
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <DialogTitle class="flex items-center gap-2 truncate text-xl font-semibold text-foreground">
                {{ service.name }}
                <Badge
                  :class="[
                    'flex-shrink-0 border text-xs font-medium hover:bg-transparent hover:opacity-100',
                    getStatusColor(displayStatus),
                  ]"
                >
                  {{ displayStatusLabel }}
                </Badge>
              </DialogTitle>
              <DialogDescription class="truncate text-sm text-muted-foreground">
                Service status and runtime information
              </DialogDescription>
            </div>
          </div>
        </div>
      </DialogHeader>

      <ScrollArea class="max-h-[60vh] w-full flex-1 overflow-y-auto px-4 py-4">
        <div class="w-full space-y-4">
          <!-- Service Overview -->
          <div class="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
            <!-- Last Updated (Live) -->
            <div class="w-full rounded-lg border border-border bg-muted/50 p-3">
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:clock" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span class="text-sm font-medium text-muted-foreground">Last Updated</span>
                <span v-if="liveStatus" class="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <p class="break-words text-base font-semibold text-foreground">
                {{ formatRelativeTime(lastUpdated) }}
              </p>
            </div>

            <!-- No status data message -->
            <div
              v-if="!statusDetails && !service.status_output && !liveStatus"
              class="col-span-2 w-full rounded-lg border border-border bg-muted/50 p-3"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:activity" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span class="text-sm font-medium text-muted-foreground">Status Information</span>
              </div>
              <p class="break-words text-sm text-muted-foreground">
                Waiting for status information...
              </p>
            </div>

            <!-- Process ID -->
            <div
              v-if="displayPid"
              class="w-full rounded-lg border border-border bg-muted/50 p-3"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:cpu" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span class="text-sm font-medium text-muted-foreground">Process ID</span>
              </div>
              <p class="break-words text-base font-semibold text-foreground">
                {{ displayPid }}
              </p>
            </div>

            <!-- Memory Usage -->
            <div
              v-if="displayMemory"
              class="w-full rounded-lg border border-border bg-muted/50 p-3"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:memory-stick" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span class="text-sm font-medium text-muted-foreground">Memory Usage</span>
              </div>
              <p class="break-words text-base font-semibold text-foreground">
                {{ displayMemory }}
              </p>
            </div>

            <!-- Uptime -->
            <div
              v-if="displayUptime"
              class="w-full rounded-lg border border-border bg-muted/50 p-3"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:timer" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span class="text-sm font-medium text-muted-foreground">Uptime</span>
              </div>
              <p class="break-words text-base font-semibold text-foreground">
                {{ displayUptime }}
              </p>
            </div>
          </div>

          <!-- Started At -->
          <div
            v-if="statusDetails?.started_at"
            class="w-full rounded-lg border border-border bg-muted/50 p-3"
          >
            <div class="mb-1 flex items-center gap-2">
              <Icon name="lucide:play" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span class="text-sm font-medium text-muted-foreground">Started At</span>
            </div>
            <p class="break-words text-sm text-foreground">
              {{ statusDetails.started_at }}
            </p>
          </div>

          <!-- Running Processes -->
          <div v-if="statusDetails?.processes && statusDetails.processes.length > 0" class="w-full">
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:server" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <h3 class="text-base font-semibold text-foreground">Running Processes</h3>
            </div>
            <div class="w-full space-y-1">
              <div
                v-for="(process, index) in statusDetails.processes"
                :key="index"
                class="w-full overflow-hidden break-all rounded-md border border-border bg-muted p-2 font-mono text-xs text-foreground"
              >
                {{ process }}
              </div>
            </div>
          </div>

          <!-- Network Connections -->
          <div v-if="statusDetails?.connections && statusDetails.connections.length > 0" class="w-full">
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:network" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <h3 class="text-base font-semibold text-foreground">Network Connections</h3>
            </div>
            <div class="w-full space-y-1">
              <div
                v-for="(connection, index) in statusDetails.connections"
                :key="index"
                class="w-full overflow-hidden break-all rounded-md border border-border bg-muted p-2 font-mono text-xs text-foreground"
              >
                {{ connection }}
              </div>
            </div>
          </div>

          <!-- Additional Service Information -->
          <div
            v-if="filteredAdditionalInfo"
            class="w-full"
          >
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:database" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <h3 class="text-base font-semibold text-foreground">Service Details</h3>
            </div>
            <div class="w-full space-y-3">
              <div v-for="(value, key) in filteredAdditionalInfo" :key="key" class="w-full">
                <h4 class="mb-1 text-sm font-medium capitalize text-muted-foreground">
                  {{ String(key).replace('_', ' ') }}
                </h4>
                <div class="w-full overflow-hidden whitespace-pre-wrap break-all rounded-md border border-border bg-muted p-2 font-mono text-xs text-foreground">
                  {{ value }}
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Output -->
          <div v-if="service.status_output" class="w-full">
            <Separator class="my-4" />
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:hard-drive" class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <h3 class="text-base font-semibold text-foreground">Raw System Output</h3>
            </div>
            <ScrollArea class="h-48 w-full rounded-md border border-border">
              <div class="whitespace-pre-wrap break-all bg-muted p-3 font-mono text-xs text-foreground">
                {{ service.status_output }}
              </div>
            </ScrollArea>
          </div>
        </div>
      </ScrollArea>

    </DialogContent>
  </Dialog>
</template>

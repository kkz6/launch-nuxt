<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface Props {
  open: boolean
  service: Service
  getImagePath: (service: Service) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'refresh': []
}>()

const isRefreshing = ref(false)

const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    emit('refresh')
  } finally {
    // The parent will update isRefreshing through the service prop update
    setTimeout(() => {
      isRefreshing.value = false
    }, 500)
  }
}

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

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return 'Never'
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  } catch {
    return 'Unknown'
  }
}

const statusDetails = computed(() => props.service.status_details)
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
      <DialogHeader class="border-b border-gray-200 p-4 pb-3 dark:border-gray-800">
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
                  :name="getStatusIconName(service.status)"
                  :class="[
                    'h-4 w-4',
                    service.status === 'running' && 'text-green-600',
                    service.status === 'stopped' && 'text-red-600',
                    service.status === 'failed' && 'text-red-600',
                    service.status === 'pending' && 'animate-spin text-yellow-600',
                    !['running', 'stopped', 'failed', 'pending'].includes(service.status) && 'text-gray-600',
                  ]"
                />
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <DialogTitle class="flex items-center gap-2 truncate text-xl font-semibold text-gray-900 dark:text-gray-100">
                {{ service.name }}
                <Badge
                  :class="[
                    'flex-shrink-0 border text-xs font-medium hover:bg-transparent hover:opacity-100',
                    getStatusColor(service.status),
                  ]"
                >
                  {{ service.status_label || service.status }}
                </Badge>
              </DialogTitle>
              <DialogDescription class="truncate text-sm text-gray-600 dark:text-gray-400">
                Service status and runtime information
              </DialogDescription>
            </div>
          </div>
        </div>
      </DialogHeader>

      <ScrollArea class="w-full flex-1 px-4 py-4">
        <div class="w-full space-y-4">
          <!-- Service Overview -->
          <div class="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
            <!-- Last Checked -->
            <div class="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50">
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:clock" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Last Checked</span>
              </div>
              <p class="break-words text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ formatRelativeTime(service.last_status_check) }}
              </p>
            </div>

            <!-- No status data message -->
            <div
              v-if="!statusDetails && !service.status_output"
              class="col-span-2 w-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:activity" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Status Information</span>
              </div>
              <p class="break-words text-sm text-gray-600 dark:text-gray-400">
                No status information available. Click the refresh button to check the current status.
              </p>
            </div>

            <!-- Process ID -->
            <div
              v-if="statusDetails?.pid"
              class="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:cpu" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Process ID</span>
              </div>
              <p class="break-words text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ statusDetails.pid }}
              </p>
            </div>

            <!-- Memory Usage -->
            <div
              v-if="statusDetails?.memory_usage"
              class="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
            >
              <div class="mb-1 flex items-center gap-2">
                <Icon name="lucide:memory-stick" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Memory Usage</span>
              </div>
              <p class="break-words text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ statusDetails.memory_usage }}
              </p>
            </div>
          </div>

          <!-- Started At -->
          <div
            v-if="statusDetails?.started_at"
            class="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
          >
            <div class="mb-1 flex items-center gap-2">
              <Icon name="lucide:play" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Started At</span>
            </div>
            <p class="break-words text-sm text-gray-900 dark:text-gray-100">
              {{ statusDetails.started_at }}
            </p>
          </div>

          <!-- Running Processes -->
          <div v-if="statusDetails?.processes && statusDetails.processes.length > 0" class="w-full">
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:server" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Running Processes</h3>
            </div>
            <div class="w-full space-y-1">
              <div
                v-for="(process, index) in statusDetails.processes"
                :key="index"
                class="w-full overflow-hidden break-all rounded-md border border-gray-200 bg-gray-100 p-2 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {{ process }}
              </div>
            </div>
          </div>

          <!-- Network Connections -->
          <div v-if="statusDetails?.connections && statusDetails.connections.length > 0" class="w-full">
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:network" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Network Connections</h3>
            </div>
            <div class="w-full space-y-1">
              <div
                v-for="(connection, index) in statusDetails.connections"
                :key="index"
                class="w-full overflow-hidden break-all rounded-md border border-gray-200 bg-gray-100 p-2 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {{ connection }}
              </div>
            </div>
          </div>

          <!-- Additional Service Information -->
          <div
            v-if="statusDetails?.additional_info && Object.keys(statusDetails.additional_info).length > 0"
            class="w-full"
          >
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:database" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Service Details</h3>
            </div>
            <div class="w-full space-y-3">
              <div v-for="(value, key) in statusDetails.additional_info" :key="key" class="w-full">
                <h4 class="mb-1 text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
                  {{ String(key).replace('_', ' ') }}
                </h4>
                <div class="w-full overflow-hidden whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-gray-100 p-2 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {{ value }}
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Output -->
          <div v-if="service.status_output" class="w-full">
            <Separator class="my-4" />
            <div class="mb-2 flex items-center gap-2">
              <Icon name="lucide:hard-drive" class="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Raw System Output</h3>
            </div>
            <ScrollArea class="h-48 w-full rounded-md border border-gray-200 dark:border-gray-800">
              <div class="whitespace-pre-wrap break-all bg-gray-50 p-3 font-mono text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                {{ service.status_output }}
              </div>
            </ScrollArea>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="border-t border-gray-200 p-4 pt-3 dark:border-gray-800">
        <Button
          variant="outline"
          :disabled="isRefreshing"
          class="w-full sm:w-auto"
          @click="handleRefresh"
        >
          <Icon
            v-if="isRefreshing"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

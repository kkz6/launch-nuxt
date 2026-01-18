<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import type { Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()

const {
  metrics,
  history,
  systemInfo,
  isConnected,
  error,
  connectionStatus,
  connect,
  disconnect,
  clearHistory,
} = useMetricsStream(props.server.id)

const statusColor = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
})

const statusTooltip = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'Live - Receiving real-time metrics'
    case 'connecting':
      return 'Connecting to metrics stream...'
    case 'error':
      return `Connection error: ${error.value || 'Unknown error'}`
    default:
      return 'Disconnected from metrics stream'
  }
})

const handleReconnect = () => {
  clearHistory()
  connect()
}

onMounted(() => {
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-semibold">Metrics</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <span :class="['h-2 w-2 rounded-full cursor-help', statusColor]" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{{ statusTooltip }}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p class="text-sm text-muted-foreground">Real-time server resource monitoring</p>
      </div>
      <Button
        v-if="connectionStatus === 'disconnected' || connectionStatus === 'error'"
        variant="ghost"
        size="sm"
        class="h-7 px-2"
        @click="handleReconnect"
      >
        <Icon name="lucide:refresh-cw" class="mr-1.5 h-3.5 w-3.5" />
        Reconnect
      </Button>
    </div>

    <!-- Connecting state -->
    <div v-if="connectionStatus === 'connecting'" class="flex flex-col items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
      <p class="mt-3 text-sm text-muted-foreground">Connecting to metrics stream...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-12">
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <div class="flex items-center gap-2">
          <Icon name="lucide:alert-circle" class="h-5 w-5 text-red-600 dark:text-red-400" />
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Server not connected state -->
    <div v-else-if="!server.connected" class="flex flex-col items-center justify-center py-12">
      <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
        <div class="flex items-center gap-2">
          <Icon name="lucide:wifi-off" class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p class="text-sm text-yellow-600 dark:text-yellow-400">
            Server is not connected. Metrics streaming requires an active connection.
          </p>
        </div>
      </div>
    </div>

    <!-- Disconnected state -->
    <div v-else-if="connectionStatus === 'disconnected'" class="flex flex-col items-center justify-center py-12">
      <div class="rounded-lg border border-muted bg-muted/50 p-4">
        <div class="flex items-center gap-2">
          <Icon name="lucide:unplug" class="h-5 w-5 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            Disconnected from metrics stream. Click reconnect to resume.
          </p>
        </div>
      </div>
    </div>

    <!-- Connected state - show metrics cards -->
    <div v-else class="space-y-3">
      <!-- Resource metrics row -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ServerMetricsCpuCard :metrics="metrics" :history="history" />
        <ServerMetricsMemoryCard :metrics="metrics" :history="history" />
        <ServerMetricsDiskCard :metrics="metrics" />
        <ServerMetricsLoadCard :metrics="metrics" :history="history" />
      </div>

      <!-- Processes and Network row -->
      <div class="grid gap-3 sm:grid-cols-2">
        <ServerMetricsProcessesCard
          :processes="metrics?.processes || []"
        />
        <ServerMetricsNetworkCard
          :network="metrics?.network || null"
          :history="history"
        />
      </div>

      <!-- System Info row -->
      <ServerMetricsSystemInfoCard
        :system-info="systemInfo"
      />
    </div>
  </div>
</template>

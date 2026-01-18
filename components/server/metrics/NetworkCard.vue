<script setup lang="ts">
import type { MetricsNetwork, MetricsData } from '~/composables/useMetricsStream'

interface Props {
  network: MetricsNetwork | null
  history: MetricsData[]
}

const props = defineProps<Props>()

const rxHistory = computed(() => {
  return props.history.map((m) => m.network.rx_rate)
})

const txHistory = computed(() => {
  return props.history.map((m) => m.network.tx_rate)
})

const maxRate = computed(() => {
  const maxRx = Math.max(...rxHistory.value, 1)
  const maxTx = Math.max(...txHistory.value, 1)
  return Math.max(maxRx, maxTx) * 1.2
})

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

const formatRate = (bytesPerSec: number) => {
  if (bytesPerSec === 0) return '0 B/s'

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const k = 1024
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k))

  return `${(bytesPerSec / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon name="lucide:network" class="h-3.5 w-3.5" />
      Network
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="lucide:arrow-down" class="h-3 w-3 text-green-500" />
          Download
        </div>
        <p class="text-sm font-semibold tabular-nums text-green-500">
          {{ formatRate(network?.rx_rate || 0) }}
        </p>
        <p class="text-[10px] text-muted-foreground">
          Total: {{ formatBytes(network?.rx_bytes || 0) }}
        </p>
      </div>
      <div>
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="lucide:arrow-up" class="h-3 w-3 text-blue-500" />
          Upload
        </div>
        <p class="text-sm font-semibold tabular-nums text-blue-500">
          {{ formatRate(network?.tx_rate || 0) }}
        </p>
        <p class="text-[10px] text-muted-foreground">
          Total: {{ formatBytes(network?.tx_bytes || 0) }}
        </p>
      </div>
    </div>
    <div v-if="rxHistory.length > 0 || txHistory.length > 0" class="mt-3 grid grid-cols-2 gap-4">
      <div v-if="rxHistory.length > 0">
        <ServerMetricsSparkline
          :data="rxHistory"
          color="rgb(34, 197, 94)"
          :max="maxRate"
          :height="30"
        />
      </div>
      <div v-if="txHistory.length > 0">
        <ServerMetricsSparkline
          :data="txHistory"
          color="rgb(59, 130, 246)"
          :max="maxRate"
          :height="30"
        />
      </div>
    </div>
  </div>
</template>

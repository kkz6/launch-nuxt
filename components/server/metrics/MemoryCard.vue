<script setup lang="ts">
import type { MetricsData } from '~/composables/useMetricsStream'

interface Props {
  metrics: MetricsData | null
  history: MetricsData[]
}

const props = defineProps<Props>()

const memoryHistory = computed(() => {
  return props.history.map((m) => m.memory.percent)
})

const memoryColor = computed(() => {
  const percent = props.metrics?.memory.percent || 0
  if (percent >= 90) return 'rgb(239, 68, 68)'
  if (percent >= 70) return 'rgb(234, 179, 8)'
  return 'rgb(59, 130, 246)'
})

const memoryTextColor = computed(() => {
  const percent = props.metrics?.memory.percent || 0
  if (percent >= 90) return 'text-red-500'
  if (percent >= 70) return 'text-yellow-500'
  return 'text-blue-500'
})

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name="lucide:memory-stick" class="h-3.5 w-3.5" />
        Memory
      </div>
      <span :class="['text-lg font-semibold tabular-nums', memoryTextColor]">
        {{ metrics?.memory.percent?.toFixed(1) || '0.0' }}%
      </span>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      {{ formatBytes(metrics?.memory.used || 0) }} / {{ formatBytes(metrics?.memory.total || 0) }}
    </p>
    <div v-if="memoryHistory.length > 0" class="mt-2">
      <ServerMetricsSparkline
        :data="memoryHistory"
        :color="memoryColor"
        :max="100"
        :height="40"
      />
    </div>
  </div>
</template>

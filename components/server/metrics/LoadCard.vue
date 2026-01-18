<script setup lang="ts">
import type { MetricsData } from '~/composables/useMetricsStream'

interface Props {
  metrics: MetricsData | null
  history: MetricsData[]
}

const props = defineProps<Props>()

const load1History = computed(() => {
  return props.history.map((m) => m.load[0])
})

const maxLoad = computed(() => {
  const maxFromHistory = Math.max(...load1History.value, 1)
  return Math.ceil(maxFromHistory * 1.2)
})

const loadColor = computed(() => {
  const load = props.metrics?.load[0] || 0
  if (load >= 4) return 'rgb(239, 68, 68)'
  if (load >= 2) return 'rgb(234, 179, 8)'
  return 'rgb(168, 85, 247)'
})

const loadTextColor = computed(() => {
  const load = props.metrics?.load[0] || 0
  if (load >= 4) return 'text-red-500'
  if (load >= 2) return 'text-yellow-500'
  return 'text-purple-500'
})
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name="lucide:activity" class="h-3.5 w-3.5" />
        Load
      </div>
      <span :class="['text-lg font-semibold tabular-nums', loadTextColor]">
        {{ metrics?.load[0]?.toFixed(2) || '0.00' }}
      </span>
    </div>
    <div class="mt-1 flex gap-2 text-xs text-muted-foreground">
      <span>1m: <span class="font-medium text-foreground">{{ metrics?.load[0]?.toFixed(2) || '0.00' }}</span></span>
      <span>5m: <span class="font-medium text-foreground">{{ metrics?.load[1]?.toFixed(2) || '0.00' }}</span></span>
      <span>15m: <span class="font-medium text-foreground">{{ metrics?.load[2]?.toFixed(2) || '0.00' }}</span></span>
    </div>
    <div v-if="load1History.length > 0" class="mt-2">
      <ServerMetricsSparkline
        :data="load1History"
        :color="loadColor"
        :max="maxLoad"
        :height="40"
      />
    </div>
  </div>
</template>

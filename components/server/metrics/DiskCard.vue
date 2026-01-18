<script setup lang="ts">
import { Progress } from '~/components/ui/progress'
import type { MetricsData } from '~/composables/useMetricsStream'

interface Props {
  metrics: MetricsData | null
}

const props = defineProps<Props>()

const diskColor = computed(() => {
  const percent = props.metrics?.disk.percent || 0
  if (percent >= 90) return 'text-red-500'
  if (percent >= 70) return 'text-yellow-500'
  return 'text-emerald-500'
})

const progressColor = computed(() => {
  const percent = props.metrics?.disk.percent || 0
  if (percent >= 90) return '[&>div]:bg-red-500'
  if (percent >= 70) return '[&>div]:bg-yellow-500'
  return '[&>div]:bg-emerald-500'
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
        <Icon name="lucide:hard-drive" class="h-3.5 w-3.5" />
        Disk
      </div>
      <span :class="['text-lg font-semibold tabular-nums', diskColor]">
        {{ metrics?.disk.percent?.toFixed(1) || '0.0' }}%
      </span>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      {{ formatBytes(metrics?.disk.used || 0) }} / {{ formatBytes(metrics?.disk.total || 0) }}
    </p>
    <div class="mt-3">
      <Progress
        :model-value="metrics?.disk.percent || 0"
        :class="['h-1.5', progressColor]"
      />
    </div>
    <p class="mt-1.5 text-xs text-muted-foreground">
      {{ formatBytes(metrics?.disk.free || 0) }} free
    </p>
  </div>
</template>

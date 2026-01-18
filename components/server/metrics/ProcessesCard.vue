<script setup lang="ts">
import type { MetricsProcess } from '~/composables/useMetricsStream'

interface Props {
  processes: MetricsProcess[]
}

defineProps<Props>()

const getCpuColor = (cpu: number) => {
  if (cpu >= 50) return 'text-red-500'
  if (cpu >= 25) return 'text-yellow-500'
  return 'text-foreground'
}

const getMemColor = (mem: number) => {
  if (mem >= 50) return 'text-red-500'
  if (mem >= 25) return 'text-yellow-500'
  return 'text-foreground'
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon name="lucide:list" class="h-3.5 w-3.5" />
      Top Processes
    </div>
    <div v-if="processes.length > 0" class="space-y-2">
      <div
        v-for="process in processes.slice(0, 5)"
        :key="process.pid"
        class="flex items-center text-xs"
      >
        <span class="w-16 shrink-0 text-muted-foreground tabular-nums">{{ process.pid }}</span>
        <span class="flex-1 truncate font-medium" :title="process.command">{{ process.command }}</span>
        <span class="w-16 shrink-0 text-right text-muted-foreground">{{ process.user }}</span>
        <span :class="['w-14 shrink-0 text-right tabular-nums', getCpuColor(process.cpu)]">
          {{ process.cpu.toFixed(1) }}%
        </span>
        <span :class="['w-14 shrink-0 text-right tabular-nums', getMemColor(process.mem)]">
          {{ process.mem.toFixed(1) }}%
        </span>
      </div>
    </div>
    <div v-else class="text-xs text-muted-foreground text-center py-4">
      No process data
    </div>
    <div class="mt-2 flex items-center text-[10px] text-muted-foreground border-t border-border pt-2">
      <span class="w-16 shrink-0">PID</span>
      <span class="flex-1">COMMAND</span>
      <span class="w-16 shrink-0 text-right">USER</span>
      <span class="w-14 shrink-0 text-right">CPU</span>
      <span class="w-14 shrink-0 text-right">MEM</span>
    </div>
  </div>
</template>

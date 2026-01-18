<script setup lang="ts">
import type { SystemInfo } from '~/composables/useMetricsStream'

interface Props {
  systemInfo: SystemInfo | null
}

const props = defineProps<Props>()

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)

  return parts.length > 0 ? parts.join(' ') : '< 1m'
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon name="lucide:server" class="h-3.5 w-3.5" />
      System Information
    </div>
    <div v-if="systemInfo" class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
      <div>
        <p class="text-xs text-muted-foreground">Hostname</p>
        <p class="font-medium truncate" :title="systemInfo.hostname">{{ systemInfo.hostname }}</p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Uptime</p>
        <p class="font-medium">{{ formatUptime(systemInfo.uptime) }}</p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Operating System</p>
        <p class="font-medium truncate" :title="systemInfo.os">{{ systemInfo.os }}</p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Kernel</p>
        <p class="font-medium truncate" :title="systemInfo.kernel">{{ systemInfo.kernel }}</p>
      </div>
      <div class="sm:col-span-2">
        <p class="text-xs text-muted-foreground">CPU</p>
        <p class="font-medium truncate" :title="systemInfo.cpu_model">{{ systemInfo.cpu_model }}</p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Cores</p>
        <p class="font-medium">{{ systemInfo.cpu_cores }}</p>
      </div>
      <div>
        <p class="text-xs text-muted-foreground">Total Memory</p>
        <p class="font-medium">{{ formatBytes(systemInfo.total_memory) }}</p>
      </div>
    </div>
    <div v-else class="text-xs text-muted-foreground text-center py-4">
      Waiting for system info...
    </div>
  </div>
</template>

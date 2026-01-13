<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'

interface BackupJob {
  id: string
  backup_id: string
  storage_provider_id: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  size: number
  size_in_mb: number
  error?: string
  created_at: string
  updated_at: string
}

interface Backup {
  id: string
  path: string
  databases: string[]
  jobs: BackupJob[]
}

interface Props {
  open: boolean
  backup: Backup
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const statusConfig: Record<string, { icon: string; label: string; class: string }> = {
  pending: {
    icon: 'lucide:clock',
    label: 'Pending',
    class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  running: {
    icon: 'lucide:loader-2',
    label: 'Running',
    class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  finished: {
    icon: 'lucide:check-circle-2',
    label: 'Finished',
    class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  failed: {
    icon: 'lucide:alert-circle',
    label: 'Failed',
    class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
}

const formatSize = (bytes: number | null): string => {
  if (bytes === null || bytes === 0) return '-'
  const mb = bytes / 1024 / 1024
  if (mb < 1) {
    const kb = bytes / 1024
    return `${kb.toFixed(2)} KB`
  }
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }
  return `${mb.toFixed(2)} MB`
}

const getBackupName = computed(() => {
  if (props.backup.databases && props.backup.databases.length > 0) {
    return `Database backup`
  }
  return props.backup.path || 'Files backup'
})
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent class="sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Backup History</SheetTitle>
        <SheetDescription>
          Backup history for {{ getBackupName }}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="mt-4 h-[calc(100vh-120px)] pr-4">
        <div v-if="backup.jobs.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
          <Icon name="lucide:history" class="mb-4 h-12 w-12 text-muted-foreground" />
          <p class="text-muted-foreground">No backup history yet</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="job in backup.jobs"
            :key="job.id"
            class="space-y-2 rounded-lg border p-4"
          >
            <div class="flex items-center justify-between">
              <Badge :class="['gap-1', statusConfig[job.status].class]">
                <Icon
                  :name="statusConfig[job.status].icon"
                  :class="['h-3 w-3', job.status === 'running' && 'animate-spin']"
                />
                {{ statusConfig[job.status].label }}
              </Badge>
              <span class="text-xs text-muted-foreground">
                {{ formatDistanceToNow(new Date(job.created_at), { addSuffix: true }) }}
              </span>
            </div>

            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Size:</span>
              <span class="font-medium">{{ formatSize(job.size) }}</span>
            </div>

            <div v-if="job.error" class="mt-2 break-all rounded bg-destructive/10 p-2 font-mono text-xs text-destructive">
              {{ job.error }}
            </div>
          </div>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>

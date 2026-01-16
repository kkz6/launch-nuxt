<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import type { LogInfo } from '~/types'

interface Props {
  serverId: string
  type?: 'server' | 'site'
  siteId?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'server',
})

const logs = ref<LogInfo[]>([])
const isLoading = ref(false)
const isSheetOpen = ref(false)
const selectedLog = ref<LogInfo | null>(null)
const isDropdownOpen = ref(false)

const fetchLogs = async () => {
  if (logs.value.length > 0) return

  isLoading.value = true
  try {
    const endpoint = props.type === 'site'
      ? `/servers/${props.serverId}/sites/${props.siteId}/logs`
      : `/servers/${props.serverId}/logs`
    const data = await $api<{ data: LogInfo[] }>(endpoint)
    logs.value = data.data
  } catch {
    toast.error('Failed to load logs')
  } finally {
    isLoading.value = false
  }
}

const openLog = (log: LogInfo) => {
  selectedLog.value = log
  isSheetOpen.value = true
  isDropdownOpen.value = false
}

const entityId = computed(() => {
  return props.type === 'site' ? (props.siteId || '') : props.serverId
})
</script>

<template>
  <div>
    <DropdownMenu v-model:open="isDropdownOpen" @update:open="(open) => open && fetchLogs()">
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm">
          <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
          Logs
          <Icon name="lucide:chevron-down" class="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-56">
        <DropdownMenuLabel>View Logs</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div v-if="isLoading" class="flex items-center justify-center py-4">
          <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else-if="logs.length > 0">
          <DropdownMenuItem
            v-for="log in logs"
            :key="log.software"
            class="cursor-pointer"
            @click="openLog(log)"
          >
            <Icon name="lucide:file-text" class="mr-2 h-4 w-4" />
            {{ log.name }}
          </DropdownMenuItem>
        </template>
        <div v-else class="px-2 py-4 text-center text-sm text-muted-foreground">
          No logs available
        </div>
      </DropdownMenuContent>
    </DropdownMenu>

    <Sheet v-model:open="isSheetOpen">
      <SheetContent class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>{{ selectedLog?.name || 'Logs' }}</SheetTitle>
          <SheetDescription>
            {{ type === 'site' ? 'Site' : 'Server' }} logs for {{ selectedLog?.name }}
          </SheetDescription>
        </SheetHeader>
        <div class="mt-4">
          <ServerLogViewer
            v-if="isSheetOpen && selectedLog"
            :key="`${selectedLog.software}-${entityId}`"
            :server-id="serverId"
            :entity="type"
            :entity-id="entityId"
            :software="selectedLog.software"
            no-timestamp
            hide-options
            container-class-name="h-[calc(100vh-16rem)]"
          />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

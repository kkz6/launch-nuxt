<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Badge } from '~/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useScriptExecutionEvents } from '~/composables/useChannelEvents'

interface Execution {
  id: string
  script_id: string
  server_id: string
  server_name: string
  batch_id: string
  user: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  exit_code: number | null
  output: string
  started_at: string | null
  finished_at: string | null
}

interface Props {
  scriptId: string
  scriptName: string
  batchId: string
  serverIds: string[]
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { default: false })

const { user } = useAuth()
const teamId = computed(() => user.value?.current_team_id?.toString() || '')

const executions = ref<Map<string, Execution>>(new Map())
const activeServerId = ref<string>('')
const isLoading = ref(true)

// Fetch initial executions for the batch
const fetchExecutions = async () => {
  try {
    const response = await $api<{ data: Execution[] }>(`/scripts/${props.scriptId}/executions`, {
      params: { batch_id: props.batchId },
    })

    executions.value.clear()
    for (const exec of response.data) {
      executions.value.set(exec.server_id, exec)
    }

    // Set first server as active
    if (props.serverIds.length > 0 && !activeServerId.value) {
      activeServerId.value = props.serverIds[0]
    }
  } catch {
    toast.error('Failed to load execution status')
  } finally {
    isLoading.value = false
  }
}

// Subscribe to real-time events
useScriptExecutionEvents(teamId, (data) => {
  const executionId = data.execution_id as string
  const serverId = data.server_id as string

  // Find matching execution
  const execution = Array.from(executions.value.values()).find(
    (e) => e.id === executionId || e.server_id === serverId
  )

  if (!execution) return

  if (data.status === 'running' || (data as Record<string, unknown>).output !== undefined) {
    // script.output event - append output
    const output = (data as Record<string, unknown>).output as string
    if (output) {
      execution.output = (execution.output || '') + output
      execution.status = 'running'
      executions.value.set(execution.server_id, { ...execution })
    }
  } else if (data.status === 'finished' || data.status === 'failed') {
    // script.execution.completed event
    execution.status = data.status as 'finished' | 'failed'
    execution.exit_code = (data as Record<string, unknown>).exit_code as number
    execution.finished_at = new Date().toISOString()
    executions.value.set(execution.server_id, { ...execution })
  }
})

// Get execution for active server
const activeExecution = computed(() => {
  return executions.value.get(activeServerId.value)
})

// Parse ANSI codes for colored output
const parseAnsi = (text: string) => {
  const ansiColors: Record<string, string> = {
    '30': 'color: #000',
    '31': 'color: #e74c3c',
    '32': 'color: #2ecc71',
    '33': 'color: #f39c12',
    '34': 'color: #3498db',
    '35': 'color: #9b59b6',
    '36': 'color: #1abc9c',
    '37': 'color: #ecf0f1',
    '90': 'color: #7f8c8d',
    '91': 'color: #e74c3c',
    '92': 'color: #2ecc71',
    '93': 'color: #f1c40f',
    '94': 'color: #3498db',
    '95': 'color: #9b59b6',
    '96': 'color: #1abc9c',
    '97': 'color: #fff',
  }

  const parts: { text: string; style: string }[] = []
  let currentStyle = ''
  let lastIndex = 0
  const ansiRegex = /\x1b\[([0-9;]*)m/g
  let match

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), style: currentStyle })
    }
    const codes = match[1].split(';')
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentStyle = ''
      } else if (code === '1') {
        currentStyle += 'font-weight: bold;'
      } else if (ansiColors[code]) {
        currentStyle += ansiColors[code] + ';'
      }
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), style: currentStyle })
  }

  return parts
}

const parsedOutput = computed(() => {
  return parseAnsi(activeExecution.value?.output || '')
})

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return { variant: 'secondary' as const, label: 'Pending', class: '' }
    case 'running':
      return { variant: 'default' as const, label: 'Running', class: 'animate-pulse' }
    case 'finished':
      return { variant: 'success' as const, label: 'Finished', class: '' }
    case 'failed':
      return { variant: 'destructive' as const, label: 'Failed', class: '' }
    default:
      return { variant: 'secondary' as const, label: status, class: '' }
  }
}

const getStatusDot = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500'
    case 'running':
      return 'bg-blue-500 animate-pulse'
    case 'finished':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

const allCompleted = computed(() => {
  if (executions.value.size === 0) return false
  return Array.from(executions.value.values()).every(
    (e) => e.status === 'finished' || e.status === 'failed'
  )
})

const handleCopy = async () => {
  try {
    const plainText = (activeExecution.value?.output || '').replace(/\x1b\[[0-9;]*m/g, '')
    await navigator.clipboard.writeText(plainText)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Failed to copy')
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    isLoading.value = true
    activeServerId.value = props.serverIds[0] || ''
    fetchExecutions()
  }
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      class="!inset-0 flex !h-full !w-full flex-col overflow-hidden !border-0 sm:!inset-y-auto sm:!left-auto sm:!top-16 sm:!right-3 sm:!bottom-4 sm:!h-auto sm:!w-full sm:!max-w-4xl sm:!rounded-lg sm:!border"
      :show-close="true"
    >
      <SheetHeader class="flex-shrink-0 pb-4">
        <div class="flex items-center justify-between">
          <SheetTitle>{{ scriptName }}</SheetTitle>
          <div class="flex items-center gap-2">
            <Badge v-if="allCompleted" variant="success">Complete</Badge>
            <Badge v-else variant="secondary" class="animate-pulse">Running</Badge>
          </div>
        </div>
      </SheetHeader>

      <div v-if="isLoading" class="flex flex-1 items-center justify-center">
        <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <!-- Server tabs for multiple servers -->
        <Tabs
          v-if="serverIds.length > 1"
          v-model="activeServerId"
          class="flex min-h-0 flex-1 flex-col"
        >
          <TabsList class="w-full justify-start overflow-x-auto">
            <TabsTrigger
              v-for="serverId in serverIds"
              :key="serverId"
              :value="serverId"
              class="flex items-center gap-2"
            >
              <span
                class="h-2 w-2 rounded-full"
                :class="getStatusDot(executions.get(serverId)?.status || 'pending')"
              />
              {{ executions.get(serverId)?.server_name || serverId }}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            v-for="serverId in serverIds"
            :key="serverId"
            :value="serverId"
            class="mt-4 min-h-0 flex-1"
          >
            <div class="flex h-full flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Badge :variant="getStatusBadge(executions.get(serverId)?.status || 'pending').variant">
                    {{ getStatusBadge(executions.get(serverId)?.status || 'pending').label }}
                  </Badge>
                  <span
                    v-if="executions.get(serverId)?.exit_code !== null"
                    class="text-xs text-muted-foreground"
                  >
                    Exit code: {{ executions.get(serverId)?.exit_code }}
                  </span>
                </div>
                <Button variant="ghost" size="sm" @click="handleCopy">
                  <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>

              <div class="min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-950">
                <ScrollArea class="h-full p-4">
                  <pre class="whitespace-pre-wrap break-words font-mono text-sm text-zinc-100"><template
                    v-for="(part, index) in parseAnsi(executions.get(serverId)?.output || '')"
                    :key="index"
                  ><span :style="part.style">{{ part.text }}</span></template><span
                    v-if="executions.get(serverId)?.status === 'running'"
                    class="inline-block h-4 w-2 animate-pulse bg-zinc-100"
                  /></pre>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <!-- Single server view -->
        <div v-else class="flex min-h-0 flex-1 flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Badge :variant="getStatusBadge(activeExecution?.status || 'pending').variant">
                {{ getStatusBadge(activeExecution?.status || 'pending').label }}
              </Badge>
              <span v-if="activeExecution?.exit_code !== null" class="text-xs text-muted-foreground">
                Exit code: {{ activeExecution?.exit_code }}
              </span>
            </div>
            <Button variant="ghost" size="sm" @click="handleCopy">
              <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
              Copy
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-950">
            <ScrollArea class="h-full p-4">
              <pre class="whitespace-pre-wrap break-words font-mono text-sm text-zinc-100"><template
                v-for="(part, index) in parsedOutput"
                :key="index"
              ><span :style="part.style">{{ part.text }}</span></template><span
                v-if="activeExecution?.status === 'running'"
                class="inline-block h-4 w-2 animate-pulse bg-zinc-100"
              /></pre>
            </ScrollArea>
          </div>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>

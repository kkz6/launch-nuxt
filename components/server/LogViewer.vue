<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface Props {
  serverId: string
  entity: string
  entityId: string
  software?: string
  typeSwitcher?: boolean
  noTimestamp?: boolean
  hideOptions?: boolean
  containerClassName?: string
}

interface LogLine {
  timestamp: Date | null
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'debug'
}

const props = withDefaults(defineProps<Props>(), {
  typeSwitcher: false,
  noTimestamp: false,
  hideOptions: false,
})

const config = useRuntimeConfig()
const { token } = useAuth()
const rawLogs = ref('')
const filteredLogs = ref<LogLine[]>([])
const autoScroll = ref(true)
const lines = ref(100)
const linesString = computed({
  get: () => String(lines.value),
  set: (val: string) => {
    lines.value = parseInt(val, 10)
  },
})
const search = ref('')
const typeFilter = ref<string[]>([])
const scrollRef = ref<HTMLDivElement | null>(null)
const isLoading = ref(false)
const logType = ref('output')

const lineOptions = [
  { value: '50', label: '50 lines' },
  { value: '100', label: '100 lines' },
  { value: '200', label: '200 lines' },
  { value: '500', label: '500 lines' },
]

const priorities = [
  { label: 'Info', value: 'info' },
  { label: 'Success', value: 'success' },
  { label: 'Warning', value: 'warning' },
  { label: 'Debug', value: 'debug' },
  { label: 'Error', value: 'error' },
]

const getLogType = (message: string): LogLine['type'] => {
  const lowerMessage = message.toLowerCase()
  if (lowerMessage.includes('error') || lowerMessage.includes('fail') || lowerMessage.includes('exception')) {
    return 'error'
  }
  if (lowerMessage.includes('warn')) {
    return 'warning'
  }
  if (lowerMessage.includes('success') || lowerMessage.includes('complete')) {
    return 'success'
  }
  if (lowerMessage.includes('debug')) {
    return 'debug'
  }
  return 'info'
}

const parseLogs = (raw: string): LogLine[] => {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map((line) => {
    const timestampMatch = line.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]?\s*/)
    let timestamp: Date | null = null
    let message = line

    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1])
      message = line.slice(timestampMatch[0].length)
    }

    return {
      timestamp,
      message,
      type: getLogType(message),
    }
  })
}

const scrollToBottom = () => {
  if (autoScroll.value && scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

const handleScroll = () => {
  if (!scrollRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollRef.value
  autoScroll.value = Math.abs(scrollHeight - scrollTop - clientHeight) < 10
}

const handleDownload = () => {
  const logContent = filteredLogs.value
    .map(({ timestamp, message }) => `${timestamp?.toISOString() || 'No timestamp'} ${message}`)
    .join('\n')

  const blob = new Blob([logContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const isoDate = new Date().toISOString()
  a.href = url
  a.download = `${props.entity}-${isoDate.slice(0, 10).replace(/-/g, '')}_${isoDate.slice(11, 19).replace(/:/g, '')}.log.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const typeColorMap: Record<string, string> = {
  error: 'text-red-500',
  warning: 'text-yellow-500',
  success: 'text-green-500',
  debug: 'text-blue-500',
  info: 'text-muted-foreground',
}

// WebSocket connection
let ws: WebSocket | null = null

const connectWebSocket = () => {
  if (ws) {
    ws.close()
  }

  isLoading.value = true
  rawLogs.value = ''
  filteredLogs.value = []

  const params = new URLSearchParams({
    serverId: props.serverId,
    entity: props.entity,
    entityId: props.entityId,
    tail: lines.value.toString(),
    search: search.value,
    token: token.value || '',
  })

  if (logType.value) {
    params.set('type', logType.value)
  }
  if (props.software) {
    params.set('software', props.software)
  }

  const wsBase = config.public.wsBase as string
  const wsUrl = `${wsBase}/terminal/logs?${params.toString()}`

  ws = new WebSocket(wsUrl)

  let noDataTimeout: NodeJS.Timeout | null = null

  const resetTimeout = () => {
    if (noDataTimeout) clearTimeout(noDataTimeout)
    noDataTimeout = setTimeout(() => {
      isLoading.value = false
    }, 2000)
  }

  ws.onopen = () => {
    resetTimeout()
  }

  ws.onmessage = (e) => {
    rawLogs.value += e.data
    isLoading.value = false
    if (noDataTimeout) clearTimeout(noDataTimeout)
  }

  ws.onerror = () => {
    isLoading.value = false
    if (noDataTimeout) clearTimeout(noDataTimeout)
  }

  ws.onclose = () => {
    isLoading.value = false
    if (noDataTimeout) clearTimeout(noDataTimeout)
  }
}

watch([() => props.entityId, () => props.software, logType, lines], () => {
  rawLogs.value = ''
  filteredLogs.value = []
  connectWebSocket()
})

watch(rawLogs, () => {
  const logs = parseLogs(rawLogs.value)
  filteredLogs.value = typeFilter.value.length > 0
    ? logs.filter((log) => typeFilter.value.includes(log.type))
    : logs
})

watch(filteredLogs, () => {
  nextTick(scrollToBottom)
})

onMounted(connectWebSocket)

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="rounded-lg">
      <div class="space-y-4">
        <div v-if="!hideOptions" class="flex flex-wrap items-start justify-between gap-4 sm:items-center">
          <div class="flex flex-wrap gap-4">
            <Select v-model="linesString">
              <SelectTrigger class="w-[130px]">
                <SelectValue placeholder="Lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in lineOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Input
              v-model="search"
              type="search"
              placeholder="Search logs..."
              class="inline-flex h-9 w-full text-sm placeholder-gray-400 sm:w-auto"
            />
          </div>

          <div class="flex flex-wrap gap-4">
            <Tabs v-if="typeSwitcher" v-model="logType">
              <TabsList>
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="error">Error</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="sm" :disabled="filteredLogs.length === 0" @click="handleDownload">
              <Icon name="lucide:download" class="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        <div
          ref="scrollRef"
          class="relative h-[500px] overflow-y-auto rounded-md border bg-background p-4"
          :class="containerClassName"
          @scroll="handleScroll"
        >
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-background/80">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>

          <div v-if="filteredLogs.length === 0 && !isLoading" class="flex h-full items-center justify-center text-muted-foreground">
            No logs found
          </div>

          <div class="space-y-1 font-mono text-sm">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              class="flex gap-2"
            >
              <span v-if="!noTimestamp && log.timestamp" class="shrink-0 text-muted-foreground">
                {{ log.timestamp.toLocaleTimeString() }}
              </span>
              <span :class="typeColorMap[log.type]" class="whitespace-pre-wrap break-all">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

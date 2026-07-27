<script setup lang="ts">
import { reactive, toRefs } from 'vue'
import stripAnsi from 'strip-ansi'
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
  route?: string
  typeSwitcher?: boolean
  noTimestamp?: boolean
  hideOptions?: boolean
  containerClassName?: string
}

interface LogLine {
  timestamp: Date | null
  message: string
  rawLine: string
  type: 'info' | 'success' | 'warning' | 'error' | 'debug'
  html?: string
}

const props = withDefaults(defineProps<Props>(), {
  typeSwitcher: false,
  noTimestamp: false,
  hideOptions: false,
})

const config = useRuntimeConfig()
const { token, waitForAuth } = useAuth()
const { getCurrentTeamId } = useApi()
interface LogViewerState {
  rawLogs: string
  emptyConfirmed: boolean
  streamEnded: boolean
  streamError: string
  filteredLogs: LogLine[]
  autoScroll: boolean
  lines: number
  search: string
  typeFilter: string[]
  scrollRef: HTMLDivElement | null
  wsOpen: boolean
  logType: string
  showTimestamp: boolean
}

const state = reactive({
  rawLogs: '',
  emptyConfirmed: false,
  streamEnded: false,
  streamError: '',
  filteredLogs: [],
  autoScroll: true,
  lines: 100,
  search: '',
  typeFilter: [],
  scrollRef: null,
  wsOpen: false,
  logType: 'output',
  showTimestamp: !props.noTimestamp,
}) as LogViewerState

const {
  rawLogs,
  emptyConfirmed,
  streamEnded,
  streamError,
  filteredLogs,
  autoScroll,
  lines,
  search,
  typeFilter,
  scrollRef,
  wsOpen,
  logType,
  showTimestamp,
} = toRefs(state)
let emptyConfirmTimer: ReturnType<typeof setTimeout> | null = null
const linesString = computed({
  get: () => String(lines.value),
  set: (val: string) => {
    lines.value = parseInt(val, 10)
  },
})

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

const statusColorClass = (status: number): string => {
  if (status >= 500) return 'text-red-400'
  if (status >= 400) return 'text-yellow-400'
  if (status >= 300) return 'text-blue-400'
  if (status >= 200) return 'text-green-400'
  return 'text-zinc-300'
}

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const formatCaddyAccessLog = (parsed: Record<string, any>): string | null => {
  if (parsed.msg !== 'handled request') return null

  const status = parsed.resp_headers?.['Status'] || parsed.status
  const method = parsed.request?.method || ''
  const uri = parsed.request?.uri || ''
  const duration =
    parsed.duration != null ? `${(parsed.duration * 1000).toFixed(2)}ms` : ''
  const clientIp = parsed.request?.client_ip || parsed.request?.remote_ip || ''

  if (!method || !uri) return null

  const statusNum = typeof status === 'number' ? status : parseInt(status, 10)
  const statusClass = statusColorClass(statusNum)

  const parts = [
    `<span class="${statusClass} font-semibold">${statusNum || '???'}</span>`,
    `<span class="text-zinc-100">${escapeHtml(method)}</span>`,
    `<span class="text-zinc-300">${escapeHtml(uri)}</span>`,
  ]
  if (duration)
    parts.push(`<span class="text-zinc-500">${escapeHtml(duration)}</span>`)
  if (clientIp)
    parts.push(`<span class="text-zinc-500">${escapeHtml(clientIp)}</span>`)

  return parts.join(' ')
}

const getLogTypeFromJson = (parsed: Record<string, any>): LogLine['type'] => {
  const level = parsed.level?.toLowerCase?.()
  if (level === 'error') return 'error'
  if (level === 'warn' || level === 'warning') return 'warning'
  if (level === 'debug') return 'debug'
  if (level === 'info') return 'info'
  return 'info'
}

const getLogType = (message: string): LogLine['type'] => {
  const lower = message.toLowerCase()

  if (
    /\berror\b/.test(lower) ||
    /\bfail(?:ed|ure)?\b/.test(lower) ||
    /\bexception\b/.test(lower)
  ) {
    return 'error'
  }
  if (/\bwarn(?:ing)?\b/.test(lower)) {
    return 'warning'
  }
  if (
    /\bsuccess(?:ful(?:ly)?)?\b/.test(lower) ||
    /\bcomplete[d]?\b/.test(lower)
  ) {
    return 'success'
  }
  if (/\bdebug\b/.test(lower)) {
    return 'debug'
  }
  return 'info'
}

const NOISE_PATTERNS: RegExp[] = [
  /^tail: (?:cannot open '.*' for reading: No such file or directory|no files remaining)$/,
  /^SSH connection failed:/,
  /^overall progress:\s+\d+\s+out of\s+\d+\s+tasks?\b/,
  /^verify: Waiting \d+ seconds to verify that tasks are stable/,
  /^Canceled hold on cloud-init\.?$/,
  /^cloud-init was already not on hold\.?$/,
  /^debconf:/,
  /^dpkg-preconfigure: unable to re-open stdin:/,
  /^\(Reading database \.\.\./,
  /SyntaxWarning: invalid escape sequence/,
  /^Selecting previously unselected package /,
  /^Preparing to unpack /,
  /^Unpacking /,
  /^Setting up /,
  /^Processing triggers for /,
  /^Created symlink /,
  /^Running kernel seems to be up-to-date\.?$/,
  /^No (?:services|containers|user sessions|VM guests) /,
  /^Synchronizing state of /,
  /^Executing: \/usr\/lib\/systemd\/systemd-sysv-install /,
]

const isNoise = (line: string): boolean => {
  const t = stripAnsi(line).trim()
  return NOISE_PATTERNS.some((re) => re.test(t))
}

const SYNTAX_WARNING_RE = /SyntaxWarning: invalid escape sequence/

const stripNoiseLines = (lines: string[]): string[] => {
  const out: string[] = []
  let dropNext = false
  for (const line of lines) {
    if (dropNext) {
      dropNext = false
      continue
    }
    if (isNoise(line)) {
      const t = stripAnsi(line).trim()
      if (SYNTAX_WARNING_RE.test(t)) dropNext = true
      continue
    }
    out.push(line)
  }
  return out
}

const parseLogs = (raw: string): LogLine[] => {
  if (!raw) return []
  const stripped = stripNoiseLines(
    raw
      .split('\n')
      .filter((line) => line.trim() && !line.includes('::LAUNCH::')),
  )
  return stripped.map((line) => {
    const cleanLine = stripAnsi(line)

    if (cleanLine.trimStart().startsWith('{')) {
      try {
        const parsed = JSON.parse(cleanLine)
        const logTypeResult = getLogTypeFromJson(parsed)

        const formatted = formatCaddyAccessLog(parsed)
        if (formatted) {
          return {
            timestamp: parsed.ts ? new Date(parsed.ts * 1000) : null,
            message: cleanLine,
            rawLine: cleanLine,
            type: logTypeResult,
            html: formatted,
          }
        }

        const msg = parsed.msg || parsed.message || cleanLine
        return {
          timestamp: parsed.ts ? new Date(parsed.ts * 1000) : null,
          message: msg,
          rawLine: cleanLine,
          type: logTypeResult,
        }
      } catch {}
    }

    const timestampMatch = cleanLine.match(
      /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*/,
    )
    let timestamp: Date | null = null
    let message = cleanLine

    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1].replace(',', '.'))
      message = cleanLine.slice(timestampMatch[0].length)
    }

    const mysqlMatch = message.match(
      /^\d+\s+\[(System|Warning|Error|Note)\]\s+(\[MY-\d+\]\s+\[\w+\]\s+)(.*)/,
    )
    if (mysqlMatch) {
      const levelMap: Record<string, LogLine['type']> = {
        System: 'info',
        Warning: 'warning',
        Error: 'error',
        Note: 'debug',
      }
      return {
        timestamp,
        message: mysqlMatch[3],
        rawLine: cleanLine,
        type: levelMap[mysqlMatch[1]] || 'info',
      }
    }

    const supervisorMatch = message.match(/^(INFO|WARN|CRIT|DEBUG)\s+(.*)/)
    if (supervisorMatch) {
      const levelMap: Record<string, LogLine['type']> = {
        INFO: 'info',
        WARN: 'warning',
        CRIT: 'error',
        DEBUG: 'debug',
      }
      return {
        timestamp,
        message: `${supervisorMatch[1]} ${supervisorMatch[2]}`,
        rawLine: cleanLine,
        type: levelMap[supervisorMatch[1]] || 'info',
      }
    }

    return {
      timestamp,
      message,
      rawLine: cleanLine,
      type: getLogType(message),
    }
  })
}

const typeColorMap: Record<string, string> = {
  error: 'text-red-400',
  warning: 'text-yellow-400',
  success: 'text-green-400',
  debug: 'text-blue-400',
  info: 'text-zinc-300',
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
    .map(({ timestamp, message, rawLine }) => {
      const ts = timestamp?.toISOString() || 'No timestamp'
      return rawLine !== message ? `${ts} ${rawLine}` : `${ts} ${message}`
    })
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

let ws: WebSocket | null = null

const connectWebSocket = async () => {
  if (ws) {
    ws.close()
  }

  rawLogs.value = ''
  filteredLogs.value = []
  emptyConfirmed.value = false
  streamEnded.value = false
  streamError.value = ''
  if (emptyConfirmTimer) {
    clearTimeout(emptyConfirmTimer)
    emptyConfirmTimer = null
  }
  await waitForAuth()

  const teamId = getCurrentTeamId()
  const params = new URLSearchParams({
    serverId: props.serverId,
    entity: props.entity,
    entityId: props.entityId,
    tail: lines.value.toString(),
    search: search.value,
    token: token.value || '',
  })

  if (teamId) {
    params.set('team_id', teamId)
  }
  if (logType.value) {
    params.set('type', logType.value)
  }
  if (props.route) {
    params.set('route', props.route)
  } else if (props.software) {
    params.set('software', props.software)
  }

  const wsBase = config.public.wsBase as string
  const wsUrl = `${wsBase}/terminal/logs?${params.toString()}`

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    wsOpen.value = true
    streamEnded.value = false
    streamError.value = ''
    if (emptyConfirmTimer) clearTimeout(emptyConfirmTimer)
    emptyConfirmTimer = setTimeout(() => {
      if (rawLogs.value.length === 0) {
        emptyConfirmed.value = true
      }
    }, 2500)
  }

  ws.onmessage = (e) => {
    const data = typeof e.data === 'string' ? e.data : String(e.data)
    try {
      const event = JSON.parse(data) as {
        event?: string
        message?: string
        data?: { message?: string }
      }
      if (event.event === 'error') {
        streamError.value =
          event.data?.message || event.message || 'Unable to load logs'
        streamEnded.value = true
        wsOpen.value = false
        return
      }
    } catch {
      // Log output is plain text and may contain JSON-like lines.
    }

    rawLogs.value += data
    if (emptyConfirmTimer) {
      clearTimeout(emptyConfirmTimer)
      emptyConfirmTimer = null
    }
    emptyConfirmed.value = false
  }

  ws.onerror = () => {
    wsOpen.value = false
    streamEnded.value = true
    if (!streamError.value) streamError.value = 'Unable to connect to log stream'
  }

  ws.onclose = () => {
    wsOpen.value = false
    streamEnded.value = true
  }
}

watch([() => props.entityId, () => props.software, logType, lines], () => {
  rawLogs.value = ''
  filteredLogs.value = []
  connectWebSocket()
})

watch(rawLogs, () => {
  const logs = parseLogs(rawLogs.value)
  filteredLogs.value =
    typeFilter.value.length > 0
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
  if (emptyConfirmTimer) {
    clearTimeout(emptyConfirmTimer)
    emptyConfirmTimer = null
  }
})
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0" :class="hideOptions ? '' : 'gap-4'">
    <div
      class="flex flex-col flex-1 min-h-0"
      :class="hideOptions ? '' : 'rounded-lg'"
    >
      <div
        class="flex flex-col flex-1 min-h-0"
        :class="hideOptions ? '' : 'space-y-4'"
      >
        <div
          v-if="!hideOptions"
          class="flex flex-wrap items-center justify-between gap-3"
        >
          <div class="flex flex-wrap items-center gap-3">
            <Select v-model="linesString">
              <SelectTrigger class="w-[130px]">
                <SelectValue placeholder="Lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in lineOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Input
              v-model="search"
              type="search"
              placeholder="Search logs..."
              class="inline-flex h-10 w-full text-sm placeholder-gray-400 sm:w-auto"
            />
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <Tabs v-if="typeSwitcher" v-model="logType">
              <TabsList>
                <TabsTrigger value="output">Output</TabsTrigger>
                <TabsTrigger value="error">Error</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10"
              :class="showTimestamp ? '' : 'opacity-50'"
              title="Toggle timestamps"
              @click="showTimestamp = !showTimestamp"
            >
              <Icon name="lucide:clock" class="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10"
              title="Download logs"
              :disabled="filteredLogs.length === 0"
              @click="handleDownload"
            >
              <Icon name="lucide:download" class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref="scrollRef"
          :class="[
            'flex-1 min-h-0 relative overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-4 text-zinc-300',
            containerClassName || 'h-[500px]',
          ]"
          @scroll="handleScroll"
        >
          <div
            v-if="filteredLogs.length === 0"
            class="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-950/80 text-sm text-zinc-400"
          >
            <template v-if="streamError">
              <Icon name="lucide:triangle-alert" class="h-4 w-4 text-red-400" />
              <span>{{ streamError }}</span>
            </template>
            <template v-else-if="streamEnded || (wsOpen && emptyConfirmed)">
              <Icon name="lucide:file-x" class="h-4 w-4" />
              <span>No logs available</span>
            </template>
            <template v-else>
              <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" />
              <span>{{ wsOpen ? 'Loading logs…' : 'Connecting…' }}</span>
            </template>
          </div>

          <div class="space-y-1 font-mono text-sm">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              class="flex gap-2"
              :title="log.rawLine !== log.message ? log.rawLine : undefined"
            >
              <span
                v-if="showTimestamp && log.timestamp"
                class="shrink-0 text-zinc-500"
              >
                {{ log.timestamp.toLocaleTimeString() }}
              </span>
              <span
                v-if="log.html"
                class="whitespace-pre-wrap break-all"
                v-html="log.html"
              />
              <span
                v-else
                :class="typeColorMap[log.type]"
                class="whitespace-pre-wrap break-all"
                >{{ log.message }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

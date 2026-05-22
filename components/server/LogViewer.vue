<script setup lang="ts">
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
const { token, isInitialized, waitForAuth } = useAuth()
const { getCurrentTeamId } = useApi()
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
const wsOpen = ref(false)
const logType = ref('output')
const showTimestamp = ref(!props.noTimestamp)

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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const formatCaddyAccessLog = (parsed: Record<string, any>): string | null => {
  if (parsed.msg !== 'handled request') return null

  const status = parsed.resp_headers?.['Status'] || parsed.status
  const method = parsed.request?.method || ''
  const uri = parsed.request?.uri || ''
  const duration = parsed.duration != null ? `${(parsed.duration * 1000).toFixed(2)}ms` : ''
  const clientIp = parsed.request?.client_ip || parsed.request?.remote_ip || ''

  if (!method || !uri) return null

  const statusNum = typeof status === 'number' ? status : parseInt(status, 10)
  const statusClass = statusColorClass(statusNum)

  const parts = [
    `<span class="${statusClass} font-semibold">${statusNum || '???'}</span>`,
    `<span class="text-zinc-100">${escapeHtml(method)}</span>`,
    `<span class="text-zinc-300">${escapeHtml(uri)}</span>`,
  ]
  if (duration) parts.push(`<span class="text-zinc-500">${escapeHtml(duration)}</span>`)
  if (clientIp) parts.push(`<span class="text-zinc-500">${escapeHtml(clientIp)}</span>`)

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

  if (/\berror\b/.test(lower) || /\bfail(?:ed|ure)?\b/.test(lower) || /\bexception\b/.test(lower)) {
    return 'error'
  }
  if (/\bwarn(?:ing)?\b/.test(lower)) {
    return 'warning'
  }
  if (/\bsuccess(?:ful(?:ly)?)?\b/.test(lower) || /\bcomplete[d]?\b/.test(lower)) {
    return 'success'
  }
  if (/\bdebug\b/.test(lower)) {
    return 'debug'
  }
  return 'info'
}

// Patterns that are operational noise customers shouldn't see in the log
// viewer. Each entry is matched against the trimmed (and ansi-stripped)
// line; matches are dropped silently.
//
// Why each one is here:
//
// - `tail: cannot open ... no files remaining` — the log-tail SSH starts
//   before the script's log file exists. Cosmetic.
// - `SSH connection failed: ...` — early-provision SSH tail races sshd
//   coming up. Leaks the IP and looks like a hard failure to non-technical
//   users; instead we silently retry under the hood.
// - `overall progress: X out of N tasks` / `verify: Waiting N seconds to
//   verify that tasks are stable` — `docker service create` streams these
//   on every poll until swarm convergence (40+ identical lines).
// - `Canceled hold on cloud-init` / `cloud-init was already not on hold` —
//   cosmetic chatter from `apt-mark unhold` in the cleanup step.
// - `debconf: unable to initialize frontend ...` / `debconf: (...)` /
//   `dpkg-preconfigure: unable to re-open stdin:` — every apt-get install
//   over SSH lacks a controlling tty, so debconf falls back to teletype
//   and prints 5+ lines of harmless warnings. Pure noise.
// - `(Reading database ... NN%)` — apt's progress bar; emits ~20 lines
//   per package operation. Useless without a terminal width.
// - `SyntaxWarning: invalid escape sequence ...` — upstream fail2ban
//   ships Python files with deprecation warnings (not our bug).
// - `[Pp]rocessing triggers for ...` / `Setting up ...` / `Selecting
//   previously unselected package ...` / `Preparing to unpack ...` /
//   `Unpacking ...` — verbose apt step-by-step that buries the actionable
//   lines. We keep the high-level `echo "Install essential packages"`
//   line from our script — that's the one the customer needs.
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
  return NOISE_PATTERNS.some(re => re.test(t))
}

// Python prints SyntaxWarning headers like
//   /usr/.../foo.py:224: SyntaxWarning: invalid escape sequence '\s'
// followed by the *source line* the warning refers to:
//   "1490349000 test failed.dns.ch", "^\s*test <F-ID>\S+</F-ID>"
// The header matches NOISE_PATTERNS, but the source line is arbitrary
// Python and doesn't. So we maintain a one-line look-back: once we drop
// a SyntaxWarning header, we also drop the next non-empty line that
// follows it (the snippet). Applies once per warning so we don't
// accidentally swallow real log lines downstream.
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
    raw.split('\n').filter(line => line.trim() && !line.includes('::LAUNCH::')),
  )
  return stripped
    .map((line) => {
      const cleanLine = stripAnsi(line)

      // Try JSON parsing first
      if (cleanLine.trimStart().startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanLine)
          const logTypeResult = getLogTypeFromJson(parsed)

          // Try to format as Caddy access log
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

          // Other JSON logs — show the msg field if available
          const msg = parsed.msg || parsed.message || cleanLine
          return {
            timestamp: parsed.ts ? new Date(parsed.ts * 1000) : null,
            message: msg,
            rawLine: cleanLine,
            type: logTypeResult,
          }
        } catch {
          // Not valid JSON, fall through
        }
      }

      // Standard text log parsing
      const timestampMatch = cleanLine.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s*/)
      let timestamp: Date | null = null
      let message = cleanLine

      if (timestampMatch) {
        timestamp = new Date(timestampMatch[1].replace(',', '.'))
        message = cleanLine.slice(timestampMatch[0].length)
      }

      // MySQL error log: "0 [System] [MY-013172] [Server] Message..."
      const mysqlMatch = message.match(/^\d+\s+\[(System|Warning|Error|Note)\]\s+(\[MY-\d+\]\s+\[\w+\]\s+)(.*)/)
      if (mysqlMatch) {
        const levelMap: Record<string, LogLine['type']> = { System: 'info', Warning: 'warning', Error: 'error', Note: 'debug' }
        return {
          timestamp,
          message: mysqlMatch[3],
          rawLine: cleanLine,
          type: levelMap[mysqlMatch[1]] || 'info',
        }
      }

      // Supervisor log: "2026-01-29 06:30:30,178 WARN message..."
      const supervisorMatch = message.match(/^(INFO|WARN|CRIT|DEBUG)\s+(.*)/)
      if (supervisorMatch) {
        const levelMap: Record<string, LogLine['type']> = { INFO: 'info', WARN: 'warning', CRIT: 'error', DEBUG: 'debug' }
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

// WebSocket connection
let ws: WebSocket | null = null

const connectWebSocket = async () => {
  if (ws) {
    ws.close()
  }

  isLoading.value = true
  rawLogs.value = ''
  filteredLogs.value = []

  // Wait for auth to be initialized before connecting
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

  let noDataTimeout: NodeJS.Timeout | null = null

  const resetTimeout = () => {
    if (noDataTimeout) clearTimeout(noDataTimeout)
    noDataTimeout = setTimeout(() => {
      isLoading.value = false
    }, 2000)
  }

  ws.onopen = () => {
    wsOpen.value = true
    resetTimeout()
  }

  ws.onmessage = (e) => {
    rawLogs.value += e.data
    isLoading.value = false
    if (noDataTimeout) clearTimeout(noDataTimeout)
  }

  ws.onerror = () => {
    wsOpen.value = false
    isLoading.value = false
    if (noDataTimeout) clearTimeout(noDataTimeout)
  }

  ws.onclose = () => {
    wsOpen.value = false
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
  <div class="flex flex-col flex-1 min-h-0" :class="hideOptions ? '' : 'gap-4'">
    <div class="flex flex-col flex-1 min-h-0" :class="hideOptions ? '' : 'rounded-lg'">
      <div class="flex flex-col flex-1 min-h-0" :class="hideOptions ? '' : 'space-y-4'">
        <div v-if="!hideOptions" class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3">
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

            <Button variant="outline" size="icon" class="h-10 w-10" title="Download logs" :disabled="filteredLogs.length === 0" @click="handleDownload">
              <Icon name="lucide:download" class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref="scrollRef"
          :class="[
            'flex-1 min-h-0 relative overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-4 text-zinc-300',
            containerClassName || 'h-[500px]'
          ]"
          @scroll="handleScroll"
        >
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-zinc-950/80">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-zinc-400" />
          </div>

          <div v-else-if="filteredLogs.length === 0" class="flex h-full items-center justify-center text-zinc-500">
            No logs found
          </div>

          <div class="space-y-1 font-mono text-sm">
            <div
              v-for="(log, index) in filteredLogs"
              :key="index"
              class="flex gap-2"
              :title="log.rawLine !== log.message ? log.rawLine : undefined"
            >
              <span v-if="showTimestamp && log.timestamp" class="shrink-0 text-zinc-500">
                {{ log.timestamp.toLocaleTimeString() }}
              </span>
              <span v-if="log.html" class="whitespace-pre-wrap break-all" v-html="log.html" />
              <span v-else :class="typeColorMap[log.type]" class="whitespace-pre-wrap break-all">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

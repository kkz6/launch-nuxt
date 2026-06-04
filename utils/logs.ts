export type LogType = 'error' | 'warning' | 'success' | 'info' | 'debug'
export type LogVariant = 'red' | 'yellow' | 'green' | 'blue' | 'orange'

export interface LogLine {
  rawTimestamp: string | null
  timestamp: Date | null
  message: string
}

interface LogStyle {
  type: LogType
  variant: LogVariant
  color: string
}

const LOG_STYLES: Record<LogType, LogStyle> = {
  error: {
    type: 'error',
    variant: 'red',
    color: 'bg-red-500/40',
  },
  warning: {
    type: 'warning',
    variant: 'orange',
    color: 'bg-orange-500/40',
  },
  debug: {
    type: 'debug',
    variant: 'yellow',
    color: 'bg-yellow-500/40',
  },
  success: {
    type: 'success',
    variant: 'green',
    color: 'bg-green-500/40',
  },
  info: {
    type: 'info',
    variant: 'blue',
    color: 'bg-blue-600/40',
  },
} as const

export function parseLogs(logString: string): LogLine[] {
  // Regex to match various timestamp formats including Laravel logs [YYYY-MM-DD HH:MM:SS]
  const logRegex =
    /^(?:(\d+)\s+)?(?:\[)?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z| UTC)?)(?:\])?\s*(.*)$/

  const logs: (LogLine | null)[] = logString
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .map((line): LogLine | null => {
      const match = line.match(logRegex)

      // If no timestamp match, treat the entire line as the message
      if (!match) {
        return {
          rawTimestamp: null,
          timestamp: null,
          message: line,
        }
      }

      const [, , timestamp, message] = match

      if (!message?.trim()) return null

      // Remove any additional timestamps from the message (including bracketed ones)
      const cleanedMessage = message
        .replace(/\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z| UTC)?\]?/g, '')
        .trim()

      // Normalize the timestamp string before creating a Date object.
      let parsedTimestamp: Date | null = null
      if (timestamp) {
        let ts = timestamp
        // Remove brackets if present
        ts = ts.replace(/^\[|\]$/g, '')
        if (ts.includes(' UTC')) {
          // Replace " UTC" with "Z" for valid ISO formatting.
          ts = ts.replace(' UTC', 'Z')
        }
        else if (!ts.includes('T') && !ts.includes('Z')) {
          // Replace the space with "T" if the "T" separator is missing.
          ts = ts.replace(' ', 'T') + 'Z'
        }
        parsedTimestamp = new Date(ts)
      }

      return {
        rawTimestamp: timestamp ?? null,
        timestamp: parsedTimestamp,
        message: cleanedMessage,
      }
    })

  return logs.filter((log): log is LogLine => log !== null)
}

// Detect log type based on message content.
export const getLogType = (message: string): LogStyle => {
  const lowerMessage = message.toLowerCase()

  if (
    /(?:^|\s)(?:info|inf|information):?\s/i.test(lowerMessage)
    || /\[(?:info|information)]/i.test(lowerMessage)
    || /\b(?:status|state|current|progress)\b:?\s/i.test(lowerMessage)
    || /\b(?:processing|executing|performing)\b/i.test(lowerMessage)
  ) {
    return LOG_STYLES.info
  }

  if (
    /(?:^|\s)(?:error|err):?\s/i.test(lowerMessage)
    || /\b(?:exception|failed|failure)\b/i.test(lowerMessage)
    || /(?:stack\s?trace):\s*$/i.test(lowerMessage)
    || /^\s*at\s+[\w.]+\s*\(?.+:\d+:\d+\)?/.test(lowerMessage)
    || /\b(?:uncaught|unhandled)\s+(?:exception|error)\b/i.test(lowerMessage)
    || /Error:\s.*(?:in|at)\s+.*:\d+(?::\d+)?/.test(lowerMessage)
    || /\b(?:errno|code):\s*(?:\d+|[A-Z_]+)\b/i.test(lowerMessage)
    || /\[(?:error|err|fatal)\]/i.test(lowerMessage)
    || /\b(?:crash|critical|fatal)\b/i.test(lowerMessage)
    || /\b(?:fail(?:ed|ure)?|broken|dead)\b/i.test(lowerMessage)
  ) {
    return LOG_STYLES.error
  }

  if (
    /(?:^|\s)(?:warning|warn):?\s/i.test(lowerMessage)
    || /\[(?:warn(?:ing)?|attention)\]/i.test(lowerMessage)
    || /(?:deprecated|obsolete)\s+(?:since|in|as\s+of)/i.test(lowerMessage)
    || /\b(?:caution|attention|notice):\s/i.test(lowerMessage)
    || /(?:might|may|could)\s+(?:not|cause|lead\s+to)/i.test(lowerMessage)
    || /(?:!+\s*(?:warning|caution|attention)\s*!+)/i.test(lowerMessage)
    || /\b(?:deprecated|obsolete)\b/i.test(lowerMessage)
    || /\b(?:unstable|experimental)\b/i.test(lowerMessage)
  ) {
    return LOG_STYLES.warning
  }

  if (
    /(?:successfully|complete[d]?)\s+(?:initialized|started|completed|created|done|deployed)/i.test(
      lowerMessage,
    )
    || /\[(?:success|ok|done)\]/i.test(lowerMessage)
    || /(?:listening|running)\s+(?:on|at)\s+(?:port\s+)?\d+/i.test(lowerMessage)
    || /(?:connected|established|ready)\s+(?:to|for|on)/i.test(lowerMessage)
    || /\b(?:loaded|mounted|initialized)\s+successfully\b/i.test(lowerMessage)
    || /✓|√|✅|\[ok\]|done!/i.test(lowerMessage)
    || /\b(?:success(?:ful)?|completed|ready)\b/i.test(lowerMessage)
    || /\b(?:started|starting|active)\b/i.test(lowerMessage)
  ) {
    return LOG_STYLES.success
  }

  if (
    /(?:^|\s)(?:info|inf):?\s/i.test(lowerMessage)
    || /\[(info|log|debug|trace|server|db|api|http|request|response)\]/i.test(lowerMessage)
    || /\b(?:version|config|import|load|get|HTTP|PATCH|POST|debug)\b:?/i.test(lowerMessage)
  ) {
    return LOG_STYLES.debug
  }

  return LOG_STYLES.info
}

// SGR foreground color code → Tailwind text class. Covers the standard
// 8 (30-37) + bright 8 (90-97) that zerolog and most CLIs emit.
const ANSI_FG_CLASS: Record<number, string> = {
  30: 'text-zinc-500',
  31: 'text-red-400',
  32: 'text-green-400',
  33: 'text-yellow-400',
  34: 'text-blue-400',
  35: 'text-purple-400',
  36: 'text-cyan-400',
  37: 'text-zinc-200',
  90: 'text-zinc-500',
  91: 'text-red-300',
  92: 'text-green-300',
  93: 'text-yellow-300',
  94: 'text-blue-300',
  95: 'text-purple-300',
  96: 'text-cyan-300',
  97: 'text-zinc-50',
}

// Parse a line of ANSI/SGR-coded text into safe HTML.
//
// The text is HTML-escaped first (XSS-safe), then each styled run is
// wrapped in its OWN balanced <span> based on the active SGR state. This
// is the important difference from a naive code→tag `.replace()`: a
// combo like zerolog's fatal level (ESC[1m ESC[31m … ESC[0m) opens two
// spans but resets once, so a replace-based converter leaks an unclosed
// <span> and bleeds bold/colour onto the rest of the line. Tracking
// state and emitting self-contained spans per run keeps the markup
// balanced regardless of how codes are combined. Unknown codes
// (backgrounds, underline, etc.) are parsed and dropped, never emitted
// as raw escape text.
export function parseAnsiToHtml(text: string): string {
  if (!text) return ''

  const escape = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // eslint-disable-next-line no-control-regex
  const SGR = /\x1b\[([0-9;]*)m/g
  let html = ''
  let lastIndex = 0
  let color = ''
  let bold = false
  let dim = false

  const classesFor = (): string => {
    const c: string[] = []
    if (color) c.push(color)
    if (bold) c.push('font-bold')
    if (dim) c.push('opacity-70')
    return c.join(' ')
  }
  const emit = (raw: string): void => {
    if (!raw) return
    const cls = classesFor()
    html += cls ? `<span class="${cls}">${escape(raw)}</span>` : escape(raw)
  }

  let m: RegExpExecArray | null
  while ((m = SGR.exec(text)) !== null) {
    emit(text.slice(lastIndex, m.index))
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number)
    for (const code of codes) {
      if (code === 0) {
        color = ''
        bold = false
        dim = false
      } else if (code === 1) {
        bold = true
      } else if (code === 2) {
        dim = true
      } else if (code === 22) {
        bold = false
        dim = false
      } else if (code === 39) {
        color = ''
      } else if (ANSI_FG_CLASS[code]) {
        color = ANSI_FG_CLASS[code]
      }
      // Other codes (backgrounds, underline, italics, etc.) are
      // intentionally consumed without emitting markup.
    }
    lastIndex = SGR.lastIndex
  }
  emit(text.slice(lastIndex))
  return html
}

// Escape regex special characters
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Highlight search term in message
export function highlightSearchTerm(html: string, searchTerm: string): string {
  if (!searchTerm) return html

  const searchRegex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi')
  return html.replace(searchRegex, '<mark class="bg-yellow-200/50 dark:bg-yellow-900/50 rounded px-0.5">$1</mark>')
}

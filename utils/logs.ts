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

// Parse ANSI codes to HTML
export function parseAnsiToHtml(text: string): string {
  if (!text) return ''

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Reset
    .replace(/\x1b\[0m/g, '</span>')
    // Bold
    .replace(/\x1b\[1m/g, '<span class="font-bold">')
    // Colors
    .replace(/\x1b\[30m/g, '<span class="text-zinc-900 dark:text-zinc-100">')
    .replace(/\x1b\[31m/g, '<span class="text-red-400">')
    .replace(/\x1b\[32m/g, '<span class="text-green-400">')
    .replace(/\x1b\[33m/g, '<span class="text-yellow-400">')
    .replace(/\x1b\[34m/g, '<span class="text-blue-400">')
    .replace(/\x1b\[35m/g, '<span class="text-purple-400">')
    .replace(/\x1b\[36m/g, '<span class="text-cyan-400">')
    .replace(/\x1b\[37m/g, '<span class="text-white">')
    // Bright colors
    .replace(/\x1b\[90m/g, '<span class="text-zinc-500">')
    .replace(/\x1b\[91m/g, '<span class="text-red-300">')
    .replace(/\x1b\[92m/g, '<span class="text-green-300">')
    .replace(/\x1b\[93m/g, '<span class="text-yellow-300">')
    .replace(/\x1b\[94m/g, '<span class="text-blue-300">')
    .replace(/\x1b\[95m/g, '<span class="text-purple-300">')
    .replace(/\x1b\[96m/g, '<span class="text-cyan-300">')
    .replace(/\x1b\[97m/g, '<span class="text-zinc-50">')
    // Background colors
    .replace(/\x1b\[4\dm/g, '<span>')
    // Remove any remaining ANSI codes
    .replace(/\x1b\[[0-9;]*m/g, '')

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

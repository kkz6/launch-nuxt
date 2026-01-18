export interface MetricsMemory {
  total: number
  used: number
  free: number
  percent: number
}

export interface MetricsDisk {
  total: number
  used: number
  free: number
  percent: number
}

export interface MetricsData {
  timestamp: string
  cpu: number
  load: [number, number, number]
  memory: MetricsMemory
  disk: MetricsDisk
}

interface MetricsEvent {
  event: 'connected' | 'error' | 'metrics'
  message?: string
  timestamp?: string
  cpu?: number
  load?: [number, number, number]
  memory?: MetricsMemory
  disk?: MetricsDisk
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const MAX_HISTORY_LENGTH = 60

export const useMetricsStream = (serverId: MaybeRef<string>) => {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const metrics = ref<MetricsData | null>(null)
  const history = ref<MetricsData[]>([])
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  const connectionStatus = ref<ConnectionStatus>('disconnected')

  const ws = ref<WebSocket | null>(null)
  const reconnectTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 10
  const baseReconnectDelay = 1000
  const shouldReconnect = ref(true)

  const clearReconnectTimeout = () => {
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value)
      reconnectTimeout.value = null
    }
  }

  const scheduleReconnect = () => {
    if (!shouldReconnect.value || reconnectAttempts.value >= maxReconnectAttempts) {
      if (reconnectAttempts.value >= maxReconnectAttempts) {
        error.value = 'Max reconnection attempts reached'
        connectionStatus.value = 'error'
      }
      return
    }

    clearReconnectTimeout()

    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttempts.value) + Math.random() * 1000,
      30000
    )

    console.log(`[MetricsStream] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.value + 1})`)

    reconnectTimeout.value = setTimeout(() => {
      reconnectAttempts.value++
      connect()
    }, delay)
  }

  const connect = () => {
    if (import.meta.server) return

    const serverIdValue = toValue(serverId)
    if (!serverIdValue || !token.value) {
      error.value = 'Missing server ID or authentication token'
      connectionStatus.value = 'error'
      return
    }

    if (ws.value?.readyState === WebSocket.OPEN) {
      return
    }

    if (ws.value) {
      ws.value.close()
    }

    shouldReconnect.value = true
    connectionStatus.value = 'connecting'
    error.value = null

    const wsBase = config.public.wsBase as string
    const wsUrl = `${wsBase}/metrics/stream?serverId=${serverIdValue}&token=${token.value}`

    console.log('[MetricsStream] Connecting...')

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('[MetricsStream] WebSocket opened')
    }

    ws.value.onmessage = (event) => {
      try {
        const data: MetricsEvent = JSON.parse(event.data)

        if (data.event === 'connected') {
          console.log('[MetricsStream] Connected')
          isConnected.value = true
          connectionStatus.value = 'connected'
          reconnectAttempts.value = 0
          error.value = null
        } else if (data.event === 'error') {
          console.error('[MetricsStream] Error:', data.message)
          error.value = data.message || 'Unknown error'
          connectionStatus.value = 'error'
        } else if (data.event === 'metrics') {
          const metricsData: MetricsData = {
            timestamp: data.timestamp || new Date().toISOString(),
            cpu: data.cpu || 0,
            load: data.load || [0, 0, 0],
            memory: data.memory || { total: 0, used: 0, free: 0, percent: 0 },
            disk: data.disk || { total: 0, used: 0, free: 0, percent: 0 },
          }

          metrics.value = metricsData

          history.value = [...history.value, metricsData].slice(-MAX_HISTORY_LENGTH)
        }
      } catch (err) {
        console.error('[MetricsStream] Failed to parse message:', err)
      }
    }

    ws.value.onclose = () => {
      console.log('[MetricsStream] Disconnected')
      isConnected.value = false

      if (connectionStatus.value !== 'error') {
        connectionStatus.value = 'disconnected'
      }

      if (shouldReconnect.value) {
        scheduleReconnect()
      }
    }

    ws.value.onerror = (err) => {
      console.error('[MetricsStream] WebSocket error:', err)
      error.value = 'Connection error'
    }
  }

  const disconnect = () => {
    console.log('[MetricsStream] Disconnecting...')
    shouldReconnect.value = false
    clearReconnectTimeout()
    reconnectAttempts.value = 0

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    isConnected.value = false
    connectionStatus.value = 'disconnected'
  }

  const clearHistory = () => {
    history.value = []
    metrics.value = null
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    metrics,
    history,
    isConnected,
    error,
    connectionStatus,
    connect,
    disconnect,
    clearHistory,
  }
}

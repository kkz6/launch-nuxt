interface ServiceStatus {
  id: string
  software: string
  name: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  is_active: boolean
  memory?: string
  uptime?: string
  pid?: number
  error?: string
}

interface StatusMessage {
  event: 'service.status' | 'error'
  services?: ServiceStatus[]
  message?: string
}

interface UseServiceStatusOptions {
  serverId: string
  serviceId?: string
  interval?: number
  autoConnect?: boolean
}

export function useServiceStatus(options: UseServiceStatusOptions) {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const services = ref<ServiceStatus[]>([])
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(null)

  let ws: WebSocket | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  const wsBase = computed(() => config.public.wsBase as string)

  const connect = () => {
    if (ws?.readyState === WebSocket.OPEN || isConnecting.value) {
      return
    }

    if (!token.value) {
      error.value = 'Authentication required'
      return
    }

    isConnecting.value = true
    error.value = null

    const params = new URLSearchParams({
      serverId: options.serverId,
      interval: (options.interval || 5).toString(),
      token: token.value,
    })

    if (options.serviceId) {
      params.set('serviceId', options.serviceId)
    }

    const wsUrl = `${wsBase.value}/services/status?${params}`

    try {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts = 0
        error.value = null
      }

      ws.onmessage = (event) => {
        try {
          const data: StatusMessage = JSON.parse(event.data)

          if (data.event === 'error') {
            error.value = data.message || 'Unknown error'
            return
          }

          if (data.event === 'service.status' && data.services) {
            services.value = data.services
            lastUpdated.value = new Date()
            error.value = null
          }
        } catch {
          console.error('Failed to parse WebSocket message')
        }
      }

      ws.onerror = () => {
        error.value = 'Connection error'
        isConnecting.value = false
      }

      ws.onclose = (event) => {
        isConnected.value = false
        isConnecting.value = false
        ws = null

        // Don't reconnect if closed cleanly or max attempts reached
        if (event.code === 1000 || reconnectAttempts >= maxReconnectAttempts) {
          if (reconnectAttempts >= maxReconnectAttempts) {
            error.value = 'Connection lost. Click to reconnect.'
          }
          return
        }

        // Exponential backoff reconnect
        const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000)
        reconnectAttempts++

        reconnectTimeout = setTimeout(() => {
          connect()
        }, delay)
      }
    } catch {
      isConnecting.value = false
      error.value = 'Failed to connect'
    }
  }

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (ws) {
      ws.close(1000)
      ws = null
    }

    isConnected.value = false
    isConnecting.value = false
    reconnectAttempts = 0
  }

  const reconnect = () => {
    reconnectAttempts = 0
    error.value = null
    disconnect()
    connect()
  }

  // Get status for a specific service by ID
  const getServiceStatus = (serviceId: string) => {
    return services.value.find(s => s.id === serviceId)
  }

  // Auto-connect on mount if enabled
  if (options.autoConnect !== false) {
    onMounted(() => {
      connect()
    })
  }

  // Cleanup on unmount (only if called within a component)
  if (getCurrentInstance()) {
    onUnmounted(() => {
      disconnect()
    })
  }

  return {
    services,
    isConnected,
    isConnecting,
    error,
    lastUpdated,
    connect,
    disconnect,
    reconnect,
    getServiceStatus,
  }
}

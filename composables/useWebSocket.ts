type EventHandler = (data: unknown) => void

interface WebSocketMessage {
  channel: string
  event: string
  data: {
    id: string
    model: string
    action: 'created' | 'updated' | 'deleted'
    team_id: string
    server_id?: string
    site_id?: string
    [key: string]: unknown
  }
}

// Global state for WebSocket connection (singleton pattern)
const ws = ref<WebSocket | null>(null)
const isConnected = ref(false)
const handlers = ref<Map<string, Set<EventHandler>>>(new Map())
const reconnectTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 10
const baseReconnectDelay = 1000 // 1 second

export const useWebSocket = () => {
  const config = useRuntimeConfig()
  const { token, isInitialized, waitForAuth } = useAuth()

  const connect = async () => {
    // Skip on server
    if (import.meta.server) return

    // Wait for auth to be initialized
    await waitForAuth()

    // Don't connect if no token
    if (!token.value) return

    // Don't reconnect if already connected
    if (ws.value?.readyState === WebSocket.OPEN) return

    // Close existing connection if any
    if (ws.value) {
      ws.value.close()
    }

    const wsBase = config.public.wsBase as string
    const wsUrl = `${wsBase}/ws?token=${token.value}`

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('[WebSocket] Connected')
      isConnected.value = true
      reconnectAttempts.value = 0
    }

    ws.value.onmessage = (e) => {
      try {
        const message: WebSocketMessage = JSON.parse(e.data)
        const { event, data } = message

        // Call all handlers registered for this event
        const eventHandlers = handlers.value.get(event)
        if (eventHandlers) {
          eventHandlers.forEach((handler) => handler(data))
        }

        // Also call wildcard handlers
        const wildcardHandlers = handlers.value.get('*')
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => handler({ event, data }))
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err)
      }
    }

    ws.value.onclose = () => {
      console.log('[WebSocket] Disconnected')
      isConnected.value = false
      scheduleReconnect()
    }

    ws.value.onerror = (err) => {
      console.error('[WebSocket] Error:', err)
    }
  }

  const scheduleReconnect = () => {
    // Don't reconnect if no token or max attempts reached
    if (!token.value || reconnectAttempts.value >= maxReconnectAttempts) {
      return
    }

    // Clear any existing timeout
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value)
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttempts.value) + Math.random() * 1000,
      30000, // Max 30 seconds
    )

    console.log(`[WebSocket] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.value + 1})`)

    reconnectTimeout.value = setTimeout(() => {
      reconnectAttempts.value++
      connect()
    }, delay)
  }

  const disconnect = () => {
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value)
      reconnectTimeout.value = null
    }

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    isConnected.value = false
  }

  const subscribe = (event: string, handler: EventHandler): (() => void) => {
    if (!handlers.value.has(event)) {
      handlers.value.set(event, new Set())
    }
    handlers.value.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      handlers.value.get(event)?.delete(handler)
    }
  }

  const subscribeToChannel = (channel: string) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        action: 'subscribe',
        channel,
      }))
    }
  }

  const unsubscribeFromChannel = (channel: string) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        action: 'unsubscribe',
        channel,
      }))
    }
  }

  // Auto-connect when auth is initialized and token is available
  watch([isInitialized, token], ([initialized, newToken]) => {
    if (initialized && newToken) {
      connect()
    } else if (initialized && !newToken) {
      disconnect()
    }
  }, { immediate: true })

  return {
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    subscribe,
    subscribeToChannel,
    unsubscribeFromChannel,
  }
}

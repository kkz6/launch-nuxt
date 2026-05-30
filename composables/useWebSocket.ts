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

// Reference count per channel. Many components can call
// subscribeToChannel('team.X') concurrently (the servers index page,
// the provision-logs sheet, the navbar banner, etc.) — we must only
// send the wire-level `subscribe` once, and only send `unsubscribe`
// when the LAST local listener goes away. Without this refcount, the
// first component to unmount would remove the client from the channel
// at the hub, even though other components still wanted events. This
// caused the "server.deleted event never arrives" symptom: 6 subscribes
// + 2 unsubscribes within 30ms killed the team-channel subscription.
const channelRefCounts = new Map<string, number>()

export const useWebSocket = () => {
  const config = useRuntimeConfig()
  const { token, isInitialized, waitForAuth } = useAuth()
  const { getCurrentTeamId } = useApi()

  const connect = async () => {
    // Skip on server
    if (import.meta.server) return

    // Wait for auth to be initialized
    await waitForAuth()

    // Don't connect if no token
    if (!token.value) return

    // Don't reconnect if already connected or connecting
    if (ws.value?.readyState === WebSocket.OPEN || ws.value?.readyState === WebSocket.CONNECTING) return

    // Close existing connection if any
    if (ws.value) {
      ws.value.close()
    }

    const wsBase = config.public.wsBase as string
    const teamId = getCurrentTeamId()
    const wsUrl = `${wsBase}/ws?token=${token.value}${teamId ? `&team_id=${teamId}` : ''}`

    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log('[WebSocket] Connected')
      isConnected.value = true
      reconnectAttempts.value = 0

      // Re-send subscribe for every channel that still has live local
      // listeners. Otherwise on reconnect (or after the API restarts),
      // the hub-side subscription is gone and we silently stop getting
      // events even though our components still expect them.
      for (const channel of channelRefCounts.keys()) {
        ws.value?.send(JSON.stringify({
          action: 'subscribe',
          channel,
        }))
      }
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

  const reconnect = () => {
    // Force reconnection (useful when team changes)
    disconnect()
    reconnectAttempts.value = 0
    connect()
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
    const before = channelRefCounts.get(channel) ?? 0
    channelRefCounts.set(channel, before + 1)
    // Only send the wire-level subscribe on the first listener.
    if (before === 0 && ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        action: 'subscribe',
        channel,
      }))
    }
  }

  const unsubscribeFromChannel = (channel: string) => {
    const before = channelRefCounts.get(channel) ?? 0
    if (before <= 0) return
    const after = before - 1
    if (after === 0) {
      channelRefCounts.delete(channel)
      // Only send the wire-level unsubscribe when the last listener
      // goes away. See the comment on channelRefCounts above.
      if (ws.value?.readyState === WebSocket.OPEN) {
        ws.value.send(JSON.stringify({
          action: 'unsubscribe',
          channel,
        }))
      }
    } else {
      channelRefCounts.set(channel, after)
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

  // Bring the connection back when conditions change.
  //
  // Without this, after `maxReconnectAttempts` consecutive failures the
  // client gives up forever — and the tab silently stops receiving
  // events with no UI signal. Real-world trigger that surfaced this:
  // the API process is restarted (deploy, dev restart, OS sleep),
  // backoff exhausts during the few minutes it takes to come back up,
  // and from then on every "deploying / deployed / failed" event lands
  // on a dead socket. The user sees a frozen page until manual reload.
  //
  // We treat three signals as "operator just asked us to retry":
  //   - the tab regains focus (`visibilitychange` -> visible)
  //   - the OS regains network (`online`)
  //   - the user clicks a manual reconnect affordance somewhere (kickReconnect)
  // On any of them, reset the attempt counter so backoff starts fresh
  // and immediately call connect(). connect() is idempotent — it's a
  // no-op while OPEN/CONNECTING, so spamming this is safe.
  if (import.meta.client) {
    const wake = () => {
      if (ws.value?.readyState === WebSocket.OPEN) return
      reconnectAttempts.value = 0
      if (reconnectTimeout.value) {
        clearTimeout(reconnectTimeout.value)
        reconnectTimeout.value = null
      }
      void connect()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake()
    }
    // Listeners installed once per composable invocation. We don't
    // remove them on unmount on purpose — useWebSocket is a singleton
    // pattern; the connection outlives any one component instance.
    window.addEventListener('visibilitychange', onVisibility, { passive: true })
    window.addEventListener('online', wake, { passive: true })
  }

  // Exposed so a UI banner ("Live updates paused — click to retry")
  // has something to call without reimplementing the wake logic.
  const kickReconnect = () => {
    reconnectAttempts.value = 0
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value)
      reconnectTimeout.value = null
    }
    void connect()
  }

  return {
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    reconnect,
    kickReconnect,
    subscribe,
    subscribeToChannel,
    unsubscribeFromChannel,
  }
}

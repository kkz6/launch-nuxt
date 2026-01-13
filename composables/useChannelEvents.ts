interface ChannelEventData {
  site_id?: string
  server_id?: string
  command_id?: string
  status?: string
  error?: string
  [key: string]: unknown
}

interface ChannelEventHandler {
  (data: ChannelEventData): void
}

/**
 * Composable to subscribe to channel-based events
 *
 * @param channel - The channel to subscribe to (e.g., 'site.{siteId}')
 * @param events - Array of event names to listen for
 * @param onEvent - Callback to run when any matching event is received
 *
 * @example
 * // Listen to command events for a specific site
 * useChannelEvents(
 *   `site.${siteId}`,
 *   ['command.running', 'command.finished', 'command.failed'],
 *   (data) => {
 *     console.log('Command event:', data)
 *     fetchCommands()
 *   }
 * )
 */
export const useChannelEvents = (
  channel: string | Ref<string>,
  events: string[] | Ref<string[]>,
  onEvent: ChannelEventHandler,
) => {
  const { subscribe, subscribeToChannel, unsubscribeFromChannel, isConnected } = useWebSocket()

  const channelValue = computed(() => unref(channel))
  const eventsValue = computed(() => unref(events))

  // Store unsubscribe functions
  const unsubscribes: (() => void)[] = []
  let subscribedChannel: string | null = null

  const setupSubscriptions = () => {
    // Clean up previous subscriptions
    cleanup()

    // Subscribe to the channel
    if (isConnected.value && channelValue.value) {
      subscribeToChannel(channelValue.value)
      subscribedChannel = channelValue.value
    }

    // Subscribe to each event
    eventsValue.value.forEach((event) => {
      const unsub = subscribe(event, (data) => {
        const eventData = data as ChannelEventData
        // Filter by channel context (site_id or server_id)
        const channelParts = channelValue.value.split('.')
        if (channelParts[0] === 'site' && eventData.site_id === channelParts[1]) {
          onEvent(eventData)
        } else if (channelParts[0] === 'server' && eventData.server_id === channelParts[1]) {
          onEvent(eventData)
        } else {
          // For other channels or when no filtering needed
          onEvent(eventData)
        }
      })
      unsubscribes.push(unsub)
    })
  }

  const cleanup = () => {
    // Unsubscribe from channel
    if (subscribedChannel) {
      unsubscribeFromChannel(subscribedChannel)
      subscribedChannel = null
    }

    // Unsubscribe from events
    unsubscribes.forEach((unsub) => unsub())
    unsubscribes.length = 0
  }

  // Setup when connected and channel changes
  watch([isConnected, channelValue], () => {
    if (isConnected.value) {
      setupSubscriptions()
    }
  }, { immediate: true })

  // Clean up on unmount
  onUnmounted(cleanup)

  return {
    isConnected,
  }
}

/**
 * Composable to subscribe to site command events
 * Convenience wrapper for command-related events
 *
 * @param siteId - The site ID
 * @param onEvent - Callback to run when a command event is received
 *
 * @example
 * useSiteCommandEvents(siteId, (data) => {
 *   if (data.status === 'finished') {
 *     toast.success('Command completed')
 *   }
 *   fetchCommands()
 * })
 */
export const useSiteCommandEvents = (
  siteId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const siteIdValue = computed(() => unref(siteId))
  const channel = computed(() => `site.${siteIdValue.value}`)

  return useChannelEvents(
    channel,
    ['command.running', 'command.finished', 'command.failed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to site deployment events
 *
 * @param siteId - The site ID
 * @param onEvent - Callback to run when a deployment event is received
 */
export const useSiteDeploymentEvents = (
  siteId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const siteIdValue = computed(() => unref(siteId))
  const channel = computed(() => `site.${siteIdValue.value}`)

  return useChannelEvents(
    channel,
    ['deployment.started', 'deployment.finished', 'deployment.failed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to site queue events
 *
 * @param siteId - The site ID
 * @param onEvent - Callback to run when a queue event is received
 */
export const useSiteQueueEvents = (
  siteId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const siteIdValue = computed(() => unref(siteId))
  const channel = computed(() => `site.${siteIdValue.value}`)

  return useChannelEvents(
    channel,
    ['queue.created', 'queue.updated', 'queue.deleted', 'queue.restarted'],
    onEvent,
  )
}

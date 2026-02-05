interface ChannelEventData {
  site_id?: string
  server_id?: string
  team_id?: string
  deployment_id?: string
  command_id?: string
  status?: string
  message?: string
  error?: string
  site?: {
    id?: string
    server_id?: string
    [key: string]: unknown
  }
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
        // Filter by channel context (site_id, server_id, or team_id)
        const channelParts = channelValue.value.split('.')
        if (channelParts[0] === 'site' && eventData.site_id === channelParts[1]) {
          onEvent(eventData)
        } else if (channelParts[0] === 'server' && eventData.server_id === channelParts[1]) {
          onEvent(eventData)
        } else if (channelParts[0] === 'team' && eventData.team_id === channelParts[1]) {
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

  // Clean up on unmount (only if called within a component)
  if (getCurrentInstance()) {
    onUnmounted(cleanup)
  }

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
 * Composable to subscribe to deployment events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a deployment event is received
 */
export const useDeploymentEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'deployment.progress',
      'deployment.rollback.started',
      'deployment.rollback.completed',
      'deployment.rollback.failed',
    ],
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

/**
 * Composable to subscribe to site lifecycle events (created, updated, deleted, installed)
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a site event is received
 */
export const useSiteEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['site.created', 'site.updated', 'site.deleted', 'site.installed', 'site.installation_failed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to script execution events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a script execution event is received
 *
 * Events:
 * - script.execution.started: Execution began (data: { execution_id, script_id, server_id })
 * - script.output: Incremental output chunk (data: { execution_id, output })
 * - script.execution.completed: Execution finished (data: { execution_id, status, exit_code })
 */
export const useScriptExecutionEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['script.execution.started', 'script.output', 'script.execution.completed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to server lifecycle and provision events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a server event is received
 *
 * Events:
 * - server.created: New server was created
 * - server.updated: Server was updated
 * - server.deleted: Server was deleted
 * - server.provisioning: Server provisioning started
 * - server.provision_progress: Provisioning progress update
 * - server.provision_step: A provision step completed
 * - server.provision_status: Provision status message update
 * - server.provision_failed: Provisioning failed
 * - server.software_installed: Software installation completed
 */
export const useServerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'server.created',
      'server.updated',
      'server.deleted',
      'server.connected',
      'server.provisioned',
      'server.provisioning',
      'server.provision_progress',
      'server.provision_step',
      'server.provision_status',
      'server.provision_failed',
      'server.software_installed',
    ],
    onEvent,
  )
}

/**
 * Composable to subscribe to PHP extension events
 *
 * @param serverId - The server ID
 * @param onEvent - Callback to run when a PHP extension event is received
 *
 * Events:
 * - php.extension_installed: Extension was installed successfully
 * - php.extension_uninstalled: Extension was uninstalled successfully
 */
export const usePhpExtensionEvents = (
  serverId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const serverIdValue = computed(() => unref(serverId))
  const channel = computed(() => `server.${serverIdValue.value}`)

  return useChannelEvents(
    channel,
    ['php.extension_installed', 'php.extension_uninstalled'],
    onEvent,
  )
}

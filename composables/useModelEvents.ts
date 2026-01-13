interface ModelEventData {
  id: string
  model: string
  action: 'created' | 'updated' | 'deleted'
  team_id: string
  server_id?: string
  site_id?: string
  [key: string]: unknown
}

type FilterFn = (data: ModelEventData) => boolean

/**
 * Composable to subscribe to model events (created, updated, deleted)
 *
 * @param modelName - The model name (e.g., 'cron', 'daemon', 'server')
 * @param filterFn - Function to filter events (e.g., by server_id)
 * @param onEvent - Callback to run when a matching event is received
 *
 * @example
 * // Listen to all cron events for a specific server
 * useModelEvents(
 *   'cron',
 *   (data) => data.server_id === serverId,
 *   () => fetchData()
 * )
 */
export const useModelEvents = (
  modelName: string | Ref<string>,
  filterFn: FilterFn | Ref<FilterFn>,
  onEvent: () => void,
) => {
  const { subscribe } = useWebSocket()

  const modelNameValue = computed(() => unref(modelName))
  const filterFnValue = computed(() => unref(filterFn))

  // Store unsubscribe functions
  const unsubscribes: (() => void)[] = []

  const setupSubscriptions = () => {
    // Clean up previous subscriptions
    unsubscribes.forEach((unsub) => unsub())
    unsubscribes.length = 0

    const events = [
      `${modelNameValue.value}.created`,
      `${modelNameValue.value}.updated`,
      `${modelNameValue.value}.deleted`,
    ]

    events.forEach((event) => {
      const unsub = subscribe(event, (data) => {
        if (filterFnValue.value(data as ModelEventData)) {
          onEvent()
        }
      })
      unsubscribes.push(unsub)
    })
  }

  // Setup subscriptions immediately and when model name changes
  watch(modelNameValue, () => {
    setupSubscriptions()
  }, { immediate: true })

  // Clean up on unmount
  onUnmounted(() => {
    unsubscribes.forEach((unsub) => unsub())
  })
}

/**
 * Composable to subscribe to multiple model events
 *
 * @param models - Array of model configurations
 *
 * @example
 * useMultipleModelEvents([
 *   { model: 'cron', filter: (d) => d.server_id === serverId, onEvent: fetchCrons },
 *   { model: 'daemon', filter: (d) => d.server_id === serverId, onEvent: fetchDaemons },
 * ])
 */
export const useMultipleModelEvents = (
  models: Array<{
    model: string
    filter: FilterFn
    onEvent: () => void
  }>,
) => {
  models.forEach(({ model, filter, onEvent }) => {
    useModelEvents(model, filter, onEvent)
  })
}

/**
 * Composable to subscribe to server-related model events
 * Convenience wrapper that filters by server_id
 *
 * @param modelName - The model name
 * @param serverId - The server ID to filter by
 * @param onEvent - Callback to run when a matching event is received
 */
export const useServerModelEvents = (
  modelName: string | Ref<string>,
  serverId: string | Ref<string>,
  onEvent: () => void,
) => {
  const serverIdValue = computed(() => unref(serverId))

  useModelEvents(
    modelName,
    (data) => data.server_id === serverIdValue.value,
    onEvent,
  )
}

/**
 * Composable to subscribe to site-related model events
 * Convenience wrapper that filters by site_id
 *
 * @param modelName - The model name
 * @param siteId - The site ID to filter by
 * @param onEvent - Callback to run when a matching event is received
 */
export const useSiteModelEvents = (
  modelName: string | Ref<string>,
  siteId: string | Ref<string>,
  onEvent: () => void,
) => {
  const siteIdValue = computed(() => unref(siteId))

  useModelEvents(
    modelName,
    (data) => data.site_id === siteIdValue.value,
    onEvent,
  )
}

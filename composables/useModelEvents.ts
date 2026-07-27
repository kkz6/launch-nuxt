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

export const useModelEvents = (
  modelName: string | Ref<string>,
  filterFn: FilterFn | Ref<FilterFn>,
  onEvent: () => void,
) => {
  const { subscribe } = useWebSocket()

  const modelNameValue = computed(() => unref(modelName))
  const filterFnValue = computed(() => unref(filterFn))

  const unsubscribes: (() => void)[] = []

  const setupSubscriptions = () => {
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

  watch(
    modelNameValue,
    () => {
      setupSubscriptions()
    },
    { immediate: true },
  )

  tryOnUnmounted(() => {
    unsubscribes.forEach((unsub) => unsub())
    unsubscribes.length = 0
  })
}

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

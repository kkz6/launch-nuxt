import { defineStore } from 'pinia'
import { effectScope } from 'vue'
import { serverService } from '~/services/serverService'
import type { Server } from '~/types'

/**
 * Single source of truth for the team's servers.
 *
 * Why this exists
 * ---------------
 * Before this store, every component that needed live server updates
 * (servers index page, provision-logs sheet, server-detail page,
 * navbar banner, sidebar count, etc.) called `useServerEvents(teamId, cb)`
 * and ran its own fetch+merge logic. That meant:
 *
 *  - N independent WebSocket subscriptions for the same team channel.
 *    Each one fired a wire-level subscribe; any one unmounting fired an
 *    unsubscribe that broke the others (fixed downstream by ref-counting
 *    in useWebSocket, but it's an entire class of bug we can avoid).
 *  - N independent fetches on every event. With ~25 events per provision,
 *    that's hundreds of HTTP round-trips for nothing — the data is the
 *    same for all consumers.
 *  - N independent merge implementations. The one in pages/servers/
 *    index.vue did partial merges that lost reactivity on nested fields
 *    (the "stuck on first step" bug), while ProvisionLogsSheet did a
 *    full replace, etc.
 *
 * After this store, components just `useServersStore()` and read
 * `servers.value`. The store owns one WS subscription (lazy, started on
 * first use) and applies inbound events to its single state tree.
 *
 * Subscription lifecycle
 * ----------------------
 * - The store subscribes on `ensureSubscribed()`, which is idempotent.
 * - Consumers don't need to call it themselves — `fetchAll()` calls it
 *   for them. If a component renders before any fetch (uncommon), it
 *   can call `ensureSubscribed()` directly.
 * - There's no `unsubscribe()` because the store lives for the session.
 *   The underlying WS connection handles team switches by reconnecting
 *   (the URL contains the team_id), at which point we re-fetch.
 */
export const useServersStore = defineStore('servers', () => {
  const servers = ref<Server[]>([])
  const isLoading = ref(false)
  const hasFetched = ref(false)
  let subscribed = false
  // Own effect scope for the WS subscription. useServerEvents registers
  // cleanup via onScopeDispose; without our own scope it would attach
  // to whichever component happened to be active when ensureSubscribed
  // was called, and dispose when THAT component unmounted — killing
  // the subscription for everyone else.
  let subscriptionScope: ReturnType<typeof effectScope> | null = null

  // --- Reactive getters ---------------------------------------------------

  const getById = (id: string) => computed(() => servers.value.find(s => s.id === id))

  const byStatus = (status: Server['status']) => computed(() =>
    servers.value.filter(s => s.status === status),
  )

  // --- Mutations (applied by both HTTP fetch and WS events) ---------------

  /**
   * Apply a fresh full list (from an HTTP fetch). Preserves object
   * identity per ID where possible so `:key`-based v-for diffs don't
   * thrash, but the final order matches the response (newest first —
   * the API sorts created_at DESC).
   *
   * Earlier version mutated in place and only appended new IDs, which
   * pinned the existing rows at their original positions and dropped
   * freshly-created servers at the bottom of the list.
   */
  const replaceAll = (next: Server[]) => {
    const currentById = new Map(servers.value.map(s => [s.id, s]))
    const merged = next.map((incoming) => {
      const existing = currentById.get(incoming.id)
      if (existing) {
        Object.assign(existing, incoming)
        return existing
      }
      return incoming
    })
    servers.value.splice(0, servers.value.length, ...merged)
  }

  /** Insert a single server if it's not already present. */
  const upsert = (server: Partial<Server> & { id: string }) => {
    const existing = servers.value.find(s => s.id === server.id)
    if (existing) {
      Object.assign(existing, server)
    } else if (isFullServer(server)) {
      servers.value.push(server)
    }
    // If we received a partial update for a server we don't have yet,
    // the next fetchAll() (or the WS that follows) will reconcile it.
  }

  /** Remove a server by ID. No-op if not present. */
  const remove = (id: string) => {
    const idx = servers.value.findIndex(s => s.id === id)
    if (idx !== -1) servers.value.splice(idx, 1)
  }

  /**
   * Apply a partial update to an existing server. Used by provision-flow
   * events that only carry deltas (progress, status, error message).
   */
  const patch = (id: string, fields: Partial<Server>) => {
    const target = servers.value.find(s => s.id === id)
    if (target) Object.assign(target, fields)
  }

  // --- HTTP fetch ---------------------------------------------------------

  const fetchAll = async () => {
    ensureSubscribed()
    isLoading.value = true
    try {
      const response = await serverService.list()
      replaceAll(response.data)
      hasFetched.value = true
    } finally {
      isLoading.value = false
    }
  }

  // --- WS subscription ---------------------------------------------------

  /**
   * Subscribe to the team's server events exactly once. The store calls
   * this from `fetchAll()` but it's also exported so a component can
   * render before any fetch happens.
   */
  const ensureSubscribed = () => {
    if (subscribed) return
    subscribed = true

    subscriptionScope = effectScope(true) // detached: lives with the store
    subscriptionScope.run(() => {
      const { user } = useAuth()
      const teamId = computed(() => user.value?.current_team_id?.toString() || '')

      useServerEvents(teamId, (data, event) => {
        onServerEvent(event, data)
      })
    })
  }

  /**
   * Apply a single WS event to local state. Centralizing this here is
   * the whole point of the store — every component used to re-fetch on
   * every event, which was wasteful and bug-prone.
   *
   * For events that only mutate a single field (progress, status), we
   * apply the delta inline. For events that imply a wider state change
   * we don't have data for (e.g. server.created without the full row),
   * we fall back to a debounced fetchAll().
   */
  const onServerEvent = (event: string, data: Record<string, unknown>) => {
    const id = data.server_id as string | undefined

    switch (event) {
      case 'server.deleted':
        if (id) remove(id)
        return

      case 'server.deletion_failed':
        // Backend stopped deleting; revert the "deleting" status badge
        // so the user sees the server is still there.
        if (id) patch(id, { status: 'failed' })
        scheduleRefetch()
        return

      case 'server.create_failed':
      case 'server.connection_failed':
      case 'server.provision_failed':
      case 'server.provision_timeout':
        // Terminal failure events. Flip the status badge immediately —
        // the 300ms refetch is too long for a status that the user is
        // actively staring at. Refetch in the background to pull the
        // friendly error message and any related fields.
        if (id) patch(id, { status: 'failed' })
        scheduleRefetch()
        return

      case 'server.provision_progress':
        if (id && typeof data.progress === 'number') {
          patch(id, { progress: data.progress })
        }
        return

      case 'server.provision_step':
        // Patch `progress_step` inline so the ProvisionLogsSheet's
        // watcher (which keys on `progress_step`) fires immediately.
        // Previously this event fell into the default-case
        // `scheduleRefetch()` which fired a 300ms-debounced GET /servers,
        // and the sheet then did *another* 300ms-debounced GET
        // /servers/:id/provision-status off the resulting store change.
        // With rapid step bursts (Configure Swap → Firewall →
        // Essential Packages can fire within ~1s on a fast box) the
        // chained debouncing collapsed multiple updates into one and
        // the "current step" indicator looked stuck.
        //
        // The list-endpoint response doesn't include the full
        // completed_provision_steps array — that lives on the
        // provision-status endpoint which the sheet pulls. So we just
        // bump `progress_step` to invalidate the watcher; the sheet
        // re-fetches the proper step list (with timestamps + status)
        // off its own watcher.
        if (id && typeof data.step === 'string') {
          patch(id, { progress_step: data.step })
          // Also kick the background refetch so status (e.g.
          // provisioning → running on the last step) reconciles.
          scheduleRefetch()
        }
        return

      case 'server.software_installed':
        // Same shape as provision_step but for the trailing "Installing
        // Docker / Traefik / Launch Agent" pseudo-steps. The sheet
        // refetches its status off any `progress_step` change, so
        // stamping a synthetic value here is enough to trigger it.
        if (id && typeof data.software === 'string') {
          patch(id, { progress_step: `software:${data.software}` })
          scheduleRefetch()
        }
        return

      case 'server.provisioning':
        // Provision job has started. Flip status badge immediately so
        // the spinner/banner shows the moment the user clicks
        // Provision. The refetch picks up any extra fields the backend
        // stamped (e.g. progress=0).
        if (id) patch(id, { status: 'provisioning' })
        scheduleRefetch()
        return

      case 'server.provisioned':
      case 'server.connected':
        // Terminal-success states. Flip status inline; refetch for the
        // full row (provisioned_at, public_ip changes, etc.).
        if (id) patch(id, { status: 'running' })
        scheduleRefetch()
        return

      case 'server.created':
      case 'server.updated':
      case 'server.unarchived':
        // These should ideally carry the full updated row, but the
        // backend currently sometimes sends only the id. Refetch for now —
        // can be replaced with a per-event mutation when backend payloads
        // stabilize.
        scheduleRefetch()
        return

      default:
        // Catch-all for the rest of the lifecycle events. They imply a
        // status change we don't have data for inline.
        scheduleRefetch()
    }
  }

  // Debounce so a burst of WS events during provisioning collapses into
  // one HTTP call. Same effect the old per-component setTimeout had,
  // but now only one timer exists for the whole app.
  let refetchTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleRefetch = () => {
    if (refetchTimer) clearTimeout(refetchTimer)
    refetchTimer = setTimeout(() => {
      refetchTimer = null
      // Don't pile up loading spinners on background refreshes.
      void backgroundRefetch()
    }, 300)
  }

  const backgroundRefetch = async () => {
    try {
      const response = await serverService.list()
      replaceAll(response.data)
    } catch {
      // Silent — the next interactive fetch will surface errors.
    }
  }

  return {
    // state
    servers,
    isLoading,
    hasFetched,
    // getters
    getById,
    byStatus,
    // actions
    fetchAll,
    ensureSubscribed,
    upsert,
    remove,
    patch,
  }
})

function isFullServer(s: Partial<Server> & { id: string }): s is Server {
  // Best-effort check — the API's Server type has many optional fields,
  // but `name` and `provider` are always present on a real record.
  return typeof s.name === 'string' && typeof s.provider === 'string'
}

/**
 * useNow — process-wide reactive `now` ref(s) that tick on a fixed
 * cadence. Sharing one timer per cadence across every component that
 * wants a live "X ago" / elapsed badge keeps the cost flat no matter
 * how many date rows are on screen (a Containers list with 50 rows
 * used to either re-fetch the page or accept stale "just now" labels
 * forever).
 *
 * Usage from a component:
 *
 *     const now = useNow()        // 30s cadence (default)
 *     const live = useNow(1000)   // 1s cadence, for live timers
 *     const relative = computed(() => formatDistance(props.date, now.value))
 *
 * Each distinct `intervalMs` gets its own shared ref + interval, so a
 * caller that asks for 1s really gets 1s — earlier versions handed
 * every caller the first ref that was ever created, silently ignoring
 * the requested cadence.
 *
 * Timers are created lazily on the client only (Nuxt SSR runs module
 * code in Node, where we never want a stray setInterval). They live
 * for the lifetime of the page — there's never a moment we want them
 * to stop.
 *
 * The 30s default is a balance for ambient "X minutes ago" labels:
 * granular enough to feel live, sparse enough that we're not waking
 * the main thread every second. Live timers (running deployments,
 * fresh timestamps) opt into 1s explicitly.
 */
const DEFAULT_INTERVAL_MS = 30_000

interface Clock {
  ref: Ref<Date>
  timer: ReturnType<typeof setInterval> | null
}

const clocks = new Map<number, Clock>()

export function useNow(intervalMs: number = DEFAULT_INTERVAL_MS): Ref<Date> {
  const existing = clocks.get(intervalMs)
  if (existing) return existing.ref

  // First caller for this cadence — bootstrap a dedicated ref + timer.
  const nowRef = ref(new Date())
  let timer: ReturnType<typeof setInterval> | null = null
  if (typeof window !== 'undefined') {
    timer = setInterval(() => {
      // Replace the Date object so Vue's reactivity sees a new
      // identity. Mutating in place via .setTime() also works but is
      // more error-prone if a consumer holds the same Date reference
      // and compares with ===.
      nowRef.value = new Date()
    }, intervalMs)
  }
  clocks.set(intervalMs, { ref: nowRef, timer })
  return nowRef
}

// Exposed for tests + hot-reload teardown. Real app code never calls
// this — the intervals live for the lifetime of the tab.
export function _stopNowForTests() {
  for (const clock of clocks.values()) {
    if (clock.timer) clearInterval(clock.timer)
  }
  clocks.clear()
}

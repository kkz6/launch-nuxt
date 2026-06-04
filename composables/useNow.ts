/**
 * useNow — a process-wide reactive `now` ref that ticks every
 * `intervalMs` milliseconds. Sharing one timer across every component
 * that wants a live "X minutes ago" badge keeps the cost flat no
 * matter how many date rows are on screen (a Containers list with
 * 50 rows used to either re-fetch the page or accept stale "just
 * now" labels forever).
 *
 * Usage from a component:
 *
 *     const now = useNow()
 *     const relative = computed(() => formatDistance(props.date, now.value))
 *
 * The first caller starts the global interval. Subsequent callers
 * reuse the same ref. The interval keeps running for the life of
 * the page — there's never a moment we want this to stop.
 *
 * The default 30s cadence is a balance: granular enough that "X
 * minutes ago" labels feel live, sparse enough that we're not
 * waking the main thread every second.
 */
const DEFAULT_INTERVAL_MS = 30_000

let started = false
let timer: ReturnType<typeof setInterval> | null = null
let nowRef: Ref<Date> | null = null

export function useNow(intervalMs: number = DEFAULT_INTERVAL_MS): Ref<Date> {
  if (nowRef) return nowRef
  // First caller — bootstrap the shared state. We deliberately
  // initialise here (not at module top-level) because Nuxt SSR runs
  // module code on the server and we don't want a stray setInterval
  // running in Node.
  nowRef = ref(new Date())
  if (!started && typeof window !== 'undefined') {
    started = true
    timer = setInterval(() => {
      // Replace the Date object so Vue's reactivity sees a new
      // identity. Mutating in place via .setTime() also works but
      // is more error-prone if a consumer ever holds the same Date
      // reference and compares with ===.
      nowRef!.value = new Date()
    }, intervalMs)
  }
  return nowRef
}

// Exposed for tests + hot-reload teardown. Real app code never calls
// this — the interval lives for the lifetime of the tab.
export function _stopNowForTests() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  started = false
  nowRef = null
}

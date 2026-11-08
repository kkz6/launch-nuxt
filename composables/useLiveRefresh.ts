/** Coalesce event bursts and serialize REST reconciliation without polling. */
export const useLiveRefresh = (
  refresh: () => Promise<unknown>,
  delay = 200,
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let dirty = false;
  let disposed = false;

  const run = async () => {
    timer = null;
    if (disposed || running) return;
    running = true;
    dirty = false;
    try {
      await refresh();
    } catch {
      // The caller owns visible errors and retains its last successful data.
      // A failed background read must not break subsequent reconciliation.
    } finally {
      running = false;
      if (dirty && !disposed) schedule();
    }
  };

  const schedule = () => {
    if (disposed) return;
    dirty = true;
    if (!running && !timer) timer = setTimeout(() => void run(), delay);
  };

  onScopeDispose(() => {
    disposed = true;
    if (timer) clearTimeout(timer);
  });
  return schedule;
};

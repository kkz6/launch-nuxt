import { onScopeDispose, unref, watch, type Ref } from "vue";

export type AdminResource =
  | "server"
  | "site"
  | "user"
  | "invitation"
  | "subscription"
  | "team"
  | "task"
  | "deployment"
  | "docker";

export interface AdminResourceChange {
  resource: AdminResource;
  action: string;
  error_code?: "provider_unauthorized" | "provider_forbidden";
  user_id?: string;
  server_id?: string;
  site_id?: string;
  team_id?: string;
}

interface AdminLiveOptions {
  resources: readonly AdminResource[];
  userId?: string;
  serverId?: string;
  paused?: Ref<boolean>;
  onChange?: (change: AdminResourceChange) => void;
}

// Events are invalidations, not authoritative models. Re-read the permitted
// REST resource so pending cleanup never looks like completed deletion.
export function useAdminLiveUpdates(
  refresh: () => Promise<unknown> | unknown,
  options: AdminLiveOptions,
) {
  const channel = "admin.resources";
  let disposed = false;
  let dirty = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function invalidate() {
    if (disposed) return;
    dirty = true;
    if (running || timer || unref(options.paused)) return;
    // Fixed coalescing window: continuous events cannot postpone refresh forever.
    timer = setTimeout(flush, 200);
  }

  async function flush() {
    timer = undefined;
    if (disposed || unref(options.paused)) return;
    dirty = false;
    running = true;
    try {
      await refresh();
    } catch {
      // The caller owns its error UI. A failed request must not stop future
      // invalidations or produce an unhandled rejection from a socket callback.
    } finally {
      running = false;
      if (dirty) invalidate();
    }
  }

  if (!import.meta.server) {
    const socket = useWebSocket();
    socket.subscribeToChannel(channel);
    const unsubscribe = socket.subscribe(
      "admin.resource.changed",
      (value: unknown, sourceChannel?: string) => {
        if (disposed) return;
        if (sourceChannel && sourceChannel !== channel) return;
        if (!value || typeof value !== "object") return;
        const change = value as AdminResourceChange;
        if (!options.resources.includes(change.resource)) return;
        if (
          options.userId &&
          change.user_id &&
          change.user_id !== options.userId
        )
          return;
        if (
          options.serverId &&
          change.server_id &&
          change.server_id !== options.serverId
        )
          return;
        options.onChange?.(change);
        invalidate();
      },
    );
    watch(socket.isConnected, (connected, previous) => {
      // Includes the first connection after an initial REST read, as well as
      // reconnects: events may have been missed while the socket was offline.
      if (connected && !previous) invalidate();
    });
    if (options.paused) {
      watch(options.paused, (paused) => {
        if (!paused && dirty) invalidate();
      });
    }
    onScopeDispose(() => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      socket.unsubscribeFromChannel(channel);
    });
  }

  return { invalidate };
}

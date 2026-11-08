import {
  computed,
  effectScope,
  nextTick,
  onScopeDispose,
  ref,
  unref,
  watch,
} from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { useServerModelEvents } from "../../composables/useModelEvents";

afterEach(() => vi.unstubAllGlobals());
it("reconciles generic resource lists after reconnect and keeps server scope filters", async () => {
  const connected = ref(true);
  const handlers = new Map<string, (data: unknown) => void>();
  const subscribe = vi.fn((event, callback) => {
    handlers.set(event, callback);
    return () => handlers.delete(event);
  });
  for (const [key, value] of Object.entries({
    computed,
    unref,
    watch,
    tryOnUnmounted: onScopeDispose,
  }))
    vi.stubGlobal(key, value);
  vi.stubGlobal("useWebSocket", () => ({ subscribe, isConnected: connected }));
  const refresh = vi.fn();
  const scope = effectScope();
  scope.run(() => useServerModelEvents("cron", "server-a", refresh));
  handlers.get("cron.deleted")!({ server_id: "server-b" });
  expect(refresh).not.toHaveBeenCalled();
  handlers.get("cron.deleted")!({ server_id: "server-a" });
  expect(refresh).toHaveBeenCalledOnce();
  connected.value = false;
  await nextTick();
  connected.value = true;
  await nextTick();
  expect(refresh).toHaveBeenCalledTimes(2);
  scope.stop();
  expect(handlers.size).toBe(0);
});

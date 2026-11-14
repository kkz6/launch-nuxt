import {
  computed,
  effectScope,
  nextTick,
  onScopeDispose,
  ref,
  unref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useChannelEvents,
  useSiteEvents,
  useDeploymentGhaStepsEvents,
  useDeploymentEvents,
} from "../../composables/useChannelEvents";

const connected = ref(false);
const handlers = new Map<string, (data: unknown, channel?: string) => void>();
const subscribeToChannel = vi.fn();
const unsubscribeFromChannel = vi.fn();
const subscribe = vi.fn(
  (event: string, handler: (data: unknown, channel?: string) => void) => {
    handlers.set(event, handler);
    return () => handlers.delete(event);
  },
);
let scope: ReturnType<typeof effectScope>;
beforeEach(() => {
  scope = effectScope();
  connected.value = false;
  handlers.clear();
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    computed,
    onScopeDispose,
    unref,
    watch,
  }))
    vi.stubGlobal(key, value);
  vi.stubGlobal("useWebSocket", () => ({
    subscribe,
    subscribeToChannel,
    unsubscribeFromChannel,
    isConnected: connected,
  }));
});
afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
});

describe("scoped realtime subscriptions", () => {
  it("retains one desired subscription through reconnect and reconciles missed state", async () => {
    const reconcile = vi.fn();
    scope.run(() =>
      useChannelEvents("team.a", ["site.deleted"], vi.fn(), {
        onReconnect: reconcile,
      }),
    );
    expect(subscribeToChannel).toHaveBeenCalledTimes(1);
    connected.value = true;
    await nextTick();
    connected.value = false;
    await nextTick();
    connected.value = true;
    await nextTick();
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(subscribeToChannel).toHaveBeenCalledTimes(1);
    expect(unsubscribeFromChannel).not.toHaveBeenCalled();
    scope.stop();
    expect(unsubscribeFromChannel).toHaveBeenCalledWith("team.a");
  });

  it("rejects other channels and contradictory scopes while accepting matching envelopes", () => {
    const callback = vi.fn();
    scope.run(() => useChannelEvents("team.a", ["site.updated"], callback));
    const dispatch = handlers.get("site.updated")!;
    dispatch({ team_id: "a" }, "team.b");
    dispatch({ team_id: "b" }, "team.a");
    dispatch({ team_id: "b" });
    dispatch({ id: "site" });
    expect(callback).not.toHaveBeenCalled();
    dispatch({ id: "site" }, "team.a");
    dispatch({ team_id: "a" });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("replaces scope and event subscriptions while offline", async () => {
    const channel = ref("team.a");
    const events = ref(["site.updated"]);
    const callback = vi.fn();
    scope.run(() => useChannelEvents(channel, events, callback));
    channel.value = "team.b";
    events.value = ["site.deleted"];
    await nextTick();
    expect(unsubscribeFromChannel).toHaveBeenCalledWith("team.a");
    expect(subscribeToChannel).toHaveBeenLastCalledWith("team.b");
    expect(handlers.has("site.updated")).toBe(false);
    handlers.get("site.deleted")!({ team_id: "a" });
    expect(callback).not.toHaveBeenCalled();
    handlers.get("site.deleted")!({ team_id: "b" });
    expect(callback).toHaveBeenCalledOnce();
    channel.value = "team.";
    await nextTick();
    expect(handlers.size).toBe(0);
  });
  it("subscribes to PHP runtime recovery events with team scoping", () => {
    const callback = vi.fn();
    scope.run(() => useDeploymentEvents("a", callback));
    for (const event of [
      "deployment.runtime.started",
      "deployment.runtime.completed",
      "deployment.runtime.failed",
    ]) {
      expect(handlers.has(event)).toBe(true);
      handlers.get(event)!({ team_id: "b", site_id: "site" });
      handlers.get(event)!({
        team_id: "a",
        site_id: "site",
        task_id: "runtime",
      });
    }
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("subscribes to deletion failures and forwards reconnect options through wrappers", async () => {
    const siteRefresh = vi.fn();
    const stepsRefresh = vi.fn();
    scope.run(() => {
      useSiteEvents("a", vi.fn(), { onReconnect: siteRefresh });
      useDeploymentGhaStepsEvents("a", vi.fn(), { onReconnect: stepsRefresh });
    });
    expect(handlers.has("site.deletion_failed")).toBe(true);
    connected.value = true;
    await nextTick();
    expect(siteRefresh).toHaveBeenCalledOnce();
    expect(stepsRefresh).toHaveBeenCalledOnce();
  });
});

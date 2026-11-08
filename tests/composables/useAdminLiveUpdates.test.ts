import { effectScope, nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminLiveUpdates } from "../../composables/useAdminLiveUpdates";

const connected = ref(true);
const subscribe = vi.fn();
const subscribeToChannel = vi.fn();
const unsubscribeFromChannel = vi.fn();
const unsubscribe = vi.fn();
let receive: (data: unknown, channel?: string) => void;
const scopes: ReturnType<typeof effectScope>[] = [];
const change = (overrides = {}) => ({
  resource: "site",
  action: "deleted",
  server_id: "server-1",
  ...overrides,
});
const start = (refresh = vi.fn(), options = {}) => {
  const scope = effectScope();
  scopes.push(scope);
  scope.run(() =>
    useAdminLiveUpdates(refresh, {
      resources: ["site", "server"],
      serverId: "server-1",
      ...options,
    }),
  );
  return { scope, refresh };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  connected.value = true;
  subscribe.mockImplementation((_event, callback) => {
    receive = callback;
    return unsubscribe;
  });
  vi.stubGlobal("useWebSocket", () => ({
    isConnected: connected,
    subscribe,
    subscribeToChannel,
    unsubscribeFromChannel,
  }));
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("admin live invalidation", () => {
  it("subscribes to the staff channel and coalesces only matching resource changes", async () => {
    const { refresh } = start();
    expect(subscribeToChannel).toHaveBeenCalledWith("admin.resources");
    expect(subscribe).toHaveBeenCalledWith(
      "admin.resource.changed",
      expect.any(Function),
    );
    receive(change({ resource: "invitation" }));
    receive(change({ server_id: "another-server" }));
    receive(change(), "team.some-team");
    receive(null);
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).not.toHaveBeenCalled();
    for (let n = 0; n < 30; n++) receive(change(), "admin.resources");
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    // Missing scope IDs must conservatively reconcile, never miss a deletion.
    receive(change({ server_id: undefined }));
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps one request in flight and reconciles once more for changes during it", async () => {
    let finish!: () => void;
    const refresh = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    start(refresh);
    receive(change());
    await vi.advanceTimersByTimeAsync(200);
    for (let n = 0; n < 20; n++) receive(change());
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("reconciles deployment failures and forwards only matching live changes", async () => {
    const onChange = vi.fn();
    const { scope, refresh } = start(vi.fn(), {
      resources: ["deployment"],
      onChange,
    });
    const failed = change({ resource: "deployment", action: "failed" });
    receive(failed, "team.some-team");
    receive({ ...failed, server_id: "another-server" }, "admin.resources");
    receive(change(), "admin.resources");
    expect(onChange).not.toHaveBeenCalled();
    receive(failed, "admin.resources");
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(failed);
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledOnce();
    scope.stop();
    receive(failed, "admin.resources");
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("reconciles after reconnect and cleans up channel, event handler and queued work", async () => {
    const { scope, refresh } = start();
    connected.value = false;
    await nextTick();
    connected.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(subscribeToChannel).toHaveBeenCalledTimes(1);
    receive(change());
    scope.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribeFromChannel).toHaveBeenCalledWith("admin.resources");
  });

  it("defers reconciliation during mutations and resumes without losing events", async () => {
    const paused = ref(true);
    const { refresh } = start(vi.fn(), { paused });
    receive(change());
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).not.toHaveBeenCalled();
    paused.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("recovers from failed refreshes and does not schedule a trailing request after disposal", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("offline"));
    const { scope } = start(refresh);
    receive(change());
    await vi.advanceTimersByTimeAsync(200);
    receive(change());
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(2);
    scope.stop();
    receive(change());
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("filters user-specific changes when a target user is known", async () => {
    const { refresh } = start(vi.fn(), { userId: "user-1" });
    receive(change({ user_id: "user-2" }));
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).not.toHaveBeenCalled();
    receive(change({ user_id: "user-1" }));
    await vi.advanceTimersByTimeAsync(200);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

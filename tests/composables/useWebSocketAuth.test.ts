import { flushPromises } from "@vue/test-utils";
import { effectScope, markRaw, nextTick, readonly, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) {
    FakeSocket.instances.push(this);
    return markRaw(this);
  }
  send(message: string) {
    this.sent.push(message);
  }
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}
let token: ReturnType<typeof ref<string>>;
const waitForAuth = vi.fn();
let client: ReturnType<
  (typeof import("../../composables/useWebSocket"))["useWebSocket"]
>;
beforeEach(() => {
  vi.resetModules();
  token = ref("initial-token");
  FakeSocket.instances = [];
  waitForAuth.mockReset().mockResolvedValue(undefined);
  for (const [key, value] of Object.entries({
    ref,
    readonly,
    watch,
    WebSocket: FakeSocket,
  }))
    vi.stubGlobal(key, value);
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { wsBase: "ws://localhost.test" },
  }));
  vi.stubGlobal("useAuth", () => ({
    token,
    isInitialized: ref(true),
    waitForAuth,
  }));
  vi.stubGlobal("useApi", () => ({ getCurrentTeamId: () => "team-a" }));
  vi.stubGlobal("useLocalePreference", () => ({
    effectiveLocale: ref("en"),
    getEffectiveLocale: () => "en",
  }));
});
afterEach(() => {
  client?.disconnect();
  vi.unstubAllGlobals();
});

describe("socket authentication lifecycle", () => {
  it("reconnects with a rotated token, restores channels, and ignores old socket messages", async () => {
    const { useWebSocket } = await import("../../composables/useWebSocket");
    const page = effectScope();
    client = page.run(useWebSocket)!;
    await flushPromises();
    const original = FakeSocket.instances[0];
    original.open();
    client.subscribeToChannel("team.team-a");
    client.subscribeToChannel("admin");
    const received = vi.fn();
    client.subscribe("site.deleted", received);
    const oldMessage = original.onmessage!;
    page.stop(); // The shared auth watcher must outlive its first caller.
    token.value = "rotated-token";
    await nextTick();
    await flushPromises();
    expect(original.close).toHaveBeenCalledOnce();
    expect(FakeSocket.instances).toHaveLength(2);
    const rotated = FakeSocket.instances[1];
    expect(new URL(rotated.url).searchParams.get("token")).toBe(
      "rotated-token",
    );
    rotated.open();
    expect(rotated.sent.map((value) => JSON.parse(value))).toEqual([
      { action: "subscribe", channel: "team.team-a" },
      { action: "subscribe", channel: "admin" },
    ]);
    oldMessage({
      data: JSON.stringify({
        channel: "team.team-a",
        event: "site.deleted",
        data: { site_id: "old" },
      }),
    });
    expect(received).not.toHaveBeenCalled();
    rotated.onmessage!({
      data: JSON.stringify({
        channel: "team.team-a",
        event: "site.deleted",
        data: { site_id: "current" },
      }),
    });
    expect(received).toHaveBeenCalledWith(
      { site_id: "current" },
      "team.team-a",
    );
  });

  it("discards an authentication wait superseded by token rotation without opening two sockets", async () => {
    let completeOldAuth!: () => void;
    waitForAuth.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          completeOldAuth = resolve;
        }),
    );
    const { useWebSocket } = await import("../../composables/useWebSocket");
    client = useWebSocket();
    expect(FakeSocket.instances).toHaveLength(0);
    token.value = "new-token";
    await nextTick();
    await flushPromises();
    expect(FakeSocket.instances).toHaveLength(1);
    completeOldAuth();
    await flushPromises();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(new URL(FakeSocket.instances[0].url).searchParams.get("token")).toBe(
      "new-token",
    );
  });
});

import { effectScope, onScopeDispose } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLiveRefresh } from "../../composables/useLiveRefresh";
let scope: ReturnType<typeof effectScope>;
beforeEach(() => {
  scope = effectScope();
  vi.useFakeTimers();
  vi.stubGlobal("onScopeDispose", onScopeDispose);
});
afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("coalesces bursts without postponing the first refresh indefinitely", async () => {
  const load = vi.fn().mockResolvedValue(undefined);
  const refresh = scope.run(() => useLiveRefresh(load))!;
  refresh();
  await vi.advanceTimersByTimeAsync(100);
  refresh();
  refresh();
  await vi.advanceTimersByTimeAsync(100);
  expect(load).toHaveBeenCalledOnce();
});

it("serializes in-flight changes and reconciles again after the current read", async () => {
  let finish!: () => void;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const refresh = scope.run(() => useLiveRefresh(load))!;
  refresh();
  await vi.advanceTimersByTimeAsync(200);
  refresh();
  refresh();
  await vi.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenCalledOnce();
  finish();
  await vi.advanceTimersByTimeAsync(200);
  expect(load).toHaveBeenCalledTimes(2);
});

it("recovers after failed reads and cancels pending work on disposal", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(undefined);
  const refresh = scope.run(() => useLiveRefresh(load))!;
  refresh();
  await vi.advanceTimersByTimeAsync(200);
  refresh();
  await vi.advanceTimersByTimeAsync(200);
  expect(load).toHaveBeenCalledTimes(2);
  refresh();
  scope.stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenCalledTimes(2);
});

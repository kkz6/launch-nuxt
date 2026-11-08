import { computed, effectScope, nextTick, onScopeDispose, ref } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useNavbarLiveUpdates } from "../../composables/useNavbarLiveUpdates";
const handlers = vi.hoisted(
  () => new Map<string, (data: Record<string, unknown>) => void>(),
);
const databaseEvents = vi.hoisted(() => [] as string[]);
const reconnects = vi.hoisted(() => [] as (() => void)[]);
vi.mock("~/composables/useChannelEvents", () => {
  const register =
    (kind: string) =>
    (
      _team: unknown,
      handler: (data: Record<string, unknown>) => void,
      options?: { onReconnect?: () => void },
    ) => {
      handlers.set(kind, handler);
      if (options?.onReconnect) reconnects.push(options.onReconnect);
    };
  return {
    useServerEvents: register("server"),
    useSiteEvents: register("site"),
    useDockerProjectEvents: register("project"),
    useDockerApplicationEvents: register("application"),
    useDockerComposeEvents: register("compose"),
    useChannelEvents: (
      _channel: unknown,
      events: string[],
      handler: (data: Record<string, unknown>) => void,
    ) => {
      databaseEvents.splice(0, databaseEvents.length, ...events);
      handlers.set("database", handler);
    },
  };
});
let scope: ReturnType<typeof effectScope>;
const context = () => ({
  serverId: ref<string | null>("s1"),
  siteId: ref<string | null>("site1"),
  projectId: ref<string | null>("p1"),
  workloadId: ref<string | null>("w1"),
  workloadKind: ref<string | null>("application"),
});
const start = () => {
  const ids = context();
  const resource = vi.fn().mockResolvedValue(undefined);
  const workload = vi.fn().mockResolvedValue(undefined);
  scope = effectScope();
  scope.run(() => useNavbarLiveUpdates(ref("t1"), ids, resource, workload));
  return { ids, resource, workload };
};
beforeEach(() => {
  vi.useFakeTimers();
  handlers.clear();
  reconnects.length = 0;
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onScopeDispose", onScopeDispose);
});
afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("reloads only the current header and coalesces lifecycle bursts", async () => {
  const { resource, workload } = start();
  handlers.get("server")!({ server_id: "other" });
  handlers.get("site")!({ site_id: "other" });
  handlers.get("application")!({ application_id: "other" });
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).not.toHaveBeenCalled();
  expect(workload).not.toHaveBeenCalled();
  handlers.get("server")!({ server_id: "s1" });
  handlers.get("site")!({ site: { id: "site1" } });
  handlers.get("project")!({ project_id: "p1" });
  handlers.get("application")!({ application_id: "w1" });
  handlers.get("application")!({ application_id: "w1" });
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).toHaveBeenCalledTimes(1);
  expect(workload).toHaveBeenCalledTimes(1);
});
it("uses the current route for workload kinds and reloads on reconnect", async () => {
  const { ids, resource, workload } = start();
  expect(databaseEvents).toEqual(
    expect.arrayContaining([
      "docker.database.running",
      "docker.database.failed",
      "docker.database.lifecycle_done",
    ]),
  );
  ids.workloadKind.value = "compose";
  handlers.get("application")!({ application_id: "w1" });
  await vi.advanceTimersByTimeAsync(200);
  expect(workload).not.toHaveBeenCalled();
  handlers.get("compose")!({ compose_id: "w1" });
  await vi.advanceTimersByTimeAsync(200);
  ids.workloadKind.value = "database";
  handlers.get("database")!({ database_id: "w1" });
  await vi.advanceTimersByTimeAsync(200);
  reconnects[0]();
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).toHaveBeenCalledTimes(1);
  expect(workload).toHaveBeenCalledTimes(3);
  ids.serverId.value = null;
  ids.workloadId.value = null;
  reconnects[0]();
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).toHaveBeenCalledTimes(1);
  expect(workload).toHaveBeenCalledTimes(3);
});
it("waits for the current metadata read and cancels queued work on unmount", async () => {
  const { resource } = start();
  let finish!: () => void;
  resource.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  handlers.get("server")!({ id: "s1" });
  await vi.advanceTimersByTimeAsync(200);
  reconnects[0]();
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).toHaveBeenCalledTimes(1);
  finish();
  await nextTick();
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).toHaveBeenCalledTimes(2);
  handlers.get("server")!({ id: "s1" });
  scope.stop();
  await vi.advanceTimersByTimeAsync(200);
  expect(resource).toHaveBeenCalledTimes(2);
});

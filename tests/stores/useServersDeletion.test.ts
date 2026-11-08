import { flushPromises } from "@vue/test-utils";
import { computed, effectScope, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useServersStore } from "~/stores/useServersStore";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("~/services/serverService", () => ({ serverService: { list } }));
const events = vi.fn();
let scope: ReturnType<typeof effectScope>;
let store: ReturnType<typeof useServersStore>;
const server = (id: string) => ({
  id,
  name: id,
  provider: "custom",
  status: "running",
});
const publish = (event: string, id = "server-a") =>
  events.mock.calls[0][1]({ server_id: id }, event);
beforeEach(() => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  scope = effectScope();
  list
    .mockReset()
    .mockResolvedValue({ data: [server("server-a"), server("server-b")] });
  events.mockReset();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useAuth", () => ({
    user: ref({ id: "account-a", current_team_id: "team-a" }),
  }));
  vi.stubGlobal("useServerEvents", events);
  store = scope.run(() => useServersStore())!;
});
afterEach(() => {
  store.$dispose();
  scope.stop();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("does not resurrect a completed deletion from an older interactive list response", async () => {
  await store.fetchAll();
  let resolve!: (value: unknown) => void;
  list.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const stale = store.fetchAll();
  publish("server.deleted");
  expect(store.servers.map((s) => s.id)).toEqual(["server-b"]);
  resolve({ data: [server("server-a"), server("server-b")] });
  await stale;
  expect(store.servers.map((s) => s.id)).toEqual(["server-b"]);
  // Fresh canonical reads still support restoring a soft-deleted server.
  await store.fetchAll();
  expect(store.servers.map((s) => s.id)).toEqual(["server-a", "server-b"]);
});

it("fences background reads that started before deletion completion", async () => {
  await store.fetchAll();
  let resolve!: (value: unknown) => void;
  list.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  publish("server.updated");
  await vi.advanceTimersByTimeAsync(300);
  expect(list).toHaveBeenCalledTimes(2);
  publish("server.deleted");
  resolve({ data: [server("server-a"), server("server-b")] });
  await flushPromises();
  expect(store.servers.map((s) => s.id)).toEqual(["server-b"]);
});

it("reconciles missed deletion events when the channel reconnects", async () => {
  await store.fetchAll();
  list.mockResolvedValue({ data: [] });
  events.mock.calls[0][2].onReconnect();
  await vi.advanceTimersByTimeAsync(300);
  expect(store.servers).toEqual([]);
});

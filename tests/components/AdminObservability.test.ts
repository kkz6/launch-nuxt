import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ObservabilityPage from "../../pages/admin/observability.vue";
import type { ObservabilitySnapshot } from "../../types";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("~/services/adminService", () => ({
  adminService: { observabilitySnapshot: mocks.snapshot },
}));

const snapshot = (): ObservabilitySnapshot => ({
  runtime: {
    goroutines: 8,
    heap_alloc_mb: 20,
    heap_inuse_mb: 30,
    heap_objects_k: 2,
    stack_inuse_mb: 1,
    sys_mem_mb: 80,
    num_gc: 10,
    last_gc_pause_ms: 0.1,
    gc_cpu_percent: 0.2,
    num_cpu: 4,
    uptime: "1h",
  },
  db_pool: {
    max_open: 10,
    open: 4,
    in_use: 1,
    idle: 3,
    wait_count: 0,
    wait_duration: "0s",
  },
  queries: {
    capacity: 200,
    n1_threshold: 3,
    slow_threshold_ms: 250,
    total: 8,
    slow_count: 1,
    n1_count: 1,
    avg_ms: 12,
    recent: [
      {
        sql: "SELECT * FROM widgets WHERE owner_id = ? AND deleted_at IS NULL",
        duration_ns: 300000000,
        rows: 1,
        caller: "service.LoadWidgets",
        request_id: "request-unique-1",
        method: "GET",
        route: "/servers/:server/sites",
        trace_id: "external-trace-with-full-untruncated-identifier",
        operation: "SELECT",
        slow: true,
        timestamp: "2026-11-07T12:00:00Z",
      },
    ],
    slow_queries: [],
    n1_patterns: [
      {
        sql: "SELECT * FROM widgets WHERE id = ?",
        count: 4,
        total_ms: 32,
        avg_ms: 8,
        caller: "service.LoadWidget",
        request_id: "request-unique-2",
        method: "GET",
        route: "/servers/:server/sites",
        operation: "SELECT",
        trace_id: "pattern-trace-with-full-untruncated-identifier",
        timestamp: "2026-11-07T12:00:00Z",
      },
    ],
  },
  uptime: "1h",
  timestamp: "2026-11-07T12:00:00Z",
});

let wrappers: VueWrapper[] = [];
const mountPage = () => {
  const wrapper = shallowMount(ObservabilityPage, {
    global: { renderStubDefaultSlot: true, stubs: { Icon: true } },
  });
  wrappers.push(wrapper);
  return wrapper;
};

describe("admin query diagnostics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.snapshot.mockReset().mockResolvedValue({ data: snapshot() });
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("onUnmounted", onUnmounted);
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("setBreadcrumbs", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("useI18n", () => createI18nStub());
  });

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount());
    wrappers = [];
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows request-scoped suspects, full SQL and trace details, and the bounded sample", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("8 of the latest 200 queries");
    expect(wrapper.text()).toContain("resets on restart");
    expect(wrapper.text()).toContain(
      "Showing the latest 1 of 8 retained queries",
    );
    expect(wrapper.text()).toContain("Slow queries take at least 250.0ms");
    const patterns = wrapper.get('tabs-content-stub[value="n1"]');
    expect(patterns.text()).toContain("At least 3 successful reads");
    expect(patterns.text()).toContain("one request");
    expect(patterns.text()).toContain("does not confirm an N+1 problem");
    expect(patterns.text()).toContain("GET /servers/:server/sites");
    expect(patterns.text()).toContain("request-unique-2");
    expect(patterns.text()).toContain("service.LoadWidget");
    expect(patterns.text()).toContain("32.0ms");
    expect(patterns.text()).toContain("8.0ms");
    expect(patterns.get("details pre").text()).toBe(
      "SELECT * FROM widgets WHERE id = ?",
    );
    expect(patterns.get("details").text()).toContain(
      "pattern-trace-with-full-untruncated-identifier",
    );
    expect(
      wrapper.get('tabs-content-stub[value="recent"] details pre').text(),
    ).toBe(snapshot().queries.recent[0].sql);
  });

  it("keeps older API responses readable without claiming request-level detection", async () => {
    const data = snapshot();
    delete data.queries.capacity;
    delete data.queries.n1_threshold;
    delete data.queries.slow_threshold_ms;
    data.queries.n1_patterns = [
      {
        sql: "SELECT * FROM widgets",
        count: 3,
        total_ms: 9,
        caller: "",
        timestamp: "not-a-time",
      },
    ];
    mocks.snapshot.mockResolvedValue({ data });
    const wrapper = mountPage();
    await flushPromises();
    const patterns = wrapper.get('tabs-content-stub[value="n1"]');
    expect(patterns.text()).toContain("may span unrelated requests");
    expect(patterns.text()).toContain("No request context");
    expect(patterns.text()).toContain("3.0ms");
    expect(patterns.text()).not.toContain("At least 3 successful reads");
    expect(patterns.text()).not.toContain("Invalid Date");
    expect(wrapper.text()).toContain("not lifetime totals");
  });

  it("keeps stale data visible after a failed refresh and clears the error on recovery", async () => {
    const wrapper = mountPage();
    await flushPromises();
    mocks.snapshot.mockRejectedValueOnce({
      data: { message: "Diagnostics unavailable" },
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Diagnostics unavailable",
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "last successful snapshot",
    );
    expect(wrapper.text()).toContain("request-unique-2");
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("keeps expanded query details with their call site when patterns reorder", async () => {
    const data = snapshot();
    const pattern = data.queries.n1_patterns[0];
    data.queries.n1_patterns = [
      { ...pattern, caller: "service.FirstCaller" },
      { ...pattern, caller: "service.SecondCaller" },
    ];
    mocks.snapshot.mockResolvedValueOnce({ data });
    const wrapper = mountPage();
    await flushPromises();
    const patternRows = () =>
      wrapper
        .findAll('tabs-content-stub[value="n1"] table-row-stub')
        .filter((row) => row.find("details").exists());
    (patternRows()[0].get("details").element as HTMLDetailsElement).open = true;

    mocks.snapshot.mockResolvedValueOnce({
      data: {
        ...data,
        queries: {
          ...data.queries,
          n1_patterns: [...data.queries.n1_patterns].reverse(),
        },
      },
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    const firstCaller = patternRows().find((row) =>
      row.text().includes("service.FirstCaller"),
    );
    expect(firstCaller?.get("details").attributes("open")).toBeDefined();
    const secondCaller = patternRows().find((row) =>
      row.text().includes("service.SecondCaller"),
    );
    expect(secondCaller?.get("details").attributes("open")).toBeUndefined();
  });

  it("does not overlap refresh requests and stops polling when disabled or unmounted", async () => {
    let finish!: (value: { data: ObservabilitySnapshot }) => void;
    mocks.snapshot.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
    await vi.advanceTimersByTimeAsync(15000);
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
    finish({ data: snapshot() });
    await flushPromises();
    expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
    await wrapper.get('input[type="checkbox"]').setValue(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
    await wrapper.get('input[type="checkbox"]').setValue(true);
    wrapper.unmount();
    wrappers = [];
    await vi.advanceTimersByTimeAsync(10000);
    expect(mocks.snapshot).toHaveBeenCalledTimes(2);
  });

  it("shows an actionable initial-load error without an empty diagnostics screen", async () => {
    mocks.snapshot.mockRejectedValueOnce(new Error("network error"));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Failed to load observability data",
    );
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
  });
});

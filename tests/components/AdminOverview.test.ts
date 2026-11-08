import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { computed, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "../../pages/admin/overview.vue";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: vi.fn(),
}));

const mocks = vi.hoisted(() => ({ overview: vi.fn(), error: vi.fn() }));
vi.mock("~/services/adminService", () => ({
  adminService: { overview: mocks.overview },
}));
vi.mock("vue-sonner", () => ({ toast: { error: mocks.error } }));

const overview = {
  currency: "USD",
  mrr_cents: 125000,
  total_revenue_cents: 456700,
  active_subscriptions: 12,
  trial_subscriptions: 3,
  new_subscriptions_mtd: 4,
  cancelled_mtd: 1,
  revenue_this_month_cents: 26000,
  revenue_last_month_cents: 20000,
  recent_payments: [
    {
      team_id: "team",
      team_name: "Example team",
      total: 9900,
      currency: "USD",
      ordered_at: "2026-11-01T12:00:00Z",
    },
  ],
  revenue_trend: [{ month: "2026-11", total: 26000 }],
};
let wrappers: VueWrapper[] = [];
const mountPage = () => {
  const wrapper = shallowMount(OverviewPage, {
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        PageHeader: false,
        Icon: true,
        Button: { template: "<button><slot /></button>" },
        AdminRevenueTrendChart: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};

beforeEach(() => {
  mocks.overview.mockReset().mockResolvedValue({ data: overview });
  mocks.error.mockReset();
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("setBreadcrumbs", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useI18n", () => createI18nStub());
});
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  wrappers = [];
  vi.unstubAllGlobals();
});

describe("admin overview", () => {
  it("shows a clear heading and formats real financial data", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Overview");
    expect(wrapper.text()).toContain("$1,250.00");
    expect(wrapper.text()).toContain("$4,567.00");
    expect(wrapper.text()).toContain("Example team");
    expect(wrapper.text()).toContain("$99.00");
    expect(wrapper.get("button").text()).toBe("Refresh");
  });

  it("does not invent a growth percentage when last month had no revenue", async () => {
    mocks.overview.mockResolvedValue({
      data: { ...overview, revenue_last_month_cents: 0 },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("$260.00");
    expect(wrapper.text()).not.toContain("100%");
  });

  it("keeps a failed initial load distinct from empty data and supports retry", async () => {
    mocks.overview.mockRejectedValueOnce(new Error("Unavailable"));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Failed to load overview",
    );
    expect(wrapper.text()).not.toContain("No payments");
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Example team");
  });

  it("retains the last successful overview when refresh fails", async () => {
    const wrapper = mountPage();
    await flushPromises();
    mocks.overview.mockRejectedValueOnce(new Error("Unavailable"));
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Example team");
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Showing the last successful overview",
    );
  });
});

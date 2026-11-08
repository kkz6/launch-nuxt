import { flushPromises, shallowMount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataTable from "../../components/data-table/DataTable.vue";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useActions", () => ({
  useActions: () => ({
    selectedIds: ref(new Set()),
    hasSelection: ref(false),
    selectedCount: ref(0),
    confirmAction: ref(null),
  }),
}));
vi.mock("~/composables/useExport", () => ({
  useExport: () => ({ isExporting: ref(false), exportProgress: ref(null) }),
}));
vi.mock("~/composables/useStickyTable", () => ({
  useStickyTable: () => ({ tableRef: ref(null), headerStuck: ref(false) }),
}));

const get = vi.fn();
const response = (rows = [{ id: "user-1", name: "Anila" }]) => ({
  data: {
    data: rows,
    meta: {
      columns: [
        {
          key: "name",
          header: "Name",
          type: "text",
          visible: true,
          toggleable: false,
        },
      ],
      search: { enabled: true },
      filters: [],
      actions: { bulk: [] },
      exports: [],
      emptyState: {
        title: "No users",
        message: "Customer accounts will appear here.",
      },
    },
    pagination: { total: rows.length },
  },
});
const mountTable = () =>
  shallowMount(DataTable, {
    props: { endpoint: "/admin/users/table", syncUrl: false },
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
        CellRenderer: {
          props: ["value"],
          template: "<span>{{ value }}</span>",
        },
        EmptyState: {
          props: ["config"],
          template: '<div data-testid="empty">{{ config?.title }}</div>',
        },
      },
    },
  });

describe("shared table request failures", () => {
  beforeEach(() => {
    get.mockReset();
    vi.stubGlobal("useApi", () => ({ get }));
    vi.stubGlobal("useLocalePreference", () => ({
      effectiveLocale: ref("en"),
    }));
    vi.stubGlobal("useI18n", createI18nStub);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a retryable error instead of an empty result after an initial failure", async () => {
    get
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response());
    const wrapper = mountTable();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "couldn't load this list",
    );
    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(false);
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenLastCalledWith(
      "/admin/users/table/data?page=1&limit=15",
      { headers: {} },
    );
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Anila");
  });

  it("retains the last successful rows during a failed refresh and clears the error on retry", async () => {
    get
      .mockResolvedValueOnce(response())
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        response([{ id: "user-2", name: "Updated user" }]),
      );
    const wrapper = mountTable();
    await flushPromises();
    wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.text()).toContain("Anila");
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "last loaded results",
    );
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Updated user");
    expect(wrapper.text()).not.toContain("Anila");
  });

  it("keeps normal empty results distinct from errors", async () => {
    get.mockResolvedValueOnce(response([]));
    const wrapper = mountTable();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="empty"]').text()).toBe("No users");
  });

  it("renders API metadata with null filters and action arrays", async () => {
    const result = response();
    get.mockResolvedValueOnce({
      data: {
        ...result.data,
        meta: {
          ...result.data.meta,
          filters: null,
          actions: { row: null, bulk: null },
          exports: null,
          views: null,
        },
      },
    });
    const wrapper = mountTable();
    await flushPromises();
    expect(wrapper.text()).toContain("Anila");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.findComponent({ name: "AddFilterDropdown" }).exists()).toBe(
      false,
    );
    expect(wrapper.findComponent({ name: "ExportButton" }).exists()).toBe(
      false,
    );
  });

  it("handles null columns, search, actions and empty rows without crashing", async () => {
    const result = response([]);
    get.mockResolvedValueOnce({
      data: {
        ...result.data,
        data: null,
        meta: {
          ...result.data.meta,
          columns: null,
          filters: null,
          actions: null,
          search: null,
          exports: null,
          views: null,
          perPageOptions: null,
        },
      },
    });
    const wrapper = mountTable();
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="empty"]').text()).toBe("No users");
  });
});

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
        Icon: true,
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

  it("does not let an older response restore rows removed by a newer live refresh", async () => {
    let finishOld!: (value: unknown) => void;
    get
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOld = resolve;
        }),
      )
      .mockResolvedValueOnce(response([]));
    const wrapper = mountTable();
    await flushPromises();
    await wrapper.vm.refresh();
    await flushPromises();
    expect(wrapper.get('[data-testid="empty"]').text()).toBe("No users");
    finishOld(response([{ id: "deleted-user", name: "Deleted user" }]));
    await flushPromises();
    expect(wrapper.text()).not.toContain("Deleted user");
    expect(wrapper.get('[data-testid="empty"]').text()).toBe("No users");
    wrapper.unmount();
  });

  it("moves back to the last remaining page after live row deletion", async () => {
    const page = (
      currentPage: number,
      lastPage: number,
      rows = [{ id: "user-1", name: "Anila" }],
    ) => ({
      data: {
        ...response(rows).data,
        pagination: {
          type: "full",
          currentPage,
          lastPage,
          total: 16,
          perPage: 15,
        },
      },
    });
    get.mockResolvedValueOnce(page(1, 2)).mockResolvedValueOnce(page(2, 2));
    const wrapper = mountTable();
    await flushPromises();
    wrapper.findComponent({ name: "TablePagination" }).vm.$emit("page", 2);
    await flushPromises();
    get.mockResolvedValueOnce(page(2, 1, [])).mockResolvedValueOnce(page(1, 1));
    await wrapper.vm.refresh();
    await flushPromises();
    expect(get.mock.calls.at(-1)?.[0]).toContain("page=1&limit=15");
    expect(wrapper.text()).toContain("Anila");
    wrapper.unmount();
  });

  it("keeps sorting available through a named header button and reports its direction", async () => {
    const result = response();
    get.mockResolvedValue({
      data: {
        ...result.data,
        meta: {
          ...result.data.meta,
          columns: [{ ...result.data.meta.columns[0], sortable: true }],
        },
      },
    });
    const wrapper = mountTable();
    await flushPromises();
    const sort = wrapper.get("thead button");
    expect(sort.text()).toBe("Name");
    expect(sort.attributes("type")).toBe("button");
    expect(wrapper.get("thead th").attributes("aria-sort")).toBe("none");
    await sort.trigger("click");
    await flushPromises();
    expect(get.mock.calls.at(-1)?.[0]).toContain("sort=name%3Aasc");
    expect(wrapper.get("thead th").attributes("aria-sort")).toBe("ascending");
    await sort.trigger("click");
    await flushPromises();
    expect(get.mock.calls.at(-1)?.[0]).toContain("sort=name%3Adesc");
    expect(wrapper.get("thead th").attributes("aria-sort")).toBe("descending");
    wrapper.unmount();
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

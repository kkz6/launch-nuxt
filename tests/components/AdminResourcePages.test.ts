import { shallowMount } from "@vue/test-utils";
import { computed, defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServersPage from "../../pages/admin/servers/index.vue";
import FailuresPage from "../../pages/admin/failures.vue";
import DataTable from "../../components/data-table/DataTable.vue";
import ServerDetailsSheet from "../../components/admin/ServerDetailsSheet.vue";
import { ListboxFilter } from "reka-ui";
import { CommandDialog, CommandItem } from "../../components/ui/command";
import TablePagination from "../../components/data-table/TablePagination.vue";
import FailureLogSheet from "../../components/admin/FailureLogSheet.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  liveUpdates: vi.fn(),
  refresh: vi.fn(),
  error: vi.fn(),
  table: vi.fn(),
  setSearch: vi.fn(),
  setPage: vi.fn(),
  setPerPage: vi.fn(),
}));
vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: mocks.liveUpdates,
}));
vi.mock("~/composables/useTable", () => ({
  useTable: (...args: unknown[]) => mocks.table(...args),
}));
vi.mock("vue-sonner", () => ({ toast: { error: mocks.error } }));

const navigate = vi.fn();
const paletteOpen = ref(false);
const rows = ref([
  {
    id: "server-1",
    name: "production-web",
    provider: "hetzner",
    public_ipv4: "192.0.2.1",
    status: "running",
    created_at: "2026-01-01T00:00:00Z",
  },
]);
const pagination = ref({
  type: "full",
  currentPage: 1,
  lastPage: 1,
  perPage: 15,
  total: 1,
  from: 1,
  to: 1,
});
const loadError = ref(false);
const isLoading = ref(false);
const hasLoaded = ref(true);

const failure = {
  id: "failure-1",
  title: "Site installation",
  kind_raw: "site_installation",
  detail: "Installation failed",
};
const tableStub = defineComponent({
  props: ["endpoint"],
  emits: ["row-click"],
  setup(_, { expose }) {
    expose({ refresh: mocks.refresh });
    return { failure, server: { id: "server-1", name: "production-web" } };
  },
  template: `<div>
    <slot v-if="endpoint === '/admin/servers/table'" name="cell-name" :value="server.name" :row="server" />
    <template v-else>
      <button data-test="failure-row" @click="$emit('row-click', failure)">Failure row</button>
      <slot name="cell-detail" :value="failure.detail" :row="failure" />
    </template>
  </div>`,
});

const options = {
  global: {
    stubs: {
      AdminPageHeader: false,
      Icon: true,
      DataTable: tableStub,
      Button: { template: "<button><slot /></button>" },
      FailureLogSheet: true,
      ServerDetailsSheet: true,
      ListboxFilter: true,
      CommandDialog: {
        props: ["open"],
        template: '<div v-if="open"><slot /></div>',
      },
      CommandList: { template: "<div><slot /></div>" },
      CommandItem: true,
      CommandGroup: { template: "<div><slot /></div>" },
      DialogTitle: true,
      DialogDescription: true,
      TablePagination: true,
      SharedDateTooltip: true,
    },
  },
};

describe("admin resource page presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    paletteOpen.value = false;
    vi.stubGlobal("useState", () => paletteOpen);
    rows.value = [
      {
        id: "server-1",
        name: "production-web",
        provider: "hetzner",
        public_ipv4: "192.0.2.1",
        status: "running",
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    pagination.value = {
      type: "full",
      currentPage: 1,
      lastPage: 1,
      perPage: 15,
      total: 1,
      from: 1,
      to: 1,
    };
    loadError.value = false;
    isLoading.value = false;
    hasLoaded.value = true;
    mocks.table.mockReturnValue({
      data: rows,
      meta: ref({
        columns: [],
        perPageOptions: [15, 30, 50],
        search: { enabled: true },
        emptyState: {
          title: "No servers yet",
          message: "Servers provisioned by teams will appear here.",
        },
      }),
      pagination,
      loadError,
      isLoading,
      hasLoaded,
      search: ref(""),
      refresh: mocks.refresh,
      setSearch: mocks.setSearch,
      setPage: mocks.setPage,
      setPerPage: mocks.setPerPage,
    });
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("setBreadcrumbs", vi.fn());
    vi.stubGlobal("useI18n", () => ({ ...createI18nStub(), te: () => true }));
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("navigateTo", navigate);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows app-style server cards and opens details without leaving the directory", async () => {
    const wrapper = shallowMount(ServersPage, options);
    expect(wrapper.get("h1").classes()).toContain("sr-only");
    expect(mocks.table).toHaveBeenCalledWith(
      "/admin/servers/table",
      expect.objectContaining({ syncUrl: true }),
    );
    expect(wrapper.findComponent(DataTable).exists()).toBe(false);
    expect(wrapper.findComponent(TablePagination).exists()).toBe(false);
    const card = wrapper.get('button[aria-label="View server production-web"]');
    expect(card.text()).toContain("production-web");
    expect(card.text()).toContain("192.0.2.1");
    await card.trigger("click");
    expect(wrapper.getComponent(ServerDetailsSheet).props("serverId")).toBe(
      "server-1",
    );
    expect(navigate).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("retains server-side search and pagination for a larger directory", async () => {
    pagination.value = { ...pagination.value, lastPage: 2, total: 20 };
    const wrapper = shallowMount(ServersPage, options);
    paletteOpen.value = true;
    await wrapper.vm.$nextTick();
    wrapper
      .getComponent(ListboxFilter)
      .vm.$emit("update:modelValue", "production");
    expect(mocks.setSearch).toHaveBeenCalledWith("production");
    wrapper.getComponent(TablePagination).vm.$emit("page", 2);
    wrapper.getComponent(TablePagination).vm.$emit("perPage", 30);
    expect(mocks.setPage).toHaveBeenCalledWith(2);
    expect(mocks.setPerPage).toHaveBeenCalledWith(30);
    wrapper.unmount();
  });

  it("opens the command palette and selects a server without leaving the directory", async () => {
    const wrapper = shallowMount(ServersPage, options);
    paletteOpen.value = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent(CommandDialog).props("open")).toBe(true);
    wrapper.getComponent(CommandItem).vm.$emit("select");
    await wrapper.vm.$nextTick();
    expect(wrapper.getComponent(CommandDialog).props("open")).toBe(false);
    expect(wrapper.getComponent(ServerDetailsSheet).props("serverId")).toBe(
      "server-1",
    );
    expect(navigate).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps existing cards during refresh failures and offers retry", async () => {
    const wrapper = shallowMount(ServersPage, options);
    isLoading.value = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("production-web");
    isLoading.value = false;
    loadError.value = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("production-web");
    await wrapper.get('[role="alert"] button').trigger("click");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it.each(["button[data-test='failure-row']", "button:not([data-test])"])(
    "opens the existing log sheet from %s",
    async (selector) => {
      const wrapper = shallowMount(FailuresPage, options);
      expect(wrapper.get("h1").text()).toBe("Failures");
      expect(wrapper.getComponent(DataTable).props("endpoint")).toBe(
        "/admin/failures/table",
      );
      expect(wrapper.text()).toContain("Older records may have been pruned");
      await wrapper.get(selector).trigger("click");
      const sheet = wrapper.getComponent(FailureLogSheet);
      expect(sheet.props("open")).toBe(true);
      expect(sheet.props("failure")).toEqual(failure);
      wrapper.unmount();
    },
  );

  it("reconciles deployment failures through the existing failure table", async () => {
    const wrapper = shallowMount(FailuresPage, options);
    const [refresh, settings] = mocks.liveUpdates.mock.calls[0];
    expect(settings.resources).toContain("deployment");
    await refresh();
    expect(mocks.refresh).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("reports a queued server deletion failure while retaining the server directory", async () => {
    const wrapper = shallowMount(ServersPage, options);
    const [refresh, settings] = mocks.liveUpdates.mock.calls[0];
    settings.onChange({ resource: "site", action: "deletion_failed" });
    settings.onChange({ resource: "server", action: "updated" });
    expect(mocks.error).not.toHaveBeenCalled();
    settings.onChange({
      resource: "server",
      action: "deletion_failed",
      server_id: "server-1",
    });
    await refresh();
    expect(mocks.error).toHaveBeenCalledWith("Failed to delete server");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("production-web");
    expect(navigate).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

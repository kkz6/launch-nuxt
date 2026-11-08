import { shallowMount } from "@vue/test-utils";
import { computed, defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServersPage from "../../pages/admin/servers/index.vue";
import FailuresPage from "../../pages/admin/failures.vue";
import DataTable from "../../components/data-table/DataTable.vue";
import FailureLogSheet from "../../components/admin/FailureLogSheet.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  liveUpdates: vi.fn(),
  refresh: vi.fn(),
  error: vi.fn(),
}));
vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: mocks.liveUpdates,
}));
vi.mock("vue-sonner", () => ({ toast: { error: mocks.error } }));

const navigate = vi.fn();
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
    },
  },
};

describe("admin resource page presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigate.mockReset();
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("setBreadcrumbs", vi.fn());
    vi.stubGlobal("useI18n", () => createI18nStub());
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("navigateTo", navigate);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the server search table endpoint and adds a keyboard-accessible server link", async () => {
    const wrapper = shallowMount(ServersPage, options);
    expect(wrapper.get("h1").text()).toBe("Servers");
    expect(wrapper.getComponent(DataTable).props("endpoint")).toBe(
      "/admin/servers/table",
    );
    expect(wrapper.get("#server-directory-title").text()).toBe(
      "Server directory",
    );
    const link = wrapper.get("button");
    expect(link.text()).toContain("production-web");
    await link.trigger("click");
    expect(navigate).toHaveBeenCalledWith("/admin/servers/server-1");
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

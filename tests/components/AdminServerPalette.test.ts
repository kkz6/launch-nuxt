import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServersPage from "../../pages/admin/servers/index.vue";
import ServerDetailsSheet from "../../components/admin/ServerDetailsSheet.vue";
import { CommandDialog } from "../../components/ui/command";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({ table: vi.fn() }));
vi.mock("~/composables/useTable", () => ({ useTable: mocks.table }));
vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: vi.fn(),
}));

const server = (id: string, name: string, ip: string) => ({
  id,
  name,
  provider: "hetzner",
  public_ipv4: ip,
  status: "running",
});
const rows = ref([server("server-1", "Production", "192.0.2.1")]);
const search = ref("");
const paletteOpen = ref(false);
const isLoading = ref(false);
const navigate = vi.fn();
const setSearch = vi.fn((value: string) => {
  search.value = value;
  isLoading.value = true;
});
let wrapper: VueWrapper | undefined;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
  vi.clearAllMocks();
  rows.value = [server("server-1", "Production", "192.0.2.1")];
  search.value = "";
  paletteOpen.value = false;
  vi.stubGlobal("useState", () => paletteOpen);
  isLoading.value = false;
  mocks.table.mockReturnValue({
    data: rows,
    meta: ref({ search: { enabled: true }, perPageOptions: [15, 30, 50] }),
    pagination: ref({ currentPage: 1, lastPage: 1, perPage: 15, total: 1 }),
    isLoading,
    hasLoaded: ref(true),
    loadError: ref(false),
    search,
    setSearch,
    setPage: vi.fn(),
    setPerPage: vi.fn(),
    refresh: vi.fn(),
  });
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("setBreadcrumbs", vi.fn());
  vi.stubGlobal("useI18n", () => ({ ...createI18nStub(), te: () => true }));
  vi.stubGlobal("navigateTo", navigate);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  vi.unstubAllGlobals();
});

describe("admin server search palette integration", () => {
  it.each(["pointer", "keyboard"])(
    "opens asynchronously loaded results with %s selection without leaving the directory",
    async (selection) => {
      wrapper = mount(ServersPage, {
        attachTo: document.body,
        global: {
          stubs: {
            DialogPortal: { template: "<div><slot /></div>" },
            Icon: true,
            ServerDetailsSheet: true,
            TablePagination: true,
            EmptyState: true,
          },
        },
      });
      paletteOpen.value = true;
      await flushPromises();
      const dialog = wrapper.get('[role="dialog"]');
      expect(dialog.text()).toContain("All teams");
      expect(dialog.get('[role="option"]').text()).toContain("Production");
      const input = dialog.get('input[aria-label="Search servers"]');
      await input.setValue("198.51.100.7");
      expect(setSearch).toHaveBeenLastCalledWith("198.51.100.7");
      expect(dialog.find('[role="option"]').exists()).toBe(false);
      expect(dialog.find('[role="status"]').exists()).toBe(true);
      rows.value = [
        server("server-2", "Another team's server", "198.51.100.7"),
      ];
      isLoading.value = false;
      await flushPromises();
      const result = dialog.get('[role="option"]');
      expect(result.text()).toContain("Another team's server");
      expect(result.text()).not.toContain("Production");
      if (selection === "keyboard") {
        await input.trigger("keydown", { key: "ArrowDown" });
        expect(input.attributes("aria-activedescendant")).toBe(
          result.attributes("id"),
        );
        await input.trigger("keydown", { key: "Enter" });
      } else {
        await result.trigger("click");
      }
      await flushPromises();
      expect(wrapper.getComponent(CommandDialog).props("open")).toBe(false);
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
      expect(wrapper.getComponent(ServerDetailsSheet).props("serverId")).toBe(
        "server-2",
      );
      expect(search.value).toBe("198.51.100.7");
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});

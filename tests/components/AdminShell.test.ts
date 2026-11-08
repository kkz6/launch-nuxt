import {
  flushPromises,
  mount,
  renderToString,
  type VueWrapper,
} from "@vue/test-utils";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  resolveComponent,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navigation from "../../components/admin/Navigation.vue";
import DefaultLayout from "../../layouts/default.vue";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useImpersonation", () => ({
  useImpersonation: () => ({
    isImpersonating: ref(false),
    impersonatedName: ref(""),
    stop: vi.fn(),
  }),
}));

const route = reactive({ path: "/admin/overview" });
const initialized = ref(true);
const authenticated = ref(true);
const link = {
  props: ["to"],
  template: '<a :href="to" @click.prevent><slot /></a>',
};
const stubs = {
  NuxtLink: link,
  Icon: true,
  Toaster: true,
  LayoutNavbar: { template: "<header data-shared-navbar>launchctl</header>" },
  LayoutPlatformUpdateBanner: true,
};
let wrappers: VueWrapper[] = [];

beforeEach(() => {
  route.path = "/admin/overview";
  initialized.value = true;
  authenticated.value = true;
  for (const [name, value] of Object.entries({
    ref,
    computed,
    defineComponent,
    watch,
    onMounted,
    onBeforeUnmount,
    nextTick,
    resolveComponent,
  })) {
    vi.stubGlobal(name, value);
  }
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useI18n", () => createI18nStub());
  vi.stubGlobal("useColorMode", () => ({ preference: "light" }));
  vi.stubGlobal("useAuth", () => ({
    isAuthenticated: authenticated,
    isInitialized: initialized,
  }));
});

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  wrappers = [];
  vi.unstubAllGlobals();
});

describe("shared admin tabs", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/users/customer", "/admin"],
    ["/admin/overview", "/admin/overview"],
    ["/admin/invitations", "/admin/invitations"],
    ["/admin/servers/server", "/admin/servers"],
    ["/admin/failures", "/admin/failures"],
    ["/admin/observability/", "/admin/observability"],
  ])("marks only the correct section current for %s", (path, expected) => {
    route.path = path;
    const wrapper = mount(Navigation, { global: { stubs } });
    wrappers.push(wrapper);
    expect(wrapper.get("nav").attributes("aria-label")).toBe(
      "Admin navigation",
    );
    expect(wrapper.findAll('a[aria-current="page"]')).toHaveLength(1);
    expect(wrapper.get('a[aria-current="page"]').attributes("href")).toBe(
      expected,
    );
    expect(wrapper.findAll("a")).toHaveLength(6);
  });

  it("does not select a section for a similarly prefixed route", () => {
    route.path = "/admin/servers-extra";
    const wrapper = mount(Navigation, { global: { stubs } });
    wrappers.push(wrapper);
    expect(wrapper.find('[aria-current="page"]').exists()).toBe(false);
  });
});

describe("workspace frame", () => {
  it("renders the frame and admin tabs on the server without mounting protected content", async () => {
    route.path = "/admin/servers";
    const html = await renderToString(DefaultLayout, {
      slots: { default: "<div data-protected>Protected table</div>" },
      global: { stubs },
    });
    expect(html).toContain('id="app-container"');
    expect(html).toContain("font-sans");
    expect(html).toContain('aria-label="Admin navigation"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("data-protected");
  });

  it.each(["/admin/servers", "/servers"])(
    "keeps %s framed while authentication loads",
    async (path) => {
      route.path = path;
      initialized.value = false;
      authenticated.value = false;
      const pageMounted = vi.fn();
      const wrapper = mount(DefaultLayout, {
        slots: {
          default: defineComponent({
            setup() {
              pageMounted();
            },
            template: "<div data-protected>Content</div>",
          }),
        },
        global: { stubs },
      });
      wrappers.push(wrapper);
      await flushPromises();
      expect(pageMounted).not.toHaveBeenCalled();
      expect(wrapper.get("main").attributes("id")).toBe("workspace-content");
      expect(wrapper.get("main").attributes("tabindex")).toBe("-1");
      expect(wrapper.find('a[href="#workspace-content"]').exists()).toBe(true);
      expect(wrapper.find('[role="status"]').exists()).toBe(true);
      initialized.value = true;
      authenticated.value = true;
      await flushPromises();
      expect(pageMounted).toHaveBeenCalledTimes(1);
      expect(wrapper.findAll("[data-shared-navbar]")).toHaveLength(1);
      expect(wrapper.get("main").text()).toBe("Content");
      expect(wrapper.find('[role="status"]').exists()).toBe(false);
      authenticated.value = false;
      await nextTick();
      expect(wrapper.find("[data-protected]").exists()).toBe(false);
      expect(wrapper.find("#app-container").exists()).toBe(true);
    },
  );
});

import {
  flushPromises,
  mount,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navigation from "../../components/admin/Navigation.vue";
import Shell from "../../components/admin/Shell.vue";
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
const breadcrumbs = ref({
  path: "/admin/overview",
  crumbs: [{ label: "Admin", to: "/admin/overview" }, { label: "Overview" }],
});
const link = {
  props: ["to"],
  template: '<a :href="to" @click.prevent><slot /></a>',
};
let wrappers: VueWrapper[] = [];

beforeEach(() => {
  route.path = "/admin/overview";
  breadcrumbs.value = {
    path: route.path,
    crumbs: [{ label: "Admin", to: "/admin/overview" }, { label: "Overview" }],
  };
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("usePageBreadcrumbState", () => breadcrumbs);
  vi.stubGlobal("useI18n", () => createI18nStub());
  vi.stubGlobal("useColorMode", () => ({ preference: "light" }));
  vi.stubGlobal("useAuth", () => ({
    isAuthenticated: ref(true),
    isInitialized: ref(true),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount());
  wrappers = [];
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("admin navigation", () => {
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
    const wrapper = mount(Navigation, {
      global: { stubs: { NuxtLink: link, Icon: true } },
    });
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
    const wrapper = mount(Navigation, {
      global: { stubs: { NuxtLink: link, Icon: true } },
    });
    wrappers.push(wrapper);
    expect(wrapper.find('[aria-current="page"]').exists()).toBe(false);
  });
});

describe("admin shell", () => {
  it("keeps route-scoped breadcrumbs and a keyboard content target", async () => {
    const wrapper = mount(Shell, {
      attachTo: document.body,
      slots: { default: "Page content" },
      global: { stubs: { NuxtLink: link, Icon: true } },
    });
    wrappers.push(wrapper);
    expect(
      wrapper
        .findAll('nav[aria-label="Breadcrumb"] li')
        .map((item) => item.text()),
    ).toEqual(["Admin", "Overview"]);
    expect(wrapper.get('a[href="#admin-content"]').text()).toBe(
      "Skip to content",
    );
    expect(wrapper.get("main").attributes("tabindex")).toBe("-1");
    expect(wrapper.get("main").text()).toBe("Page content");
    route.path = "/admin/servers";
    await nextTick();
    expect(wrapper.get('nav[aria-label="Breadcrumb"]').text()).toBe(
      "Administration",
    );
  });

  it("opens an accessible mobile drawer and closes it after navigation", async () => {
    const wrapper = mount(Shell, {
      attachTo: document.body,
      global: { stubs: { NuxtLink: link, Icon: true } },
    });
    wrappers.push(wrapper);
    const trigger = wrapper.get('button[aria-label="Open admin navigation"]');
    expect(trigger.attributes("aria-expanded")).toBe("false");
    await trigger.trigger("click");
    await flushPromises();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog?.textContent).toContain("Administration");
    (
      dialog?.querySelector('a[href="/admin/servers"]') as HTMLAnchorElement
    ).click();
    await flushPromises();
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });

  it("uses the admin shell only for admin routes and retains the shared account navbar", async () => {
    const wrapper = shallowMount(DefaultLayout, {
      slots: { default: "Content" },
      global: {
        stubs: {
          AdminShell: {
            template:
              '<section data-admin-shell><slot name="toolbar" /><slot /></section>',
          },
          LayoutNavbar: true,
          LayoutPlatformUpdateBanner: true,
          Icon: true,
        },
      },
    });
    wrappers.push(wrapper);
    await nextTick();
    expect(wrapper.find("[data-admin-shell]").exists()).toBe(true);
    expect(wrapper.find("layout-navbar-stub").exists()).toBe(true);
    expect(wrapper.findAll("layout-navbar-stub")).toHaveLength(1);
    expect(wrapper.get("layout-navbar-stub").attributes()).toHaveProperty(
      "compact",
    );
    route.path = "/servers";
    await nextTick();
    expect(wrapper.find("[data-admin-shell]").exists()).toBe(false);
    expect(wrapper.get("main").text()).toBe("Content");
    expect(wrapper.find("layout-navbar-stub").exists()).toBe(true);
    expect(
      wrapper.get("layout-navbar-stub").attributes("compact"),
    ).toBeUndefined();
  });
});

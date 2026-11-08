import { readFileSync } from "node:fs";
import { flushPromises, mount } from "@vue/test-utils";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  resolveComponent,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TabStrip from "../../components/layout/TabStrip.vue";

const focusClasses = [
  "outline-none",
  "focus-visible:!outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-inset",
  "focus-visible:ring-ring",
];

const mountTabStrip = (toLink?: (tab: { value: string }) => string) =>
  mount(TabStrip, {
    props: {
      tabs: [{ value: "metrics", label: "Metrics", icon: "lucide:activity" }],
      activeKey: "metrics",
      ...(toLink ? { toLink } : {}),
    },
    global: {
      stubs: {
        Icon: true,
        NuxtLink: {
          props: ["to"],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });

const resourceTabs = (name = "User") => [
  { value: "profile", label: name, icon: "lucide:user" },
  { value: "sites", label: "Sites", icon: "lucide:globe" },
];
const rect = (left: number, width: number) => ({ left, width }) as DOMRect;

function mockResizeObserver() {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  let notify!: () => void;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
      constructor(callback: () => void) {
        notify = callback;
      }
    },
  );
  return { observe, unobserve, disconnect, notify: () => notify() };
}

describe("TabStrip focus treatment", () => {
  beforeEach(() => {
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("nextTick", nextTick);
    vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("resolveComponent", resolveComponent);
    vi.stubGlobal("watch", watch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("replaces the native outline on routed tabs", () => {
    const wrapper = mountTabStrip((tab) => `/servers/1?tab=${tab.value}`);

    expect(wrapper.get("a").classes()).toEqual(
      expect.arrayContaining(focusClasses),
    );
    wrapper.unmount();
  });

  it("uses the same focus treatment for local button tabs", () => {
    const wrapper = mountTabStrip();

    expect(wrapper.get("button").classes()).toEqual(
      expect.arrayContaining(focusClasses),
    );
    wrapper.unmount();
  });

  it("owns pointer and keyboard focus treatment globally", () => {
    const css = readFileSync("assets/css/main.css", "utf8");

    expect(css).toMatch(
      /html\[data-focus-modality\] :focus\s*{\s*outline:\s*none;\s*}/,
    );
    expect(css).toMatch(
      /html\[data-focus-modality="keyboard"\] :focus-visible\s*{\s*outline:\s*2px solid hsl\(var\(--ring\)\);\s*outline-offset:\s*2px;\s*}/,
    );
    expect(css).toContain("--ring: transparent");
  });

  it("realigns the selected tab after an earlier label loads without changing tab count", async () => {
    const wrapper = mountTabStrip();
    await wrapper.setProps({ tabs: resourceTabs(), activeKey: "sites" });
    const nav = wrapper.get("nav").element;
    const selected = wrapper.findAll("button")[1].element;
    let left = 420.671875;
    vi.spyOn(nav, "getBoundingClientRect").mockReturnValue(rect(100, 500));
    vi.spyOn(selected, "getBoundingClientRect").mockImplementation(() =>
      rect(left, 79.4453),
    );
    window.dispatchEvent(new Event("resize"));
    await nextTick();
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "left: 320.671875px",
    );

    left = 472.296875;
    await wrapper.setProps({ tabs: resourceTabs("Alex Morgan") });
    await flushPromises();
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "left: 372.296875px",
    );
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "width: 79.4453px",
    );
    wrapper.unmount();
  });

  it("keeps the underline in content coordinates while the tab strip scrolls", async () => {
    const wrapper = mountTabStrip();
    await wrapper.setProps({ tabs: resourceTabs(), activeKey: "sites" });
    const nav = wrapper.get("nav").element;
    const selected = wrapper.findAll("button")[1].element;
    let left = 220;
    vi.spyOn(nav, "getBoundingClientRect").mockReturnValue(rect(100, 200));
    vi.spyOn(selected, "getBoundingClientRect").mockImplementation(() =>
      rect(left, 80),
    );
    nav.scrollLeft = 60;
    await wrapper.get("nav").trigger("scroll");
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "left: 180px",
    );
    nav.scrollLeft = 90;
    left = 190;
    await wrapper.get("nav").trigger("scroll");
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "left: 180px",
    );
    wrapper.unmount();
  });

  it("observes tab and nav layout changes and releases observers and resize handlers", async () => {
    const observer = mockResizeObserver();
    const removeListener = vi.spyOn(window, "removeEventListener");
    const wrapper = mountTabStrip();
    await wrapper.setProps({ tabs: resourceTabs(), activeKey: "sites" });
    const nav = wrapper.get("nav").element;
    const [profile, sites] = wrapper
      .findAll("button")
      .map((tab) => tab.element);
    expect(observer.observe).toHaveBeenCalledWith(nav);
    expect(observer.observe).toHaveBeenCalledWith(profile);
    expect(observer.observe).toHaveBeenCalledWith(sites);
    const measureNav = vi
      .spyOn(nav, "getBoundingClientRect")
      .mockReturnValue(rect(100, 300));
    const measureTab = vi
      .spyOn(sites, "getBoundingClientRect")
      .mockReturnValue(rect(250, 85));
    observer.notify();
    await nextTick();
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "left: 150px; width: 85px",
    );
    measureTab.mockReturnValue(rect(270, 90));
    observer.notify();
    await nextTick();
    expect(wrapper.get("nav > span").attributes("style")).toContain(
      "left: 170px; width: 90px",
    );

    await wrapper.setProps({ tabs: [resourceTabs()[1]] });
    expect(observer.unobserve).toHaveBeenCalledWith(profile);
    wrapper.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
    measureNav.mockClear();
    observer.notify();
    window.dispatchEvent(new Event("resize"));
    expect(measureNav).not.toHaveBeenCalled();
  });
});

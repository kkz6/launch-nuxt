import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
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
});

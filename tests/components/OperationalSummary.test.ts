import { mount } from "@vue/test-utils";
import { computed } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OperationalSummary from "../../components/server/metrics/OperationalSummary.vue";

describe("OperationalSummary", () => {
  beforeEach(() => {
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("useI18n", () => ({
      t: (key: string) => key,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the operational readout as a fully bordered panel", () => {
    const wrapper = mount(OperationalSummary, {
      props: {
        metrics: null,
        history: [],
        systemInfo: null,
      },
      global: {
        stubs: {
          DockerStatusIndicator: true,
          Icon: true,
          NuxtLink: true,
        },
      },
    });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "overflow-hidden",
        "rounded-lg",
        "border",
        "border-border",
        "bg-card",
      ]),
    );
    expect(wrapper.classes()).not.toContain("border-y");
  });
});

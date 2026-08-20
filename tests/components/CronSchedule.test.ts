import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CronSchedule from "../../components/shared/CronSchedule.vue";

const passthrough = { template: "<div><slot /></div>" };

vi.stubGlobal("useI18n", () => ({
  locale: { value: "en" },
  t: (key: string, params?: Record<string, unknown>) => {
    if (key === "common.cron.timesUse") return `Times use ${params?.timeZone}.`;
    if (key === "common.cron.accessibleWithTimeZone")
      return `${params?.expression}: ${params?.description}. Times use ${params?.timeZone}.`;
    return `${params?.expression}: ${params?.description}.`;
  },
}));

const mountComponent = (props: Record<string, unknown>) =>
  mount(CronSchedule, {
    props,
    global: {
      stubs: {
        Tooltip: passthrough,
        TooltipContent: passthrough,
        TooltipProvider: passthrough,
        TooltipTrigger: passthrough,
      },
    },
  });

describe("CronSchedule", () => {
  it("shows the cron expression with a human description and time zone", () => {
    const wrapper = mountComponent({
      expression: "0 3 * * *",
      timeZone: "UTC",
      className: "custom-class",
    });

    const code = wrapper.get("code");
    expect(code.text()).toBe("0 3 * * *");
    expect(code.attributes("tabindex")).toBe("0");
    expect(code.attributes("aria-label")).toBe(
      "0 3 * * *: Every day at 3:00 AM. Times use UTC.",
    );
    expect(code.classes()).toContain("custom-class");
    expect(wrapper.text()).toContain("Every day at 3:00 AM");
    expect(wrapper.text()).toContain("Times use UTC.");
  });

  it("omits the time-zone note when none is provided", () => {
    const wrapper = mountComponent({ expression: "0 * * * *" });

    expect(wrapper.get("code").attributes("aria-label")).toBe(
      "0 * * * *: Every hour.",
    );
    expect(wrapper.text()).not.toContain("Times use");
  });

  it("renders a non-interactive fallback without an expression", () => {
    const wrapper = mountComponent({ expression: "  " });

    expect(wrapper.text()).toBe("—");
    expect(wrapper.find("code").exists()).toBe(false);
  });
});

import { mount } from "@vue/test-utils";
import { computed } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DockerStatusIndicator from "../../components/docker/StatusIndicator.vue";

describe("DockerStatusIndicator", () => {
  beforeEach(() => {
    vi.stubGlobal("computed", computed);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["running", "bg-emerald-500", "text-emerald-700"],
    ["building", "bg-amber-500", "text-amber-700"],
    ["failed", "bg-rose-500", "text-rose-700"],
    ["stopped", "bg-muted-foreground/55", "text-muted-foreground"],
  ])("renders %s as a calm dot-and-label status", (status, dot, textClass) => {
    const wrapper = mount(DockerStatusIndicator, { props: { status } });

    expect(wrapper.text()).toBe(status);
    expect(wrapper.attributes("aria-label")).toBe(`Status: ${status}`);
    expect(wrapper.classes()).toContain(textClass);
    expect(wrapper.get("[aria-hidden='true']").classes()).toContain(dot);
    expect(wrapper.classes()).not.toContain("rounded-full");
  });

  it("uses a clearer label while preserving the status colour", () => {
    const wrapper = mount(DockerStatusIndicator, {
      props: { status: "building", label: "Deploying" },
    });

    expect(wrapper.text()).toBe("Deploying");
    expect(wrapper.get("[aria-hidden='true']").classes()).toContain(
      "animate-pulse",
    );
  });
});

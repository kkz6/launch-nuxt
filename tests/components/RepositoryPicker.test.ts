import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RepositoryPicker from "../../components/shared/RepositoryPicker.vue";
import type { Repository } from "../../types";

const repository = (id: string, fullName: string): Repository => ({
  id,
  name: fullName.split("/")[1]!,
  full_name: fullName,
  html_url: `https://github.com/${fullName}`,
  default_branch: "main",
  public: false,
});
const repositories = [
  repository("one", "first/project"),
  repository("two", "second/website"),
];
let wrapper: VueWrapper | undefined;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
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

const render = () => {
  wrapper = mount(RepositoryPicker, {
    attachTo: document.body,
    props: {
      id: "repository",
      modelValue: null,
      repositories,
      label: "Repository",
      placeholder: "Search repositories",
      emptyText: "No repositories found",
    },
    global: { stubs: { PopoverPortal: { template: "<div><slot /></div>" } } },
  });
  return wrapper;
};

describe("repository picker", () => {
  it.each(["pointer", "keyboard"])(
    "searches by owner and selects only supplied repositories with %s",
    async (selection) => {
      const picker = render();
      await picker.get('button[role="combobox"]').trigger("click");
      await flushPromises();
      const input = picker.get("input");
      await input.setValue("SECOND");
      await flushPromises();
      const options = picker.findAll('[role="option"]');
      expect(options).toHaveLength(1);
      expect(options[0]!.text()).toBe("second/website");
      expect(picker.emitted("update:searchTerm")?.at(-1)).toEqual(["SECOND"]);
      if (selection === "keyboard") {
        await input.trigger("keydown", { key: "ArrowDown" });
        await input.trigger("keydown", { key: "Enter" });
      } else {
        await options[0]!.trigger("click");
      }
      await flushPromises();
      expect(picker.emitted("update:modelValue")).toEqual([[repositories[1]]]);
      expect(
        picker.get('button[role="combobox"]').attributes("aria-expanded"),
      ).toBe("false");
    },
  );

  it("closes when its account starts loading and cannot retain a previous account's list", async () => {
    const picker = render();
    await picker.get('button[role="combobox"]').trigger("click");
    await flushPromises();
    await picker.setProps({ disabled: true, repositories: [] });
    await flushPromises();
    expect(
      picker.get('button[role="combobox"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      picker.get('button[role="combobox"]').attributes("aria-expanded"),
    ).toBe("false");
    expect(picker.find('[role="option"]').exists()).toBe(false);
    expect(picker.emitted("update:modelValue")).toBeUndefined();
    await picker.setProps({
      disabled: false,
      repositories: [repository("three", "third/private")],
    });
    await picker.get('button[role="combobox"]').trigger("click");
    await flushPromises();
    expect(
      picker.findAll('[role="option"]').map((option) => option.text()),
    ).toEqual(["third/private"]);
  });
});

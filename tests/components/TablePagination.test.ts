import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TablePagination from "../../components/data-table/TablePagination.vue";
import { Select, SelectItem } from "../../components/ui/select";
import type { PaginationData } from "../../types/data-table";
import { createI18nStub } from "../helpers/i18n";

const pagination = (perPage = 15): PaginationData => ({
  type: "full",
  currentPage: 1,
  lastPage: 4,
  perPage,
  total: 60,
  from: 1,
  to: perPage,
});

let wrapper: VueWrapper | undefined;

describe("shared table page-size selector", () => {
  beforeEach(() => {
    vi.stubGlobal("useI18n", createI18nStub);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it.each([
    [25, 50, 100],
    [20, 50, 100],
  ])(
    "displays the active 15 per page when configured choices are %j",
    async (...choices) => {
      wrapper = mount(TablePagination, {
        attachTo: document.body,
        props: { pagination: pagination(), perPageOptions: choices },
      });
      await flushPromises();
      const trigger = wrapper.get('[role="combobox"]');
      expect(trigger.text()).toBe("15 per page");
      expect(trigger.attributes("aria-label")).toBe("15 per page");
      expect(wrapper.emitted("perPage")).toBeUndefined();
    },
  );

  it("deduplicates and orders valid choices while preserving page-size changes", async () => {
    wrapper = mount(TablePagination, {
      attachTo: document.body,
      props: {
        pagination: pagination(),
        perPageOptions: [100, 25, 15, 25, 0, -1],
      },
    });
    await flushPromises();
    expect(
      wrapper.findAllComponents(SelectItem).map((item) => item.props("value")),
    ).toEqual(["15", "25", "100"]);
    wrapper.getComponent(Select).vm.$emit("update:modelValue", "25");
    await flushPromises();
    expect(wrapper.emitted("perPage")).toEqual([[25]]);
    await wrapper.setProps({ pagination: pagination(25) });
    await flushPromises();
    expect(wrapper.get('[role="combobox"]').text()).toBe("25 per page");
    expect(wrapper.get('[role="combobox"]').attributes("aria-label")).toBe(
      "25 per page",
    );
  });
});

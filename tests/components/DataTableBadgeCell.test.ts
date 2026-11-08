import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import BadgeCell from "../../components/data-table/columns/BadgeCell.vue";
import type { ColumnDef } from "../../types/data-table";

const column = { key: "status", type: "badge" } as ColumnDef;

describe("table resource status badges", () => {
  it.each([
    ["success", "green"],
    ["info", "blue"],
    ["warning", "orange"],
    ["destructive", "red"],
    ["secondary", "blank"],
    ["outline", "outline"],
  ])(
    "maps API %s to the existing app %s badge without changing the localized label",
    (apiVariant, variant) => {
      const wrapper = shallowMount(BadgeCell, {
        props: { column, value: { value: "実行中", variant: apiVariant } },
        global: { renderStubDefaultSlot: true },
      });
      expect(wrapper.findComponent({ name: "Badge" }).props("variant")).toBe(
        variant,
      );
      expect(wrapper.text()).toBe("実行中");
    },
  );

  it("keeps unmapped text readable and missing values empty", () => {
    expect(
      shallowMount(BadgeCell, {
        props: { column, value: "Custom status" },
      }).text(),
    ).toBe("Custom status");
    expect(
      shallowMount(BadgeCell, { props: { column, value: null } }).text(),
    ).toBe("");
  });
});

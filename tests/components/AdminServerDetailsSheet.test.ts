import { shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetailsSheet from "../../components/admin/ServerDetailsSheet.vue";
import ServerDetail from "../../components/admin/ServerDetail.vue";
import { createI18nStub } from "../helpers/i18n";

const slots = { template: "<div><slot /></div>" };
const mountDetails = (serverId: string | null = "server-1") =>
  shallowMount(ServerDetailsSheet, {
    props: { serverId },
    global: {
      stubs: {
        Sheet: {
          ...slots,
          name: "Sheet",
          props: ["open"],
          emits: ["update:open"],
        },
        SheetContent: slots,
        SheetHeader: slots,
        SheetTitle: { template: "<h2><slot /></h2>" },
        SheetDescription: { template: "<p><slot /></p>" },
      },
    },
  });

beforeEach(() => vi.stubGlobal("useI18n", createI18nStub));
afterEach(() => vi.unstubAllGlobals());

describe("admin server details sheet", () => {
  it("opens the selected server in an accessible sheet and resets the title when selection changes", async () => {
    const wrapper = mountDetails(null);
    expect(wrapper.getComponent({ name: "Sheet" }).props("open")).toBe(false);
    expect(wrapper.findComponent(ServerDetail).exists()).toBe(false);
    await wrapper.setProps({ serverId: "server-1" });
    expect(wrapper.getComponent({ name: "Sheet" }).props("open")).toBe(true);
    const detail = wrapper.getComponent(ServerDetail);
    expect(detail.props("serverId")).toBe("server-1");
    detail.vm.$emit("loaded", { id: "server-1", name: "Production" });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("h2").text()).toBe("Production");
    expect(
      wrapper.get("h2").element.parentElement?.classList.contains("sr-only"),
    ).toBe(true);
    expect(wrapper.get("p").text()).toBe(
      "Ownership, configuration, and lifecycle for this server.",
    );
    await wrapper.setProps({ serverId: "server-2" });
    expect(wrapper.getComponent(ServerDetail).props("serverId")).toBe(
      "server-2",
    );
    expect(wrapper.get("h2").text()).toBe("Server");
    wrapper
      .getComponent(ServerDetail)
      .vm.$emit("loaded", { id: "server-1", name: "Old server" });
    await wrapper.vm.$nextTick();
    expect(wrapper.get("h2").text()).toBe("Server");
  });

  it("keeps status updates open and closes on the detail deletion event or explicit close", async () => {
    const wrapper = mountDetails();
    const detail = wrapper.getComponent(ServerDetail);
    detail.vm.$emit("loaded", {
      id: "server-1",
      name: "Production",
      status: "deleting",
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:serverId")).toBeUndefined();
    detail.vm.$emit("deleted");
    expect(wrapper.emitted("update:serverId")).toEqual([[null]]);
    wrapper.getComponent({ name: "Sheet" }).vm.$emit("update:open", false);
    expect(wrapper.emitted("update:serverId")).toEqual([[null], [null]]);
  });
});

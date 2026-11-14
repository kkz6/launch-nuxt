import { flushPromises, shallowMount } from "@vue/test-utils";
import { ref, watch } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import ImportContaboVps from "../../components/settings/ImportContaboVps.vue";
import { createI18nStub } from "../helpers/i18n";

const { list, importVps } = vi.hoisted(() => ({
  list: vi.fn(),
  importVps: vi.fn(),
}));
vi.mock("~/services/serverService", () => ({
  serverProviderService: {
    listContaboInstances: list,
    importContaboInstance: importVps,
  },
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

it("hands a selected VPS to the SSH setup dialog after import", async () => {
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useCan", () => ({ canEdit: ref(true) }));
  const refresh = ref(0);
  vi.stubGlobal("useState", () => refresh);
  list.mockResolvedValue({
    data: {
      page: 1,
      total_pages: 1,
      instances: [
        {
          id: "9007199254740993",
          name: "My VPS",
          ip: "8.8.4.4",
          can_import: true,
        },
        {
          id: "2",
          name: "Other VPS",
          imported_server_id: "existing",
          can_import: false,
        },
      ],
    },
  });
  importVps.mockResolvedValue({
    data: { id: "new-server", provision_command: "ssh setup command" },
  });

  const wrapper = shallowMount(ImportContaboVps, {
    props: { accountId: "account", profile: "My account" },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        Select: {
          props: ["modelValue"],
          template: `<select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><slot /></select>`,
        },
        SelectContent: { template: "<slot />" },
        SelectTrigger: true,
        SelectItem: {
          props: ["value"],
          template: '<option :value="value">{{ value }}</option>',
        },
        ServerProvisionCommandDialog: {
          name: "ServerProvisionCommandDialog",
          props: ["open", "serverId", "provisionCommand"],
          template: "<div />",
        },
      },
    },
  });
  wrapper.getComponent({ name: "Dialog" }).vm.$emit("update:open", true);
  await flushPromises();
  expect(list).toHaveBeenCalledWith("account", 1);
  expect(wrapper.text()).toContain("Already imported");
  await wrapper.get("li button-stub").trigger("click");
  await wrapper.findAll("select")[1].setValue("ubuntu_24");
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  expect(importVps).toHaveBeenCalledWith("account", {
    instance_id: "9007199254740993",
    type: "php",
    operating_system: "ubuntu_24",
    port: 22,
  });
  expect(refresh.value).toBe(1);
  expect(
    wrapper.getComponent({ name: "ServerProvisionCommandDialog" }).props(),
  ).toMatchObject({
    open: true,
    serverId: "new-server",
    provisionCommand: "ssh setup command",
  });
});

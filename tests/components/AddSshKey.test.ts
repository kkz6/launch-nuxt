import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddSshKey from "../../components/server/AddSshKey.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const savedId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const attachedId = "01ARZ3NDEKTSV4RRFFQ69G5FAW";

const mountDialog = () =>
  shallowMount(AddSshKey, {
    props: { serverId: "server" },
    global: {
      stubs: {
        Icon: true,
        SharedConfirmationDialog: defineComponent({
          setup(_, { expose }) {
            expose({ show: mocks.confirm });
            return () => null;
          },
        }),
        ...Object.fromEntries(
          [
            "Dialog",
            "DialogContent",
            "DialogDescription",
            "DialogFooter",
            "DialogHeader",
            "DialogTitle",
            "DialogTrigger",
            "Select",
            "SelectContent",
            "SelectItem",
            "SelectTrigger",
            "SelectValue",
            "Button",
            "Label",
          ].map((name) => [name, { template: "<div><slot /></div>" }]),
        ),
        Input: true,
        Textarea: true,
      },
    },
  });

const state = (wrapper: ReturnType<typeof mountDialog>) =>
  (
    wrapper.vm.$ as unknown as {
      setupState: {
        fetchAvailableKeys: () => Promise<void>;
        onSubmit: () => Promise<void>;
        availableKeys: Array<{ value: string; label: string }>;
        errors: Record<string, string>;
        isLoading: boolean;
        isOpen: boolean;
      };
    }
  ).setupState;

const setRef = (
  wrapper: ReturnType<typeof mountDialog>,
  key: string,
  value: unknown,
) => {
  (
    wrapper.vm.$ as unknown as {
      devtoolsRawSetupState: Record<string, { value: unknown }>;
    }
  ).devtoolsRawSetupState[key].value = value;
};

describe("server SSH key attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirm.mockResolvedValue({ ok: true });
    mocks.api.mockReset().mockImplementation((url: string) => {
      if (url === "/ssh-keys?global=true") {
        return Promise.resolve({
          data: [
            { id: savedId, name: "Laptop" },
            { id: attachedId, name: "Already attached" },
          ],
        });
      }
      if (url === "/servers/server/ssh-keys") {
        return Promise.resolve({ data: [{ id: attachedId }] });
      }
      throw new Error(`Unexpected endpoint: ${url}`);
    });
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useI18n", createI18nStub);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lists saved global keys and excludes keys already attached to the server", async () => {
    const wrapper = mountDialog();
    setRef(wrapper, "isOpen", true);
    await flushPromises();
    expect(state(wrapper).availableKeys).toEqual([
      { value: savedId, label: "Laptop" },
    ]);
    expect(wrapper.text()).toContain("Laptop");
    expect(wrapper.text()).not.toContain("Already attached");
  });

  it("attaches a saved key using its real ID", async () => {
    const wrapper = mountDialog();
    setRef(wrapper, "selectedKeyId", savedId);
    await state(wrapper).onSubmit();
    expect(mocks.api).toHaveBeenCalledWith("/servers/server/ssh-keys", {
      method: "POST",
      body: { ssh_key_id: savedId },
    });
    expect(wrapper.emitted("created")).toHaveLength(1);
  });

  it("submits a custom key without the custom sentinel as an ID", async () => {
    const wrapper = mountDialog();
    setRef(wrapper, "selectedKeyId", "custom");
    setRef(wrapper, "name", " Laptop ");
    setRef(wrapper, "publicKey", "  ssh-ed25519 AAAA user@example.com\n");
    await state(wrapper).onSubmit();
    expect(mocks.api).toHaveBeenCalledWith("/servers/server/ssh-keys", {
      method: "POST",
      body: { name: "Laptop", public_key: "ssh-ed25519 AAAA user@example.com" },
    });
    expect(wrapper.emitted("created")).toHaveLength(1);
  });

  it("reports failures loading saved keys", async () => {
    mocks.api.mockRejectedValueOnce(new Error("load failed"));
    const wrapper = mountDialog();
    await state(wrapper).fetchAvailableKeys();
    expect(mocks.error).toHaveBeenCalledWith("Failed to load SSH keys");
    expect(state(wrapper).availableKeys).toEqual([]);
  });

  it("keeps server validation errors visible and does not emit success", async () => {
    const wrapper = mountDialog();
    setRef(wrapper, "selectedKeyId", "custom");
    setRef(wrapper, "name", "Laptop");
    setRef(wrapper, "publicKey", "ssh-ed25519 AAAA");
    mocks.api.mockRejectedValueOnce({
      data: { errors: { public_key: ["Invalid key"] } },
    });
    await state(wrapper).onSubmit();
    expect(state(wrapper).errors.public_key).toBe("Invalid key");
    expect(state(wrapper).isLoading).toBe(false);
    expect(wrapper.emitted("created")).toBeUndefined();
  });

  it("does not attach when confirmation is cancelled", async () => {
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    const wrapper = mountDialog();
    setRef(wrapper, "selectedKeyId", savedId);
    await state(wrapper).onSubmit();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});

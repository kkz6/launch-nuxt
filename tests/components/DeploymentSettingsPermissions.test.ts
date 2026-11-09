import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DeploymentSettings from "../../components/site/DeploymentSettings.vue";
import { useCan } from "../../composables/useCan";
import type { Site } from "~/types";
import { createI18nStub } from "../helpers/i18n";

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
const user = ref({ role: "editor" });
const api = vi.fn();
const confirm = vi.fn();
const confirmationDialog = defineComponent({
  setup(_, { expose }) {
    expose({ show: confirm });
    return () => null;
  },
});
let wrapper: ReturnType<typeof shallowMount>;

beforeEach(() => {
  user.value = { role: "editor" };
  api.mockReset().mockResolvedValue({});
  confirm.mockReset().mockResolvedValue({ ok: true });
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useImpersonation", () => ({ isImpersonating: ref(false) }));
  vi.stubGlobal("useCan", useCan);
  vi.stubGlobal("$api", api);
  wrapper = shallowMount(DeploymentSettings, {
    props: { serverId: "server", site: { id: "site" } as Site },
    global: {
      stubs: {
        Dialog: { template: "<div><slot /></div>" },
        DialogTrigger: { template: "<div><slot /></div>" },
        DialogContent: { template: "<div><slot /></div>" },
        Button: { template: "<button><slot /></button>" },
        SharedConfirmationDialog: confirmationDialog,
        Icon: true,
        Textarea: true,
        SharedCodeEditor: true,
      },
    },
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

it("allows Editors to confirm deployment settings changes", async () => {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith(
    "/servers/server/sites/site/deployment-settings",
    expect.objectContaining({ method: "PATCH" }),
  );
});

it("hides the settings dialog and cancels a confirmed save after switching to Member", async () => {
  let accept!: (value: { ok: boolean }) => void;
  confirm.mockReturnValue(
    new Promise((resolve) => {
      accept = resolve;
    }),
  );
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  user.value = { role: "member" };
  accept({ ok: true });
  await flushPromises();
  expect(api).not.toHaveBeenCalled();
  expect(wrapper.find("form").exists()).toBe(false);
  expect(wrapper.find("button").exists()).toBe(false);
});

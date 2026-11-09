import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, ref, watch } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Autodeploy from "../../components/site/Autodeploy.vue";
import { useCan } from "../../composables/useCan";
import { createI18nStub } from "../helpers/i18n";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const user = ref({ role: "editor" });
const api = vi.fn();
let wrapper: ReturnType<typeof shallowMount>;

beforeEach(() => {
  user.value = { role: "editor" };
  api.mockReset().mockResolvedValue({});
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useImpersonation", () => ({ isImpersonating: ref(false) }));
  vi.stubGlobal("useCan", useCan);
  vi.stubGlobal("$api", api);
  wrapper = shallowMount(Autodeploy, {
    props: { serverId: "server", siteId: "site" },
  });
});
afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

it("lets Editors change auto-deploy", async () => {
  wrapper.getComponent({ name: "Switch" }).vm.$emit("update:modelValue", true);
  await flushPromises();
  expect(api).toHaveBeenCalledWith("/servers/server/sites/site/autodeploy", {
    method: "POST",
    body: { enabled: true },
  });
});

it("hides auto-deploy and rejects a pending toggle after switching to Member", async () => {
  const toggle = wrapper.getComponent({ name: "Switch" });
  user.value = { role: "member" };
  toggle.vm.$emit("update:modelValue", true);
  await flushPromises();
  expect(api).not.toHaveBeenCalled();
  expect(wrapper.findComponent({ name: "Switch" }).exists()).toBe(false);
});

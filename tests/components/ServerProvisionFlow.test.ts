import { flushPromises, shallowMount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ServersPage from "../../pages/servers/index.vue";
import { useServersStore } from "../../stores/useServersStore";
import type { Server } from "../../types";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("~/services/serverService", () => ({
  serverService: { list: mocks.list },
}));

const serverId = "01k123456789abcdefghjkmnpq";
const command = {
  props: ["open", "serverId"],
  template: '<div v-if="open">Command for {{ serverId }}</div>',
};
const logs = {
  props: ["open", "server"],
  template:
    '<div v-if="open">Status for {{ server?.id }} {{ server?.status }}</div>',
};

beforeEach(() => {
  for (const [name, value] of Object.entries({
    computed,
    onMounted,
    ref,
    watch,
    definePageMeta: vi.fn(),
    useHead: vi.fn(),
    useServerEvents: vi.fn(),
    useNavbarCache: () => ({ cacheServer: vi.fn() }),
    useCan: () => ({ canEdit: ref(true) }),
    useRoute: () => reactive({ query: { provision: serverId } }),
    useAuth: () => ({ user: ref({ current_team_id: "team" }) }),
    useState: (_key: string, init: () => unknown) => ref(init()),
    useI18n: () => ({ t: (key: string) => key, locale: ref("en") }),
  })) {
    vi.stubGlobal(name, value);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mountLinkedServer(status: Server["status"]) {
  mocks.list.mockResolvedValue({
    data: [
      {
        id: serverId,
        name: "Custom server",
        status,
        provider: "custom_server",
        type: "docker",
      },
    ],
  });
  const pinia = createPinia();
  const wrapper = shallowMount(ServersPage, {
    global: {
      plugins: [pinia],
      stubs: {
        Icon: true,
        NuxtLink: true,
        ServerPendingActions: true,
        ServerProvisionCommandDialog: command,
        ServerProvisionLogsSheet: logs,
      },
    },
  });
  return { wrapper, store: useServersStore(pinia) };
}

it("switches the open command to status as the server starts provisioning", async () => {
  const { wrapper, store } = mountLinkedServer("awaiting_connection");
  await flushPromises();
  expect(wrapper.text()).toContain(`Command for ${serverId}`);

  store.patch(serverId, { status: "provisioning" });
  await nextTick();
  expect(wrapper.text()).not.toContain("Command for");
  expect(wrapper.text()).toContain(`Status for ${serverId} provisioning`);

  store.patch(serverId, { status: "running" });
  await nextTick();
  expect(wrapper.text()).toContain(`Status for ${serverId} running`);
  wrapper.unmount();
});

it("opens the requested server's status directly after it starts", async () => {
  const { wrapper } = mountLinkedServer("starting");
  await flushPromises();
  expect(wrapper.text()).toContain(`Status for ${serverId} starting`);
  expect(wrapper.text()).not.toContain("Command for");
  wrapper.unmount();
});

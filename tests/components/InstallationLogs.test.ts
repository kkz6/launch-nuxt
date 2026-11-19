import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Services from "../../components/server/settings/Services.vue";
import ShowSites from "../../components/server/ShowSites.vue";
import DeployBlock from "../../components/site/DeployBlock.vue";
import type { Server, Site } from "../../types";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({ api: vi.fn(), cacheSite: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@vueuse/core", () => ({
  useIntervalFn: () => ({ pause: vi.fn(), resume: vi.fn() }),
}));
vi.mock("~/composables/useStableMetadataLabels", () => ({
  useStableMetadataLabels: () => ({ getLogName: () => "Runtime logs" }),
}));

const slot = { template: "<div><slot /></div>" };
const stubs = {
  Icon: true,
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  Button: {
    props: ["disabled"],
    template: '<button :disabled="disabled"><slot /></button>',
  },
  Badge: slot,
  DropdownMenu: slot,
  DropdownMenuTrigger: slot,
  DropdownMenuContent: { template: "<div data-menu-content><slot /></div>" },
  DropdownMenuSeparator: true,
  DropdownMenuItem: {
    props: ["disabled"],
    emits: ["select"],
    template:
      '<button role="menuitem" :disabled="disabled" @click="$emit(\'select\', $event)"><slot /></button>',
  },
  TooltipProvider: slot,
  Tooltip: slot,
  TooltipTrigger: slot,
  TooltipContent: true,
  Sheet: slot,
  SheetContent: slot,
  SheetHeader: slot,
  SheetTitle: slot,
  SheetDescription: slot,
  SharedDateTooltip: true,
  SharedConfirmationDialog: true,
  SiteAutodeploy: true,
  ServerSettingsInstallServiceDialog: true,
  ServerSettingsPhpExtensionsDialog: true,
  ServerSettingsPhpOpcacheDialog: true,
  ServerSettingsPhpConfigEditorDialog: true,
  ServerSettingsServiceStatusDialog: true,
  ServerLogViewer: {
    props: ["serverId", "entity", "entityId"],
    template:
      '<div data-task-log :data-server="serverId" :data-entity="entity" :data-task="entityId" />',
  },
  SharedLogViewerDialog: {
    props: ["open", "serverId", "entity", "entityId"],
    template:
      '<div v-if="open" data-task-log :data-server="serverId" :data-entity="entity" :data-task="entityId" />',
  },
};
const wrappers: ReturnType<typeof shallowMount>[] = [];
const server = { id: "server-1" } as Server;
const site = (status: string, taskId = "site-install-task"): Site =>
  ({
    id: "site-1",
    server_id: server.id,
    address: "example.test",
    type: "laravel",
    created_at: "2026-11-19T00:00:00Z",
    zero_downtime_deployment: false,
    installed_at: status === "completed" ? "2026-11-19T00:01:00Z" : null,
    installation_failed_at: status === "failed" ? "2026-11-19T00:01:00Z" : null,
    latest_deployment: {
      id: "deployment-1",
      task_id: taskId,
      status,
      created_at: "2026-11-19T00:00:00Z",
      commit_data: {},
    },
  }) as Site;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.api.mockResolvedValue({ data: [] });
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({
    user: ref({ current_team_id: "team-1" }),
  }));
  vi.stubGlobal("useNavbarCache", () => ({ cacheSite: mocks.cacheSite }));
  vi.stubGlobal("useServiceEvents", vi.fn());
  vi.stubGlobal("useServiceStatus", () => ({
    services: ref([{ id: "node-21", status: "running" }]),
    isConnected: ref(true),
    isConnecting: ref(false),
    error: ref(null),
    lastUpdated: ref(null),
    reconnect: vi.fn(),
  }));
  vi.stubGlobal("$api", mocks.api);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe("software installation logs", () => {
  it.each(["pending", "installing", "failed", "installed"])(
    "keeps %s logs inside both responsive dropdowns",
    async (status) => {
      mocks.api.mockImplementation(async (url: string) => ({
        data: url.endsWith("/services")
          ? [
              {
                id: "node-21",
                server_id: server.id,
                type: "node",
                software: "node21",
                name: "Node 21",
                version: "21",
                status,
                install_task_id: "installation-task",
                task_id: "unrelated-later-task",
              },
            ]
          : [],
      }));
      const wrapper = shallowMount(Services, {
        props: { serverId: server.id },
        global: { stubs },
      });
      wrappers.push(wrapper);
      await flushPromises();
      const logs = wrapper
        .findAll("button")
        .filter((button) => button.text() === "Installation logs");
      expect(logs).toHaveLength(2);
      for (const button of logs) {
        expect(button.attributes("role")).toBe("menuitem");
        expect(button.element.closest("[data-menu-content]")).not.toBeNull();
        expect(button.attributes("disabled")).toBeUndefined();
      }
      const triggers = wrapper.findAll('button[aria-label="Actions: Node 21"]');
      expect(triggers).toHaveLength(2);
      triggers.forEach((trigger) =>
        expect(trigger.attributes("disabled")).toBeUndefined(),
      );
      if (status === "pending" || status === "installing") {
        const stop = wrapper
          .findAll('[role="menuitem"]')
          .filter((item) => item.text() === "Stop");
        expect(stop).toHaveLength(2);
        stop.forEach((item) =>
          expect(item.attributes("disabled")).toBeDefined(),
        );
      }
      await logs[0]!.trigger("click");
      expect(wrapper.get("[data-task-log]").attributes()).toMatchObject({
        "data-server": server.id,
        "data-entity": "task",
        "data-task": "installation-task",
      });
    },
  );
});

describe("site installation logs", () => {
  it.each(["pending", "installing", "failed"])(
    "opens %s installation logs without entering the unavailable site",
    async (status) => {
      const wrapper = shallowMount(ShowSites, {
        props: { server, sites: [site(status)] },
        global: { stubs },
      });
      wrappers.push(wrapper);
      const item = wrapper
        .findAll('[role="menuitem"]')
        .find((button) => button.text() === "Installation logs")!;
      expect(item).toBeDefined();
      expect(item.element.closest("a")).toBeNull();
      expect(wrapper.get("a").attributes("aria-disabled")).toBe("true");
      await item.trigger("click");
      expect(mocks.cacheSite).not.toHaveBeenCalled();
      expect(wrapper.get("[data-task-log]").attributes()).toMatchObject({
        "data-server": server.id,
        "data-entity": "task",
        "data-task": "site-install-task",
      });
    },
  );

  it("does not offer a task log without a recorded task", () => {
    const wrapper = shallowMount(ShowSites, {
      props: { server, sites: [site("failed", "")] },
      global: { stubs },
    });
    wrappers.push(wrapper);
    expect(
      wrapper.findAll('[role="menuitem"]').map((item) => item.text()),
    ).toEqual(["Delete"]);
  });

  it.each([
    "pending",
    "installing",
    "running",
    "failed",
    "finished",
    "completed",
    "timeout",
  ])(
    "keeps detail-page task output available for %s deployments",
    async (status) => {
      const wrapper = shallowMount(DeployBlock, {
        props: { server, site: site(status) },
        global: { stubs },
      });
      wrappers.push(wrapper);
      const toggle = wrapper.get('button[aria-expanded="false"]');
      await toggle.trigger("click");
      expect(wrapper.get("[data-task-log]").attributes()).toMatchObject({
        "data-entity": "task",
        "data-task": "site-install-task",
      });
    },
  );
});

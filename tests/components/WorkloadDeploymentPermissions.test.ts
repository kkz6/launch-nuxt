import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationDeployments from "../../components/application/Deployments.vue";
import ComposeDeployments from "../../components/compose/Deployments.vue";
import DatabaseDeployments from "../../components/database/Deployments.vue";
import { useCan } from "../../composables/useCan";
import { dockerService } from "~/services/dockerService";
import { createI18nStub } from "../helpers/i18n";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/services/dockerService", () => {
  const service = () => ({
    listDeployments: vi.fn(),
    deploy: vi.fn(),
    reload: vi.fn(),
    lifecycle: vi.fn(),
    deleteDeployment: vi.fn(),
  });
  return {
    dockerService: {
      applications: service(),
      composes: service(),
      databases: service(),
    },
  };
});

const user = ref({ current_team_id: "team", role: "editor" });
const wrappers: VueWrapper[] = [];
const row = {
  id: "deploy",
  task_id: "task",
  status: "success",
  action: "deploy",
  created_at: "2026-11-01T00:00:00Z",
};
const resource = {
  id: "resource",
  server_id: "server",
  project_id: "project",
  name: "Example",
  status: "running",
};
const cases = [
  {
    name: "application",
    component: ApplicationDeployments,
    service: dockerService.applications,
    action: "Deploy now",
  },
  {
    name: "compose",
    component: ComposeDeployments,
    service: dockerService.composes,
    action: "Reload",
  },
  {
    name: "database",
    component: DatabaseDeployments,
    service: dockerService.databases,
    action: "Restart",
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  user.value = { current_team_id: "team", role: "editor" };
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("onUnmounted", onUnmounted);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useLocalePreference", () => ({ effectiveLocale: ref("en") }));
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useImpersonation", () => ({ isImpersonating: ref(false) }));
  vi.stubGlobal("useCan", useCan);
  vi.stubGlobal("useChannelEvents", vi.fn());
  vi.stubGlobal("useDockerApplicationEvents", vi.fn());
  vi.stubGlobal("useDeploymentEvents", vi.fn());
  for (const { service } of cases) {
    vi.mocked(service.listDeployments).mockResolvedValue({
      data: [row],
    } as never);
  }
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

const mountView = (testCase: (typeof cases)[number]) => {
  const wrapper = shallowMount(testCase.component, {
    props: { [testCase.name]: resource } as never,
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
        Icon: true,
        SharedDateTooltip: true,
        ServerLogViewer: true,
        SharedGhaStepsTimeline: true,
        Sheet: true,
        SheetContent: true,
        SheetHeader: true,
        SheetTitle: true,
        SheetDescription: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};

for (const testCase of cases) {
  describe(`${testCase.name} deployment permissions`, () => {
    it("hides write controls after switching to a Member team, retaining history and logs", async () => {
      const wrapper = mountView(testCase);
      await flushPromises();
      expect(
        wrapper
          .findAll("button")
          .some((button) => button.text() === testCase.action),
      ).toBe(true);
      if (testCase.name !== "database")
        expect(wrapper.find('button[title="Delete deployment"]').exists()).toBe(
          true,
        );
      user.value = { current_team_id: "client", role: "member" };
      await nextTick();
      const labels = wrapper.findAll("button").map((button) => button.text());
      expect(labels).not.toContain(testCase.action);
      expect(labels.map((label) => label.toLowerCase())).toContain("view logs");
      expect(wrapper.find('button[title="Delete deployment"]').exists()).toBe(
        false,
      );
    });

    it("rechecks permission when a rendered action is clicked during a team switch", async () => {
      const wrapper = mountView(testCase);
      await flushPromises();
      const button = wrapper
        .findAll("button")
        .find((button) => button.text() === testCase.action)!;
      user.value = { current_team_id: "client", role: "member" };
      await button.trigger("click");
      const mutation =
        testCase.name === "database"
          ? dockerService.databases.lifecycle
          : testCase.name === "compose"
            ? dockerService.composes.reload
            : dockerService.applications.deploy;
      expect(mutation).not.toHaveBeenCalled();
    });
  });
}

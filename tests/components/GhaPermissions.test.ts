import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationGHA from "../../components/application/GHA.vue";
import ComposeGHA from "../../components/compose/GHA.vue";
import { useCan } from "../../composables/useCan";
import { dockerService } from "~/services/dockerService";
import { createI18nStub } from "../helpers/i18n";

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/services/dockerService", () => {
  const service = () => ({
    listBuildSecrets: vi.fn().mockResolvedValue({ data: [] }),
    rotateGhaToken: vi.fn(),
    resyncGhaWorkflow: vi.fn(),
    setGhaAutoDeploy: vi.fn(),
    disableGha: vi.fn(),
  });
  return { dockerService: { applications: service(), composes: service() } };
});

const user = ref({ current_team_id: "team", role: "editor" });
const confirm = vi.fn();
const wrappers: VueWrapper[] = [];
const confirmationDialog = defineComponent({
  setup(_, { expose }) {
    expose({ show: confirm });
    return () => null;
  },
});
const resource = {
  id: "resource",
  server_id: "server",
  project_id: "project",
  gha_build_ready: true,
  source_config: {
    repo: "git@github.com:team/example.git",
    gha_workflow_sha: "commit",
  },
};
const cases = [
  {
    name: "application",
    component: ApplicationGHA,
    service: dockerService.applications,
  },
  { name: "compose", component: ComposeGHA, service: dockerService.composes },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  user.value = { current_team_id: "team", role: "editor" };
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useImpersonation", () => ({ isImpersonating: ref(false) }));
  vi.stubGlobal("useCan", useCan);
  vi.stubGlobal("useDockerApplicationEvents", vi.fn());
  vi.stubGlobal("useDockerComposeEvents", vi.fn());
  vi.stubGlobal("useChannelEvents", vi.fn());
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
        NuxtLink: { template: "<a><slot /></a>" },
        Icon: true,
        Switch: true,
        SharedBuildSecretsEditor: true,
        TooltipProvider: true,
        Tooltip: true,
        TooltipTrigger: true,
        TooltipContent: true,
        SharedConfirmationDialog: confirmationDialog,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};

for (const testCase of cases) {
  describe(`${testCase.name} GitHub Actions permissions`, () => {
    it("hides maintenance after switching to Member while retaining workflow details", async () => {
      const wrapper = mountView(testCase);
      await flushPromises();
      expect(
        wrapper.findAll("button").some((button) => button.text() === "Rotate"),
      ).toBe(true);
      user.value = { current_team_id: "client", role: "member" };
      await nextTick();
      const buttons = wrapper.findAll("button").map((button) => button.text());
      for (const action of ["Rotate", "Resync", "Disable"])
        expect(buttons).not.toContain(action);
      expect(wrapper.findComponent({ name: "Switch" }).exists()).toBe(false);
      expect(wrapper.text()).toContain("team/example");
      expect(wrapper.text()).toContain("launch-deploy.yml");
    });

    it("keeps token rotation available to Editors", async () => {
      const wrapper = mountView(testCase);
      await flushPromises();
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Rotate")!
        .trigger("click");
      expect(testCase.service.rotateGhaToken).toHaveBeenCalledWith(
        "server",
        "project",
        "resource",
      );
    });

    it("does not disable builds if the role is lost while confirming", async () => {
      let accept!: (value: { ok: boolean }) => void;
      confirm.mockReturnValue(
        new Promise((resolve) => {
          accept = resolve;
        }),
      );
      const wrapper = mountView(testCase);
      await flushPromises();
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Disable")!
        .trigger("click");
      expect(confirm).toHaveBeenCalledOnce();
      user.value = { current_team_id: "client", role: "member" };
      accept({ ok: true });
      await flushPromises();
      expect(testCase.service.disableGha).not.toHaveBeenCalled();
    });
  });
}

import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SitePage from "../../pages/servers/[id]/sites/[siteId].vue";
import DeployApplication from "../../components/site/DeployApplication.vue";
import Deployments from "../../components/site/Deployments.vue";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Deployment } from "~/types";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));
vi.mock("vue-sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const api = vi.fn();
const triggeredDeployment = ref<Deployment | null>(null);
const previousDeployment = {
  id: "previous-deployment",
  site_id: "site-id",
  status: "finished",
  commit_data: { message: "Previous commit", name: "Previous author" },
  created_at: "2026-10-28T00:00:00Z",
};

// Use the same shared state as the navbar's deployed event handler.
const Flow = defineComponent({
  components: { SitePage, DeployApplication },
  setup: () => ({
    onDeployed: (deployment: Deployment) => {
      triggeredDeployment.value = deployment;
    },
  }),
  template: `<DeployApplication server-id="server-id" site-id="site-id" @deployed="onDeployed" /><SitePage />`,
});

let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(useDeploymentEvents).mockClear();
  triggeredDeployment.value = null;
  api.mockReset().mockImplementation((path: string) => {
    if (path.endsWith("/deployments")) return Promise.resolve({ data: [] });
    if (path === "/servers/server-id") {
      return Promise.resolve({ data: { id: "server-id" } });
    }
    return Promise.resolve({
      data: {
        id: "site-id",
        type: "laravel",
        deploy_token: "token",
        latest_deployment: previousDeployment,
      },
    });
  });
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({
    user: ref({ current_team_id: "team-id" }),
  }));
  vi.stubGlobal("useRequestURL", () => new URL("https://launchctl.io"));
  vi.stubGlobal("useRoute", () => ({
    params: { id: "server-id", siteId: "site-id" },
    query: { tab: "deployments" },
  }));
  vi.stubGlobal("useState", (key: string, factory: () => unknown) =>
    key === "lastTriggeredDeployment" ? triggeredDeployment : ref(factory()),
  );
  vi.stubGlobal("$api", api);
  wrapper = mount(Flow, {
    global: {
      components: { SiteDeployments: Deployments },
      stubs: {
        Icon: true,
        SiteTerminalPanel: true,
        SiteDeployBlock: true,
        SiteLoadBalancedBanner: true,
        SiteOverview: true,
        SiteLaravelFeatures: true,
        SiteFiles: true,
        SiteQueues: true,
        SiteRedirects: true,
        SiteCommands: true,
        SiteSettings: true,
        SharedConfirmationDialog: true,
        SharedDateTooltip: true,
        SiteDeploymentLogs: true,
        Button: { template: "<button><slot /></button>" },
        AlertDialog: { template: "<div><slot /></div>" },
        AlertDialogTrigger: { template: "<div><slot /></div>" },
        AlertDialogContent: { template: "<div><slot /></div>" },
        AlertDialogHeader: { template: "<div><slot /></div>" },
        AlertDialogTitle: { template: "<div><slot /></div>" },
        AlertDialogDescription: { template: "<div><slot /></div>" },
        AlertDialogFooter: { template: "<div><slot /></div>" },
        AlertDialogCancel: true,
        AlertDialogAction: {
          template: '<button data-test="confirm-deploy"><slot /></button>',
        },
      },
    },
  });
});

afterEach(() => {
  wrapper?.unmount();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("manual site deployment flow", () => {
  it("shows the new commit when Deploy returns, without refreshing the page", async () => {
    await flushPromises();
    let resolveDeploy!: (value: { data: unknown }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeploy = resolve;
        }),
    );
    await wrapper.get('[data-test="confirm-deploy"]').trigger("click");
    expect(api).toHaveBeenLastCalledWith(
      "/servers/server-id/sites/site-id/deploy",
      { method: "POST" },
    );

    // The start event can arrive before the POST response with commit details.
    for (const [, handler] of vi.mocked(useDeploymentEvents).mock.calls) {
      handler(
        {
          site_id: "site-id",
          deployment_id: "new-deployment",
          status: "pending",
        },
        "deployment.started",
      );
    }
    await flushPromises();
    expect(wrapper.text()).not.toContain("Previous commit");
    resolveDeploy({
      data: {
        id: "new-deployment",
        site_id: "site-id",
        status: "pending",
        task_id: null,
        commit_data: {
          message: "Fix payment method\nDetails",
          name: "Karthick",
          sha: "abcdef123456",
        },
        created_at: "2026-10-29T00:00:00Z",
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Fix payment method");
    expect(wrapper.text()).toContain("Karthick");
    expect(wrapper.text()).toContain("abcdef");
    expect(wrapper.text()).not.toContain("Previous commit");
    expect(wrapper.text().match(/Fix payment method/g)).toHaveLength(1);
    expect(triggeredDeployment.value).toBeNull();
    expect(
      api.mock.calls.filter(([path]) => path.endsWith("/deployments")),
    ).toHaveLength(1);
  });
});

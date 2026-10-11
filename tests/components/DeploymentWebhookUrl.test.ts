import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onMounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Deployments from "../../components/site/Deployments.vue";
import type { Site } from "../../types";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mountDeployments = () =>
  shallowMount(Deployments, {
    props: {
      serverId: "server-id",
      siteId: "site-id",
      site: { deploy_token: "original-token" } as Site,
    },
    global: {
      stubs: {
        Icon: true,
        SharedConfirmationDialog: true,
        SharedDateTooltip: true,
        SiteDeploymentLogs: true,
        Button: { template: "<button><slot /></button>" },
      },
    },
  });

describe("deployment webhook URL", () => {
  const clipboard = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("useI18n", createI18nStub);
    vi.stubGlobal("useAuth", () => ({ user: ref(null) }));
    vi.stubGlobal(
      "useRequestURL",
      () => new URL("https://launchctl.io/servers/server-id/sites/site-id"),
    );
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { apiBase: "https://api.launchctl.io" },
    }));
    vi.stubGlobal("$api", vi.fn().mockResolvedValue({ data: [] }));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboard },
    });
    clipboard.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("displays and copies the frontend proxy URL", async () => {
    const wrapper = mountDeployments();
    await flushPromises();
    expect(wrapper.get("code").text()).toBe(
      "https://launchctl.io/deploy/site-id/original-token",
    );
    expect(wrapper.text()).not.toContain("api.launchctl.io");
    await wrapper.get('button[title="Copy"]').trigger("click");
    expect(clipboard).toHaveBeenCalledWith(
      "https://launchctl.io/deploy/site-id/original-token",
    );
  });

  it("updates the proxy URL when the deployment token changes", async () => {
    const wrapper = mountDeployments();
    await flushPromises();
    await wrapper.setProps({
      site: { deploy_token: "regenerated-token" } as Site,
    });
    expect(wrapper.get("code").text()).toBe(
      "https://launchctl.io/deploy/site-id/regenerated-token",
    );
  });
});

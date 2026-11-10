import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, defineComponent, onMounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Deployments from "../../components/site/Deployments.vue";
import type { Deployment, Site } from "../../types";
import { toast } from "vue-sonner";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const confirm = vi.fn();
const confirmationDialog = defineComponent({
  setup(_, { expose }) {
    expose({ show: confirm });
    return () => null;
  },
});
const canEdit = ref(true);
const canManageTeam = ref(true);

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
        SharedConfirmationDialog: confirmationDialog,
        SharedDateTooltip: true,
        SiteDeploymentLogs: true,
        Button: { template: "<button><slot /></button>" },
      },
    },
  });

describe("deployment webhook URL", () => {
  const clipboard = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    confirm.mockReset();
    canEdit.value = true;
    canManageTeam.value = true;
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("useI18n", createI18nStub);
    vi.stubGlobal("useCan", () => ({ canEdit, canManageTeam }));
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

  it("hides deployment credentials and token rotation for a read-only team", async () => {
    canEdit.value = false;
    canManageTeam.value = false;
    const wrapper = mountDeployments();
    await flushPromises();
    expect(wrapper.find("code").exists()).toBe(false);
    expect(wrapper.find('button[title="Copy"]').exists()).toBe(false);
    expect(wrapper.find('button[title="Regenerate"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Deployments");
  });

  it("allows Editors to copy a deploy webhook but only admins to rotate it", async () => {
    canManageTeam.value = false;
    const wrapper = mountDeployments();
    await flushPromises();
    expect(wrapper.find("code").exists()).toBe(true);
    expect(wrapper.find('button[title="Regenerate"]').exists()).toBe(false);
    canManageTeam.value = true;
    await flushPromises();
    expect(wrapper.find('button[title="Regenerate"]').exists()).toBe(true);
  });

  it("lets Editors roll back using the registered deployment endpoint", async () => {
    canManageTeam.value = false;
    confirm.mockResolvedValue({ ok: true });
    vi.mocked($api).mockResolvedValue({
      data: [
        {
          id: "current",
          status: "finished",
          created_at: "2026-11-01T00:00:00Z",
        },
        {
          id: "previous",
          status: "finished",
          created_at: "2026-10-31T00:00:00Z",
        },
      ],
    });
    const wrapper = mountDeployments();
    await wrapper.setProps({
      site: { deploy_token: "token", zero_downtime_deployment: true } as Site,
    });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Rollback")!
      .trigger("click");
    await flushPromises();
    expect($api).toHaveBeenCalledWith(
      "/servers/server-id/sites/site-id/rollback/previous",
      { method: "POST" },
    );
    wrapper.unmount();
  });

  it.each([
    {
      name: "recorded release names",
      metadata: [
        { release_name: "release-b" },
        { release_name: "release-b" },
        { release_name: "release-a" },
      ],
    },
    {
      name: "mixed recorded and legacy release metadata",
      metadata: [
        {
          release_name: "release-b",
          commit_data: { rollback_to: "duplicate" },
        },
        { commit_data: {} },
        { release_name: "release-a" },
      ],
    },
    {
      name: "missing legacy rollback target",
      metadata: [
        { release_name: "release-b" },
        { commit_data: { rollback_to: "missing-deployment" } },
        { release_name: "release-a" },
      ],
    },
    {
      name: "legacy rollback history",
      metadata: [
        { commit_data: { rollback_to: "duplicate" } },
        { commit_data: {} },
        { commit_data: {} },
      ],
    },
  ])(
    "selects the previous distinct release using $name",
    async ({ metadata }) => {
      const rows = ["current", "duplicate", "previous"].map((id, index) => ({
        id,
        status: "finished",
        created_at: "2026-11-01T00:00:00Z",
        ...metadata[index],
      }));
      vi.mocked($api).mockResolvedValue({ data: rows });
      confirm.mockResolvedValue({ ok: true });
      const wrapper = mountDeployments();
      await wrapper.setProps({
        site: { zero_downtime_deployment: true } as Site,
      });
      await flushPromises();
      const buttons = wrapper
        .findAll("button")
        .filter((button) => button.text() === "Rollback");
      expect(buttons).toHaveLength(1);
      await buttons[0].trigger("click");
      await flushPromises();
      expect($api).toHaveBeenCalledWith(
        "/servers/server-id/sites/site-id/rollback/previous",
        { method: "POST" },
      );
      expect(confirm.mock.calls[0][0].description).toContain(
        "does not restore the database",
      );
      wrapper.unmount();
    },
  );

  it("hides an older rollback record when its release directory was never recorded", async () => {
    vi.mocked($api).mockResolvedValue({
      data: [
        {
          id: "current",
          release_name: "release-c",
          status: "finished",
          created_at: "2026-11-03T00:00:00Z",
        },
        {
          id: "old-rollback",
          status: "finished",
          commit_data: { rollback_to: "original" },
          created_at: "2026-11-02T00:00:00Z",
        },
        {
          id: "original",
          release_name: "release-a",
          status: "finished",
          created_at: "2026-11-01T00:00:00Z",
        },
      ],
    });
    const wrapper = mountDeployments();
    await wrapper.setProps({
      site: { zero_downtime_deployment: true } as Site,
    });
    await flushPromises();
    expect(
      wrapper
        .findAll("button")
        .filter((button) => button.text() === "Rollback"),
    ).toHaveLength(0);
    wrapper.unmount();
  });

  it("does not offer rollback when every successful record points to the same release", async () => {
    vi.mocked($api).mockResolvedValue({
      data: [
        {
          id: "rollback",
          release_name: "release-a",
          status: "finished",
          created_at: "2026-11-01T00:00:00Z",
        },
        {
          id: "original",
          release_name: "release-a",
          status: "finished",
          created_at: "2026-10-31T00:00:00Z",
        },
      ],
    });
    const wrapper = mountDeployments();
    await wrapper.setProps({
      site: { zero_downtime_deployment: true } as Site,
    });
    await flushPromises();
    expect(
      wrapper
        .findAll("button")
        .filter((button) => button.text() === "Rollback"),
    ).toHaveLength(0);
    wrapper.unmount();
  });

  it("does not start a rollback when another deployment begins during confirmation", async () => {
    let accept!: (result: { ok: boolean }) => void;
    confirm.mockReturnValue(
      new Promise((resolve) => {
        accept = resolve;
      }),
    );
    vi.mocked($api).mockResolvedValue({
      data: [
        {
          id: "current",
          status: "finished",
          created_at: "2026-11-01T00:00:00Z",
        },
        {
          id: "previous",
          status: "finished",
          created_at: "2026-10-31T00:00:00Z",
        },
      ],
    });
    const wrapper = mountDeployments();
    await wrapper.setProps({
      site: { zero_downtime_deployment: true } as Site,
    });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Rollback")!
      .trigger("click");
    await wrapper.setProps({
      site: {
        zero_downtime_deployment: true,
        latest_deployment: {
          id: "new-deploy",
          site_id: "site-id",
          status: "pending",
          created_at: "2026-11-02T00:00:00Z",
        } as Deployment,
      } as Site,
    });
    accept({ ok: true });
    await flushPromises();
    expect(
      vi
        .mocked($api)
        .mock.calls.some(([, options]) => options?.method === "POST"),
    ).toBe(false);
    wrapper.unmount();
  });

  it("shows the server's rollback failure without reporting success", async () => {
    confirm.mockResolvedValue({ ok: true });
    vi.mocked(toast.success).mockClear();
    vi.mocked($api)
      .mockResolvedValueOnce({
        data: [
          {
            id: "current",
            status: "finished",
            created_at: "2026-11-01T00:00:00Z",
          },
          {
            id: "previous",
            status: "finished",
            created_at: "2026-10-31T00:00:00Z",
          },
        ],
      })
      .mockRejectedValueOnce({
        data: { message: "Unable to queue rollback. Try again." },
      });
    const wrapper = mountDeployments();
    await wrapper.setProps({
      site: { zero_downtime_deployment: true } as Site,
    });
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Rollback")!
      .trigger("click");
    await flushPromises();
    expect(toast.error).toHaveBeenCalledWith(
      "Unable to queue rollback. Try again.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(["rollback", "regenerate"])(
    "rechecks permissions after confirming %s",
    async (action) => {
      let accept!: (result: { ok: boolean }) => void;
      confirm.mockReturnValue(
        new Promise((resolve) => {
          accept = resolve;
        }),
      );
      vi.mocked($api).mockResolvedValue({
        data: [
          {
            id: "current",
            status: "finished",
            created_at: "2026-11-01T00:00:00Z",
          },
          {
            id: "previous",
            status: "finished",
            created_at: "2026-10-31T00:00:00Z",
          },
        ],
      });
      const wrapper = mountDeployments();
      await wrapper.setProps({
        site: { deploy_token: "token", zero_downtime_deployment: true } as Site,
      });
      await flushPromises();
      const button =
        action === "rollback"
          ? wrapper
              .findAll("button")
              .find((button) => button.text() === "Rollback")!
          : wrapper.get('button[title="Regenerate"]');
      await button.trigger("click");
      expect(confirm).toHaveBeenCalledOnce();
      canEdit.value = false;
      canManageTeam.value = false;
      accept({ ok: true });
      await flushPromises();
      expect(
        vi
          .mocked($api)
          .mock.calls.some(([, options]) => options?.method === "POST"),
      ).toBe(false);
      wrapper.unmount();
    },
  );

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
      site: { deploy_token: "aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cD0fG" } as Site,
    });
    expect(wrapper.get("code").text()).toBe(
      "https://launchctl.io/deploy/site-id/aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cD0fG",
    );
  });

  it("displays and copies every token character, including a leading hyphen", async () => {
    const wrapper = mountDeployments();
    await flushPromises();
    await wrapper.setProps({
      site: { deploy_token: "-test_TOKEN-with-hyphens_012345678" } as Site,
    });
    const url =
      "https://launchctl.io/deploy/site-id/-test_TOKEN-with-hyphens_012345678";

    expect(wrapper.get("code").text()).toBe(url);
    await wrapper.get('button[title="Copy"]').trigger("click");
    expect(clipboard).toHaveBeenCalledWith(url);
  });
});

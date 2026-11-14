import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, defineComponent, onMounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";
import Deployments from "../../components/site/Deployments.vue";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Deployment, Site, SiteReleaseInventory } from "~/types";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const confirm = vi.fn();
const confirmationDialog = defineComponent({
  setup(_, { expose }) {
    expose({ show: confirm });
    return () => null;
  },
});
const canEdit = ref(true);
const user = ref({ current_team_id: "team-id" });
const site = {
  zero_downtime_deployment: true,
  type: "laravel",
  php_version: "8.3",
} as Site;
const record = (id: string, status = "finished", extra = {}) =>
  ({
    id,
    site_id: "site-id",
    status,
    task_id: `task-${id}`,
    created_at: "2026-11-01T00:00:00Z",
    commit_data: { message: id },
    ...extra,
  }) as Deployment;
const inventory = (active = "current"): SiteReleaseInventory => ({
  status: "available",
  checked_at: "2026-11-14T00:00:00Z",
  active_release: `release-${active}`,
  releases: ["current", "previous"].map((id) => ({
    release_name: `release-${id}`,
    deployment_id: id,
    deployment_ids: [id],
    active: id === active,
    rollback_available: id !== active,
  })),
});
const unavailable = (
  status: SiteReleaseInventory["status"],
): SiteReleaseInventory => ({
  status,
  checked_at: "2026-11-14T00:00:00Z",
  active_release: null,
  releases: [],
});
const api = vi.fn();
const getInventory = vi.fn();
const mutate = vi.fn();
let rows: Deployment[];
const mountDeployments = () =>
  shallowMount(Deployments, {
    props: { serverId: "server-id", siteId: "site-id", site },
    global: {
      stubs: {
        Icon: true,
        SharedConfirmationDialog: confirmationDialog,
        SharedDateTooltip: true,
        SiteDeploymentLogs: true,
        Badge: { template: "<span data-badge><slot /></span>" },
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
let wrapper: ReturnType<typeof mountDeployments>;
const rollbackButtons = () =>
  wrapper.findAll("button").filter((button) => button.text() === "Rollback");
const liveBadges = () =>
  wrapper.findAll("[data-badge]").filter((badge) => badge.text() === "Live");
const runtimeButton = () =>
  wrapper
    .findAll("button")
    .find((button) => button.text().includes("PHP runtime"));
const sendEvent = (event: string, data: Record<string, unknown> = {}) => {
  vi.mocked(useDeploymentEvents).mock.calls[0][1](
    { site_id: "site-id", ...data },
    event,
  );
};
const reconnect = () =>
  vi.mocked(useDeploymentEvents).mock.calls[0][2]?.onReconnect?.();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  confirm.mockReset().mockResolvedValue({ ok: true });
  canEdit.value = true;
  user.value = { current_team_id: "team-id" };
  rows = [record("current"), record("previous")];
  getInventory
    .mockReset()
    .mockImplementation(async () => ({ data: inventory() }));
  mutate.mockReset().mockResolvedValue({ data: { status: "queued" } });
  api
    .mockReset()
    .mockImplementation((url: string, options?: { method?: string }) => {
      if (options?.method === "POST") return mutate(url);
      if (url.endsWith("/releases")) return getInventory(url);
      return Promise.resolve({ data: structuredClone(rows) });
    });
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useCan", () => ({ canEdit, canManageTeam: ref(false) }));
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useRequestURL", () => new URL("https://launchctl.io"));
  vi.stubGlobal("$api", api);
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("authoritative site release inventory", () => {
  it("marks a failed deployment live and offers the retained finished release to Editors", async () => {
    rows[0] = record("current", "failed");
    wrapper = mountDeployments();
    await flushPromises();
    expect(liveBadges()).toHaveLength(1);
    expect(
      liveBadges()[0].element.closest("div.flex-col")?.textContent,
    ).toContain("Failed");
    expect(rollbackButtons()).toHaveLength(1);
    await rollbackButtons()[0].trigger("click");
    await flushPromises();
    expect(api).toHaveBeenCalledWith(
      "/servers/server-id/sites/site-id/rollback/previous",
      { method: "POST" },
    );
    expect(confirm.mock.calls[0][0].description).toContain(
      "does not restore the database",
    );
  });

  it("uses canonical retained targets and does not infer availability from release metadata", async () => {
    rows = [
      record("current"),
      record("rollback"),
      record("previous"),
      record("pruned", "finished", { release_name: "retained-looking" }),
    ];
    const state = inventory();
    state.releases[1].deployment_ids = ["rollback", "previous"];
    state.releases[1].deployment_id = "rollback";
    getInventory.mockResolvedValue({ data: state });
    wrapper = mountDeployments();
    await flushPromises();
    expect(rollbackButtons()).toHaveLength(1);
    expect(wrapper.text()).toContain("Release unavailable");
    await rollbackButtons()[0].trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledWith(
      "/servers/server-id/sites/site-id/rollback/rollback",
    );
  });

  it("does not offer another history row for the live release", async () => {
    rows = [record("rollback"), record("original")];
    getInventory.mockResolvedValue({
      data: {
        ...inventory(),
        releases: [
          {
            release_name: "release-a",
            deployment_ids: ["rollback", "original"],
            deployment_id: "rollback",
            active: true,
            rollback_available: false,
          },
        ],
      },
    });
    wrapper = mountDeployments();
    await flushPromises();
    expect(liveBadges()).toHaveLength(1);
    expect(rollbackButtons()).toHaveLength(0);
  });

  it.each(["unavailable", "busy", "unsupported"] as const)(
    "does not guess the live release when inventory is %s",
    async (status) => {
      getInventory.mockResolvedValue({ data: unavailable(status) });
      wrapper = mountDeployments();
      await flushPromises();
      expect(liveBadges()).toHaveLength(0);
      expect(rollbackButtons()).toHaveLength(0);
      expect(wrapper.find('[role="status"]').exists()).toBe(true);
      expect(runtimeButton()?.attributes("disabled") !== undefined).toBe(
        status === "busy",
      );
    },
  );

  it("automatically retries an offline inventory without a manual refresh control", async () => {
    getInventory.mockRejectedValueOnce(new Error("offline"));
    wrapper = mountDeployments();
    await flushPromises();
    expect(wrapper.text()).toContain("retrying automatically");
    expect(rollbackButtons()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(30000);
    expect(rollbackButtons()).toHaveLength(1);
    expect(liveBadges()).toHaveLength(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rechecks retained targets after confirmation before posting", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    getInventory.mockResolvedValue({
      data: { ...inventory(), releases: [inventory().releases[0]] },
    });
    await rollbackButtons()[0].trigger("click");
    await flushPromises();
    expect(mutate).not.toHaveBeenCalled();
    expect(rollbackButtons()).toHaveLength(0);
  });

  it.each(["permission", "deployment", "site", "team"])(
    "prevents rollback when %s changes while confirmation is open",
    async (change) => {
      let accept!: (result: { ok: boolean }) => void;
      confirm.mockReturnValue(
        new Promise((resolve) => {
          accept = resolve;
        }),
      );
      wrapper = mountDeployments();
      await flushPromises();
      await rollbackButtons()[0].trigger("click");
      if (change === "permission") canEdit.value = false;
      if (change === "deployment")
        await wrapper.setProps({
          site: { ...site, latest_deployment: record("new", "pending") },
        });
      if (change === "site") await wrapper.setProps({ siteId: "other-site" });
      if (change === "team") user.value = { current_team_id: "other-team" };
      accept({ ok: true });
      await flushPromises();
      expect(mutate).not.toHaveBeenCalled();
    },
  );

  it("shows a rejected rollback without claiming it started", async () => {
    mutate.mockRejectedValue({
      data: { message: "Unable to queue rollback. Try again." },
    });
    wrapper = mountDeployments();
    await flushPromises();
    await rollbackButtons()[0].trigger("click");
    await flushPromises();
    expect(toast.error).toHaveBeenCalledWith(
      "Unable to queue rollback. Try again.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("updates the live target after repeated rollbacks over sockets", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    rows.unshift(
      record("rollback", "finished", {
        commit_data: { rollback_to: "previous" },
      }),
    );
    const state = inventory("previous");
    state.releases[1].deployment_ids.unshift("rollback");
    state.releases[1].deployment_id = "rollback";
    getInventory.mockResolvedValue({ data: state });
    sendEvent("deployment.rollback.completed", {
      deployment_id: "rollback",
      status: "finished",
    });
    await flushPromises();
    expect(liveBadges()).toHaveLength(0);
    expect(rollbackButtons()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(liveBadges()).toHaveLength(1);
    expect(
      liveBadges()[0].element.closest("div.flex-col")?.textContent,
    ).toContain("Rolled back");
    await rollbackButtons()[0].trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledWith(
      "/servers/server-id/sites/site-id/rollback/current",
    );
  });

  it("discards inventory responses started before a socket lifecycle update", async () => {
    let resolveOld!: (value: { data: SiteReleaseInventory }) => void;
    getInventory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    wrapper = mountDeployments();
    await flushPromises();
    getInventory.mockResolvedValue({ data: inventory("previous") });
    sendEvent("deployment.finished", {
      deployment_id: "previous",
      status: "finished",
    });
    await vi.advanceTimersByTimeAsync(300);
    resolveOld({ data: inventory() });
    await flushPromises();
    await rollbackButtons()[0].trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledWith(
      "/servers/server-id/sites/site-id/rollback/current",
    );
  });

  it("clears live labels on reconnect and respects read-only permissions after reconciliation", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    canEdit.value = false;
    reconnect();
    await flushPromises();
    expect(liveBadges()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(liveBadges()).toHaveLength(1);
    expect(rollbackButtons()).toHaveLength(0);
    expect(runtimeButton()).toBeUndefined();
  });

  it("clears old-site history and ignores its pending inventory response on navigation", async () => {
    let resolveOld!: (value: { data: SiteReleaseInventory }) => void;
    getInventory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    wrapper = mountDeployments();
    await flushPromises();
    await wrapper.setProps({ siteId: "other-site" });
    rows = [];
    getInventory.mockResolvedValue({ data: unavailable("unavailable") });
    await vi.advanceTimersByTimeAsync(300);
    resolveOld({ data: inventory() });
    await flushPromises();
    expect(liveBadges()).toHaveLength(0);
    expect(rollbackButtons()).toHaveLength(0);
    expect(wrapper.findAll("site-deployment-logs-stub")).toHaveLength(0);
  });

  it("stops automatic retries after unmount", async () => {
    getInventory.mockResolvedValue({ data: unavailable("busy") });
    wrapper = mountDeployments();
    await flushPromises();
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(30000);
    expect(getInventory).toHaveBeenCalledOnce();
  });
});

describe("PHP runtime recovery", () => {
  it("waits for terminal events rather than treating queue acceptance as success", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    await runtimeButton()!.trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledWith(
      "/servers/server-id/sites/site-id/runtime/refresh",
    );
    expect(runtimeButton()!.attributes("disabled")).toBeDefined();
    expect(toast.success).not.toHaveBeenCalled();
    sendEvent("deployment.runtime.completed", { task_id: "runtime-task" });
    await vi.advanceTimersByTimeAsync(300);
    expect(toast.success).toHaveBeenCalledWith("PHP runtime refreshed");
    expect(runtimeButton()!.attributes("disabled")).toBeUndefined();
    expect(liveBadges()).toHaveLength(1);
  });

  it("reports runtime failure and permits a retry without requiring release inventory", async () => {
    getInventory.mockResolvedValue({ data: unavailable("unavailable") });
    wrapper = mountDeployments();
    await flushPromises();
    await runtimeButton()!.trigger("click");
    sendEvent("deployment.runtime.failed", { task_id: "runtime-task" });
    await flushPromises();
    expect(toast.error).toHaveBeenCalledWith(
      "PHP runtime refresh failed. Check the server task logs before retrying.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(runtimeButton()!.attributes("disabled")).toBeUndefined();
  });

  it("disables runtime refresh during deployments or runtime work started in another tab", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    sendEvent("deployment.runtime.started", { task_id: "runtime-task" });
    await flushPromises();
    expect(runtimeButton()!.attributes("disabled")).toBeDefined();
    sendEvent("deployment.runtime.completed", { task_id: "runtime-task" });
    await wrapper.setProps({
      site: { ...site, latest_deployment: record("new", "pending") },
    });
    expect(runtimeButton()!.attributes("disabled")).toBeDefined();
  });

  it("disables runtime refresh immediately when a rollback starts without a status field", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    sendEvent("deployment.rollback.started", {
      deployment_id: "new-rollback",
      target_deployment_id: "previous",
    });
    await flushPromises();
    expect(runtimeButton()!.attributes("disabled")).toBeDefined();
    expect(rollbackButtons()).toHaveLength(0);
  });

  it("handles queue failure and hides recovery for non-PHP or read-only sites", async () => {
    mutate.mockRejectedValue({
      data: { message: "Unable to queue runtime refresh." },
    });
    wrapper = mountDeployments();
    await flushPromises();
    await runtimeButton()!.trigger("click");
    await flushPromises();
    expect(toast.error).toHaveBeenCalledWith(
      "Unable to queue runtime refresh.",
    );
    expect(runtimeButton()!.attributes("disabled")).toBeUndefined();
    await wrapper.setProps({ site: { ...site, php_version: undefined } });
    expect(runtimeButton()).toBeUndefined();
    await wrapper.setProps({ site });
    canEdit.value = false;
    await flushPromises();
    expect(runtimeButton()).toBeUndefined();
  });
});

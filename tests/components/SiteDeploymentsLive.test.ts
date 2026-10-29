import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Deployments from "../../components/site/Deployments.vue";
import { useDeploymentEvents } from "~/composables/useChannelEvents";
import type { Deployment, Site } from "~/types";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const deployment = (id = "deploy-new") =>
  ({
    id,
    site_id: "site-id",
    status: "pending",
    task_id: "task-new",
    commit_data: { message: "New commit\nMore details", sha: "abcdef123456" },
    created_at: "2026-10-19T00:00:00Z",
  }) as Deployment;

const site = (latest?: Deployment) =>
  ({ deploy_token: "token", latest_deployment: latest }) as Site;
const mountDeployments = () =>
  shallowMount(Deployments, {
    props: { serverId: "server-id", siteId: "site-id", site: site() },
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

let wrapper: ReturnType<typeof mountDeployments>;
const api = vi.fn();
const sendEvent = (event: string, siteId = "site-id") => {
  const handler = vi.mocked(useDeploymentEvents).mock.calls[0][1];
  handler(
    { site_id: siteId, deployment_id: "deploy-new", status: "running" },
    event,
  );
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(useDeploymentEvents).mockClear();
  api.mockReset().mockResolvedValue({ data: [] });
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({ user: ref(null) }));
  vi.stubGlobal("useRequestURL", () => new URL("https://launchctl.io"));
  vi.stubGlobal("$api", api);
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("site deployment live metadata", () => {
  it("shows commit details and logs immediately from the parent's Deploy response", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    await wrapper.setProps({ site: site(deployment()) });
    expect(wrapper.text()).toContain("New commit");
    expect(wrapper.text()).toContain("abcdef");
    expect(
      wrapper
        .findComponent({ name: "SiteDeploymentLogs" })
        .attributes("task-id"),
    ).toBe("task-new");
    expect(api).toHaveBeenCalledTimes(1);

    // A later status update replaces the same row rather than duplicating it.
    await wrapper.setProps({
      site: site({ ...deployment(), status: "running" }),
    });
    expect(wrapper.findAll("site-deployment-logs-stub")).toHaveLength(1);
  });

  it("fetches commit metadata on started events before completion", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    api.mockResolvedValue({ data: [deployment()] });
    sendEvent("deployment.started");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(api).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("New commit");
  });

  it("keeps fetched commit details when the overview updates a placeholder status", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    const placeholder = reactive({
      ...deployment(),
      task_id: "",
      commit_data: {},
    }) as Deployment;
    await wrapper.setProps({ site: site(placeholder) });
    api.mockResolvedValue({ data: [deployment()] });
    sendEvent("deployment.started");
    await vi.advanceTimersByTimeAsync(300);
    expect(wrapper.text()).toContain("New commit");
    placeholder.status = "running";
    sendEvent("deployment.progress");
    await nextTick();
    expect(wrapper.text()).toContain("New commit");
    expect(
      wrapper.find("site-deployment-logs-stub").attributes("task-id"),
    ).toBe("task-new");
  });

  it("keeps commit details when a sparse parent deployment replaces the record", async () => {
    api.mockResolvedValue({ data: [deployment()] });
    wrapper = mountDeployments();
    await flushPromises();

    await wrapper.setProps({
      site: site({
        ...deployment(),
        status: "running",
        task_id: "",
        commit_data: {} as Deployment["commit_data"],
      }),
    });

    expect(wrapper.text()).toContain("New commit");
    expect(wrapper.text()).toContain("abcdef");
    expect(
      wrapper.find("site-deployment-logs-stub").attributes("task-id"),
    ).toBe("task-new");
  });

  it("does not let an older refresh erase commit details from a newer refresh", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    let resolveOlder!: (value: { data: Deployment[] }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
    );
    sendEvent("deployment.started");
    await vi.advanceTimersByTimeAsync(300);

    api.mockResolvedValue({ data: [{ ...deployment(), status: "finished" }] });
    sendEvent("deployment.finished");
    await vi.advanceTimersByTimeAsync(300);
    expect(wrapper.text()).toContain("New commit");

    resolveOlder({ data: [] });
    await flushPromises();
    expect(wrapper.text()).toContain("New commit");
    expect(wrapper.findAll("site-deployment-logs-stub")).toHaveLength(1);
  });

  it("ignores events for other sites", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    sendEvent("deployment.started", "other-site");
    await vi.advanceTimersByTimeAsync(300);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("keeps a new deployment when an older list request finishes afterward", async () => {
    let resolveList!: (value: { data: Deployment[] }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    wrapper = mountDeployments();
    await wrapper.setProps({ site: site(deployment()) });
    resolveList({ data: [] });
    await flushPromises();
    expect(wrapper.text()).toContain("New commit");
    api.mockResolvedValue({ data: [deployment()] });
    await vi.advanceTimersByTimeAsync(300);
    expect(wrapper.text()).toContain("New commit");
  });

  it("cancels pending lifecycle refreshes when the tab unmounts", async () => {
    wrapper = mountDeployments();
    await flushPromises();
    sendEvent("deployment.started");
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(300);
    expect(api).toHaveBeenCalledTimes(1);
  });
});

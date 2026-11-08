import { flushPromises, shallowMount } from "@vue/test-utils";
import {
  computed,
  defineComponent,
  onMounted,
  onScopeDispose,
  ref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServerGeneral from "../../components/server/settings/General.vue";
import Applications from "../../components/project/Applications.vue";
import ProjectPage from "../../pages/servers/[id]/projects/[projectId]/index.vue";
import { useLiveRefresh } from "../../composables/useLiveRefresh";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  apps: vi.fn(),
  deleteApp: vi.fn(),
  project: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("~/services/dockerService", () => ({
  dockerService: {
    applications: { list: mocks.apps, delete: mocks.deleteApp },
    projects: { get: mocks.project },
  },
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
const api = vi.fn();
const siteEvents = vi.fn();
const applicationEvents = vi.fn();
const channelEvents = vi.fn();
const wrappers: ReturnType<typeof shallowMount>[] = [];
const button = { template: "<button><slot /></button>" };
const stubs = {
  Button: button,
  Icon: true,
  SharedDateTooltip: true,
  ProjectCreateApplicationSheet: true,
  ProjectOverview: true,
  ProjectApplications: true,
  ProjectComposes: true,
  ProjectDatabases: true,
  ProjectEnvironment: true,
  NuxtLink: { template: "<a><slot /></a>" },
  SharedConfirmationDialog: defineComponent({
    setup(_, { expose }) {
      expose({ show: mocks.confirm });
      return () => null;
    },
  }),
  ProjectSettings: {
    props: ["project"],
    template:
      '<div data-test="project-count">{{ project.applications_count }}</div>',
  },
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue({ ok: true });
  api.mockResolvedValue({ data: { count: 1 } });
  mocks.apps.mockResolvedValue({
    data: [
      {
        id: "app-1",
        name: "API",
        status: "running",
        source_type: "image",
        source_config: { image: "example:latest" },
        created_at: "2026-11-08",
      },
    ],
  });
  mocks.deleteApp.mockResolvedValue({});
  mocks.project.mockResolvedValue({
    data: { id: "project-1", name: "Project", applications_count: 1 },
  });
  for (const [key, value] of Object.entries({
    ref,
    computed,
    watch,
    onMounted,
    onScopeDispose,
    useLiveRefresh,
  }))
    vi.stubGlobal(key, value);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({
    user: ref({ current_team_id: "team-1" }),
  }));
  vi.stubGlobal("useCan", () => ({ canEdit: true, canDelete: true }));
  vi.stubGlobal("useState", (_key: string, initial: () => unknown) =>
    ref(initial()),
  );
  vi.stubGlobal("useSiteEvents", siteEvents);
  vi.stubGlobal("useDockerApplicationEvents", applicationEvents);
  vi.stubGlobal("useChannelEvents", channelEvents);
  vi.stubGlobal("$api", api);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("navigateTo", vi.fn());
  vi.stubGlobal("useRouter", () => ({ replace: vi.fn() }));
  vi.stubGlobal("useRoute", () => ({
    params: { id: "server-1", projectId: "project-1" },
    query: { tab: "settings" },
  }));
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const settle = async () => {
  await vi.advanceTimersByTimeAsync(200);
  await flushPromises();
};

describe("customer resource completion updates", () => {
  it("unblocks server deletion after scoped site completion and reconciles after reconnect", async () => {
    const page = shallowMount(ServerGeneral, {
      props: {
        server: {
          id: "server-1",
          name: "Server",
          type: "php",
          sites_count: 1,
        } as never,
      },
      global: { stubs },
    });
    wrappers.push(page);
    await flushPromises();
    const deletion = () =>
      page.findAll("button").find((b) => b.text() === "Delete Server")!;
    expect(deletion().attributes("disabled")).toBeDefined();
    const [, event, options] = siteEvents.mock.calls[0];
    api.mockResolvedValue({ data: { count: 0 } });
    event({ server_id: "other-server" }, "site.deleted");
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    event({ server_id: "server-1" }, "site.deleted");
    await settle();
    expect(deletion().attributes("disabled")).toBeUndefined();
    api.mockResolvedValue({ data: { count: 2 } });
    options.onReconnect();
    await settle();
    expect(deletion().attributes("disabled")).toBeDefined();
  });

  it("retains an application while deletion is queued and removes it only after reconciliation", async () => {
    const page = shallowMount(Applications, {
      props: { serverId: "server-1", projectId: "project-1" },
      global: { stubs },
    });
    wrappers.push(page);
    await flushPromises();
    const deletion = page
      .findAll("button")
      .find((b) => b.attributes("size") === "icon")!;
    await deletion.trigger("click");
    await flushPromises();
    expect(page.text()).toContain("API");
    expect(page.text()).toContain("Deleting");
    expect(mocks.success).toHaveBeenCalledWith(
      "Application deletion queued (volumes preserved)",
    );
    expect(deletion.attributes("disabled")).toBeDefined();
    const [, event] = applicationEvents.mock.calls[0];
    event(
      { server_id: "server-2", project_id: "project-1" },
      "docker.application.deleted",
    );
    await settle();
    expect(mocks.apps).toHaveBeenCalledTimes(1);
    mocks.apps.mockResolvedValue({ data: [] });
    event(
      { server_id: "server-1", project_id: "project-1" },
      "docker.application.deleted",
    );
    await settle();
    expect(page.text()).not.toContain("API");
  });

  it("refreshes project deletion counts after child mutations and a missed reconnect event", async () => {
    api.mockResolvedValue({ data: { id: "server-1" } });
    const page = shallowMount(ProjectPage, { global: { stubs } });
    wrappers.push(page);
    await flushPromises();
    expect(page.get('[data-test="project-count"]').text()).toBe("1");
    const [, , event, options] = channelEvents.mock.calls[0];
    mocks.project.mockResolvedValue({
      data: { id: "project-1", name: "Project", applications_count: 0 },
    });
    event(
      { server_id: "server-1", project_id: "other-project" },
      "docker.application.deleted",
    );
    await settle();
    expect(mocks.project).toHaveBeenCalledTimes(1);
    event(
      { server_id: "server-1", project_id: "project-1" },
      "docker.application.deleted",
    );
    await settle();
    expect(page.get('[data-test="project-count"]').text()).toBe("0");
    mocks.project.mockResolvedValue({
      data: { id: "project-1", name: "Project", applications_count: 2 },
    });
    options.onReconnect();
    await settle();
    expect(page.get('[data-test="project-count"]').text()).toBe("2");
  });
});

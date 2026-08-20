import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActiveActions from "../../components/layout/ActiveActions.vue";
import type {
  ActiveAction,
  ActiveActionEventData,
} from "../../utils/activeActions";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  push: vi.fn(),
  handlers: {} as Record<
    string,
    (data: ActiveActionEventData, event: string) => Promise<void>
  >,
}));

vi.mock("~/composables/useChannelEvents", () => ({
  useCommandEvents: (
    _teamId: unknown,
    handler: (data: ActiveActionEventData, event: string) => Promise<void>,
  ) => {
    mocks.handlers.command = handler;
  },
  useDeploymentEvents: (
    _teamId: unknown,
    handler: (data: ActiveActionEventData, event: string) => Promise<void>,
  ) => {
    mocks.handlers.deployment = handler;
  },
  useBackupEvents: (
    _teamId: unknown,
    handler: (data: ActiveActionEventData, event: string) => Promise<void>,
  ) => {
    mocks.handlers.backup = handler;
  },
  useDockerBackupEvents: (
    _teamId: unknown,
    handler: (data: ActiveActionEventData, event: string) => Promise<void>,
  ) => {
    mocks.handlers.database = handler;
  },
  useTaskEvents: (
    _teamId: unknown,
    handler: (data: ActiveActionEventData, event: string) => Promise<void>,
  ) => {
    mocks.handlers.task = handler;
  },
}));

const user = ref<{ current_team_id?: string } | null>({
  current_team_id: "team-1",
});

const action = (overrides: Partial<ActiveAction> = {}): ActiveAction => ({
  id: "job-1",
  kind: "server_backup",
  status: "pending",
  label: "Nightly",
  server_id: "server-1",
  target_type: "server",
  target_id: "server-1",
  task_id: "task-1",
  created_at: "2026-08-10T00:00:00Z",
  ...overrides,
});

const translate = (key: string, params: Record<string, unknown> = {}) => {
  const messages: Record<string, string> = {
    "common.activeActions.status.pending": "Queued",
    "common.activeActions.status.running": "Running",
    "common.activeActions.status.finished": "Completed",
    "common.activeActions.status.failed": "Failed",
    "common.activeActions.kind.server_backup": "Server backup",
    "common.activeActions.kind.database_backup": "Database backup",
    "common.activeActions.target.server": "Server",
    "common.activeActions.target.database": "Database",
    "common.activeActions.runningFor": `Running for ${String(params.duration ?? "")}`,
    "common.activeActions.complete": `${String(params.kind ?? "")} complete`,
    "common.activeActions.seconds": `${String(params.count ?? 0)}s`,
    "common.activeActions.minutes": `${String(params.count ?? 0)}m`,
    "common.activeActions.liveOutput": "Live output",
    "common.activeActions.finalOutput": "Final output",
  };
  return messages[key] ?? key;
};

const mountComponent = () =>
  shallowMount(ActiveActions, {
    global: {
      stubs: {
        DropdownMenu: { template: "<div><slot /></div>" },
        DropdownMenuTrigger: { template: "<div><slot /></div>" },
        DropdownMenuContent: { template: "<div><slot /></div>" },
        DropdownMenuLabel: { template: "<div><slot /></div>" },
        DropdownMenuItem: { template: "<div><slot /></div>" },
        Sheet: { template: "<div><slot /></div>" },
        SheetContent: { template: "<div><slot /></div>" },
        SheetDescription: { template: "<div><slot /></div>" },
        SheetHeader: { template: "<div><slot /></div>" },
        SheetTitle: { template: "<div><slot /></div>" },
        ServerLogViewer: true,
      },
    },
  });

const setupState = (wrapper: ReturnType<typeof mountComponent>) =>
  (
    wrapper.vm.$ as unknown as {
      setupState: Record<string, any>;
    }
  ).setupState;

describe("ActiveActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    user.value = { current_team_id: "team-1" };
    mocks.get.mockReset();
    mocks.push.mockReset();
    mocks.handlers = {};
    vi.stubGlobal("useAuth", () => ({ user }));
    vi.stubGlobal("useI18n", () => ({ t: translate }));
    vi.stubGlobal("useApi", () => ({ get: mocks.get }));
    vi.stubGlobal("useRouter", () => ({ push: mocks.push }));
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("onUnmounted", onUnmounted);
    mocks.get.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads actions and reacts to lifecycle updates", async () => {
    const running = action();
    const finished = action({ status: "finished" });
    mocks.get
      .mockResolvedValueOnce({ data: [running] })
      .mockResolvedValueOnce({ data: [finished] });

    const wrapper = mountComponent();
    await flushPromises();
    expect(wrapper.text()).toContain("Nightly");
    expect(mocks.handlers.command).toBeTypeOf("function");
    expect(mocks.handlers.task).toBeTypeOf("function");

    await mocks.handlers.backup({ job_id: "job-1" }, "backup.run.succeeded");
    await flushPromises();
    expect(wrapper.text()).toContain("Completed");
    wrapper.unmount();
  });

  it("opens logs, routes taskless actions, and dismisses terminal rows", async () => {
    mocks.get.mockResolvedValue({
      data: [
        action({ status: "failed", description: "No credentials" }),
        action({
          id: "run-1",
          kind: "database_backup",
          status: "failed",
          target_type: "database",
          target_id: "database-1",
          project_id: "project-1",
          task_id: undefined,
        }),
      ],
    });
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper) as {
      openAction: (value: ActiveAction) => void;
      dismiss: (value: ActiveAction) => void;
    };

    setup.openAction(action({ status: "failed" }));
    await nextTick();
    expect(wrapper.findComponent({ name: "ServerLogViewer" }).exists()).toBe(
      true,
    );
    setup.openAction(
      action({
        id: "run-1",
        kind: "database_backup",
        status: "failed",
        target_type: "database",
        target_id: "database-1",
        project_id: "project-1",
        task_id: undefined,
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      "/servers/server-1/projects/project-1/databases/database-1?subtab=backups",
    );

    setup.dismiss(action({ status: "failed" }));
    expect(localStorage.getItem("launch:dismissed-actions")).toContain("job-1");
    wrapper.unmount();
  });

  it("drops stale responses and clears state when the team changes", async () => {
    let resolveFirst!: (value: { data: ActiveAction[] }) => void;
    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    mocks.get.mockResolvedValueOnce({ data: [] });

    const wrapper = mountComponent();
    user.value = { current_team_id: "team-2" };
    await nextTick();
    resolveFirst({ data: [action()] });
    await flushPromises();

    expect(wrapper.text()).not.toContain("Nightly");
    wrapper.unmount();
  });

  it("recovers invalid dismissal state and prunes stale ids", async () => {
    localStorage.setItem("launch:dismissed-actions", "{");
    const invalid = mountComponent();
    await flushPromises();
    expect(setupState(invalid).dismissed).toEqual([]);
    invalid.unmount();

    localStorage.setItem("launch:dismissed-actions", '["gone"]');
    const stale = mountComponent();
    await flushPromises();
    expect(localStorage.getItem("launch:dismissed-actions")).toBe("[]");
    stale.unmount();
  });

  it("refreshes a running selection and tolerates polling errors", async () => {
    mocks.get
      .mockResolvedValueOnce({ data: [action()] })
      .mockResolvedValueOnce({ data: [action({ status: "finished" })] })
      .mockRejectedValueOnce(new Error("offline"));
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);
    setup.openAction(action());

    await setup.fetchActions();
    expect(setup.selected.status).toBe("finished");
    await expect(setup.fetchActions()).resolves.toBeUndefined();
    wrapper.unmount();
  });

  it("renders every output state", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    expect(setup.actionStateDescription(action({ status: "waiting" }))).toBe(
      "Waiting",
    );
    setup.openAction(action({ status: "running" }));
    await nextTick();
    expect(wrapper.text()).toContain("Running");
    setup.openAction(action({ status: "finished" }));
    await nextTick();
    expect(wrapper.text()).toContain("Completed");
    wrapper.unmount();
  });
});

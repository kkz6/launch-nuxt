import { flushPromises, shallowMount } from "@vue/test-utils";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRefs,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DatabaseBackups from "../../components/database/Backups.vue";

const mocks = vi.hoisted(() => ({
  getBackup: vi.fn(),
  listBackupRuns: vi.fn(),
  configureBackup: vi.fn(),
  runBackup: vi.fn(),
  deleteBackup: vi.fn(),
  api: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  handler: undefined as
    | ((data: Record<string, unknown>, event: string) => void)
    | undefined,
  closeHandler: undefined as ((open: boolean) => void) | undefined,
}));

vi.mock("~/services/dockerService", () => ({
  dockerService: {
    databases: {
      getBackup: mocks.getBackup,
      listBackupRuns: mocks.listBackupRuns,
      configureBackup: mocks.configureBackup,
      runBackup: mocks.runBackup,
      deleteBackup: mocks.deleteBackup,
    },
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}));

const user = ref({ current_team_id: "team-1" });

const database = (id = "database-1") =>
  ({
    id,
    name: "postgres",
    project_id: "project-1",
    server_id: "server-1",
  }) as never;

const configuredBackup = {
  id: "config-1",
  storage_provider_id: 1,
  database_name: "",
  path: "",
  retention: 10,
  cron_schedule: "0 3 * * *",
  notify_on_success: false,
  notify_on_failure: true,
  enabled: true,
};

const mountComponent = (databaseId = "database-1") =>
  shallowMount(DatabaseBackups, {
    props: { database: database(databaseId) },
    global: {
      stubs: {
        Icon: true,
        Button: true,
        Checkbox: true,
        DatabaseRestoreBackupDialog: true,
        Input: true,
        Label: true,
        NuxtLink: true,
        Select: true,
        SelectContent: true,
        SelectItem: true,
        SelectTrigger: true,
        SelectValue: true,
        SharedEmptyState: true,
        Card: { template: "<div><slot /></div>" },
        CardContent: { template: "<div><slot /></div>" },
        CardDescription: { template: "<div><slot /></div>" },
        CardHeader: { template: "<div><slot /></div>" },
        CardTitle: { template: "<div><slot /></div>" },
        Dialog: { template: "<div><slot /></div>" },
        DialogContent: { template: "<div><slot /></div>" },
        DialogDescription: { template: "<div><slot /></div>" },
        DialogFooter: { template: "<div><slot /></div>" },
        DialogHeader: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<div><slot /></div>" },
        ScrollArea: { template: "<div><slot /></div>" },
        Sheet: {
          name: "SheetStub",
          props: ["open"],
          emits: ["update:open"],
          template: "<div><slot /></div>",
        },
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

const setSetupRef = (
  wrapper: ReturnType<typeof mountComponent>,
  key: string,
  value: unknown,
) => {
  (wrapper.vm.$ as any).devtoolsRawSetupState[key].value = value;
};

describe("database backup activity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.getBackup.mockReset().mockResolvedValue({ data: configuredBackup });
    mocks.listBackupRuns.mockReset().mockResolvedValue({ data: [] });
    mocks.configureBackup
      .mockReset()
      .mockResolvedValue({ data: configuredBackup });
    mocks.runBackup
      .mockReset()
      .mockResolvedValue({ data: { id: "run-1", status: "triggered" } });
    mocks.deleteBackup.mockReset().mockResolvedValue(undefined);
    mocks.api.mockReset().mockResolvedValue({
      data: [{ id: 1, name: "S3", provider: "s3" }],
    });
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.handler = undefined;
    mocks.closeHandler = undefined;
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("useAuth", () => ({ user }));
    vi.stubGlobal(
      "useDockerBackupEvents",
      (
        _teamId: unknown,
        handler: (data: Record<string, unknown>, event: string) => void,
      ) => {
        mocks.handler = handler;
      },
    );
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("nextTick", nextTick);
    vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("reactive", reactive);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("toRefs", toRefs);
    vi.stubGlobal("watch", (source: unknown, callback: any, options?: any) => {
      if (
        (source as { _key?: string })?._key === "logSheetOpen" ||
        (!mocks.closeHandler && typeof source !== "function")
      ) {
        mocks.closeHandler = callback;
      }
      return watch(source as any, callback, options);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads only the current database state", async () => {
    let resolveFirst!: (value: { data: typeof configuredBackup }) => void;
    mocks.getBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const wrapper = mountComponent();
    await wrapper.setProps({ database: database("database-2") });
    resolveFirst({ data: configuredBackup });
    await flushPromises();

    expect(mocks.getBackup).toHaveBeenCalledWith(
      "server-1",
      "project-1",
      "database-2",
    );
    expect(setupState(wrapper).loading).toBe(false);
    wrapper.unmount();
  });

  it("renders successful backup notifications", async () => {
    mocks.getBackup.mockResolvedValueOnce({
      data: { ...configuredBackup, notify_on_success: true },
    });
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("on success");
    wrapper.unmount();
  });

  it("surfaces a current load error", async () => {
    mocks.getBackup.mockRejectedValueOnce({
      data: { message: "Load failed" },
    });
    const wrapper = mountComponent();
    await flushPromises();

    expect(mocks.error).toHaveBeenCalledWith("Load failed");
    expect(setupState(wrapper).loading).toBe(false);
    wrapper.unmount();
  });

  it("buffers a fast failed run until the response identifies it", async () => {
    let resolveRun!: (value: { data: { id: string } }) => void;
    mocks.runBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    const request = setup.runNow();
    await nextTick();
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-1",
        source: "manual",
        error: "Credential rejected",
      },
      "docker.database.backup.run.failed",
    );
    resolveRun({ data: { id: "run-1" } });
    await request;
    await flushPromises();

    expect(setup.logSheetRunId).toBe("run-1");
    expect(setup.logSheetError).toBe("Credential rejected");
    expect(setup.awaitingRunLogs).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith("Credential rejected");
    wrapper.unmount();
  });

  it("attaches logs and refreshes a fast successful run", async () => {
    let resolveRun!: (value: { data: { id: string } }) => void;
    mocks.runBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    const request = setup.runNow();
    await nextTick();
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-1",
        source: "manual",
        task_id: "task-1",
        type: "backup_step",
        value: "uploading",
      },
      "docker.database.backup.run.progress",
    );
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-1",
        source: "manual",
        task_id: "task-1",
      },
      "docker.database.backup.run.succeeded",
    );
    resolveRun({ data: { id: "run-1" } });
    await request;
    await flushPromises();

    expect(setup.logSheetTaskId).toBe("task-1");
    expect(mocks.success).toHaveBeenCalledWith("Backup completed");
    vi.advanceTimersByTime(800);
    expect(setup.logRefreshNonce).toBe(1);
    wrapper.unmount();
  });

  it("tracks only the open run and reports taskless failures", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);
    setup.openRunLogs({ id: "run-1", task_id: "task-1" });
    setSetupRef(wrapper, "awaitingRunLogs", true);
    await nextTick();

    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-2",
        type: "backup_step",
        value: "ignored",
      },
      "docker.database.backup.run.progress",
    );
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-1",
        type: "backup_step",
        value: "dumping",
      },
      "docker.database.backup.run.progress",
    );
    expect(setup.liveStep).toBe("dumping");

    setSetupRef(wrapper, "logSheetTaskId", "");
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-1",
        error: "",
      },
      "docker.database.backup.run.failed",
    );
    expect(setup.logSheetError).toBe(
      "Backup failed before log streaming could start.",
    );
    expect(mocks.error).toHaveBeenCalledWith(
      "Backup failed before log streaming could start",
    );

    mocks.handler?.(
      { database_id: "other", run_id: "run-1" },
      "docker.database.backup.run.succeeded",
    );
    wrapper.unmount();
  });

  it("shows immediate request failures in the console", async () => {
    mocks.runBackup.mockRejectedValueOnce({ data: { message: "Queue down" } });
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);
    await setup.runNow();

    expect(setup.logSheetError).toBe("Queue down");
    expect(setup.awaitingRunLogs).toBe(false);
    expect(mocks.error).toHaveBeenCalledWith("Queue down");
    wrapper.unmount();
  });

  it("recovers a task id by polling when no event arrives", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    mocks.listBackupRuns
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [
          { id: "other-run", status: "failed", task_id: "wrong-task" },
          { id: "run-1", status: "running", task_id: "task-1" },
        ],
      });

    const setup = setupState(wrapper);
    await setup.runNow();
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(setup.logSheetTaskId).toBe("task-1");
    expect(setup.awaitingRunLogs).toBe(false);
    const callsAfterRecovery = mocks.listBackupRuns.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.listBackupRuns).toHaveBeenCalledTimes(callsAfterRecovery);
    wrapper.unmount();
  });

  it("recovers a taskless terminal error without duplicate toasts", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    mocks.listBackupRuns
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [
          { id: "other-run", status: "failed", error: "Wrong run" },
          { id: "run-1", status: "failed", error: "Credential rejected" },
        ],
      });

    const setup = setupState(wrapper);
    await setup.runNow();
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(setup.logSheetError).toBe("Credential rejected");
    expect(setup.awaitingRunLogs).toBe(false);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-1",
        error: "Credential rejected",
      },
      "docker.database.backup.run.failed",
    );
    expect(mocks.error).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("uses terminal response snapshots when no event arrives", async () => {
    mocks.runBackup
      .mockResolvedValueOnce({ data: { id: "run-success", status: "success" } })
      .mockResolvedValueOnce({ data: { id: "run-failed", status: "failed" } })
      .mockResolvedValueOnce({
        data: {
          id: "run-failed-with-task",
          status: "failed",
          task_id: "task-1",
        },
      });
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    await setup.runNow();
    expect(mocks.success).toHaveBeenCalledWith("Backup completed");
    expect(setup.awaitingRunLogs).toBe(false);

    await setup.runNow();
    expect(setup.logSheetError).toBe(
      "Backup failed before log streaming could start.",
    );

    await setup.runNow();
    expect(setup.logSheetTaskId).toBe("task-1");
    expect(setup.logSheetError).toBe("");
    expect(mocks.error).toHaveBeenCalledWith(
      "Backup failed — check the log console for details",
    );
    wrapper.unmount();
  });

  it("bounds polling and shows an actionable fallback", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    mocks.listBackupRuns
      .mockResolvedValueOnce({ data: [] })
      .mockRejectedValueOnce(new Error("temporary"));

    const setup = setupState(wrapper);
    await setup.runNow();
    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(setup.awaitingRunLogs).toBe(false);
    expect(setup.logSheetError).toBe(
      "Live output is not available yet. Follow this backup in Active actions.",
    );
    const callsAtLimit = mocks.listBackupRuns.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.listBackupRuns).toHaveBeenCalledTimes(callsAtLimit);
    wrapper.unmount();
  });

  it("handles configuration and console lifecycle helpers", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    setup.openDialog();
    expect(setup.dialogOpen).toBe(true);
    await setup.saveConfig();
    expect(mocks.success).toHaveBeenCalledWith("Backup configuration updated");

    setSetupRef(wrapper, "logSheetOpen", false);
    await flushPromises();
    expect(setup.logSheetRunId).toBe("");

    await setup.deleteConfig();
    expect(mocks.deleteBackup).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("handles stale load failures and console timer invalidation", async () => {
    let rejectFirst!: (reason: unknown) => void;
    mocks.getBackup.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFirst = reject;
      }),
    );
    const wrapper = mountComponent();
    await wrapper.setProps({ database: database("database-2") });
    rejectFirst({ data: { message: "Stale" } });
    await flushPromises();
    expect(mocks.error).not.toHaveBeenCalledWith("Stale");

    const setup = setupState(wrapper);
    setup.openRunLogs({ id: "run-2", task_id: "task-2" });
    mocks.handler?.(
      {
        database_id: "database-2",
        run_id: "run-2",
        task_id: "task-2",
      },
      "docker.database.backup.run.succeeded",
    );
    mocks.handler?.(
      {
        database_id: "database-2",
        run_id: "run-2",
        task_id: "task-2",
      },
      "docker.database.backup.run.succeeded",
    );
    setSetupRef(wrapper, "logSheetRunId", "other-run");
    vi.advanceTimersByTime(800);
    expect(setup.logRefreshNonce).toBe(0);
    mocks.closeHandler?.(false);
    expect(setup.logSheetTaskId).toBe("");
    wrapper.unmount();
  });

  it("applies buffered progress and fallback failure details", async () => {
    let resolveProgress!: (value: { data: { id: string } }) => void;
    mocks.runBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProgress = resolve;
      }),
    );
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    const progressRequest = setup.runNow();
    await nextTick();
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-progress",
        source: "manual",
        type: "backup_step",
        value: "dumping",
      },
      "docker.database.backup.run.progress",
    );
    resolveProgress({ data: { id: "run-progress" } });
    await progressRequest;
    expect(setup.liveStep).toBe("dumping");
    expect(mocks.success).toHaveBeenCalledWith(
      "Backup triggered — running in the background",
    );

    let resolveFailure!: (value: { data: { id: string } }) => void;
    mocks.runBackup.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFailure = resolve;
      }),
    );
    const failureRequest = setup.runNow();
    await nextTick();
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "run-failure",
        source: "manual",
      },
      "docker.database.backup.run.failed",
    );
    resolveFailure({ data: { id: "run-failure" } });
    await failureRequest;
    expect(setup.logSheetError).toBe(
      "Backup failed before log streaming could start.",
    );
    wrapper.unmount();
  });

  it("handles configured, scheduled progress, and open-run events", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);
    setSetupRef(wrapper, "liveStep", "old");
    setSetupRef(wrapper, "liveStepRunId", "old-run");

    mocks.handler?.(
      { database_id: "database-1" },
      "docker.database.backup.configured",
    );
    expect(setup.liveStep).toBe("");

    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "scheduled-1",
        type: "backup_step",
        value: "dumping",
      },
      "docker.database.backup.run.progress",
    );
    expect(setup.liveStep).toBe("dumping");

    setup.openRunLogs({ id: "scheduled-1", task_id: "task-old" });
    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "scheduled-1",
        task_id: "task-new",
      },
      "docker.database.backup.run.started",
    );
    expect(setup.logSheetTaskId).toBe("task-new");

    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "scheduled-1",
        task_id: "task-new",
        error: "Dump failed",
      },
      "docker.database.backup.run.failed",
    );
    expect(mocks.error).toHaveBeenCalledWith(
      "Backup failed — check the log console for details",
    );

    mocks.handler?.(
      {
        database_id: "database-1",
        run_id: "scheduled-2",
        task_id: "task-new",
      },
      "docker.database.backup.run.succeeded",
    );
    expect(mocks.success).toHaveBeenCalledWith("Backup completed");
    wrapper.unmount();
  });

  it("ignores a superseded manual response", async () => {
    let resolveFirst!: (value: { data: { id: string } }) => void;
    mocks.runBackup
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({ data: { id: "run-2" } });
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    const first = setup.runNow();
    const second = setup.runNow();
    await second;
    resolveFirst({ data: { id: "run-1" } });
    await first;

    expect(setup.logSheetRunId).toBe("run-2");
    wrapper.unmount();
  });

  it("does not run or delete without a configuration", async () => {
    mocks.getBackup.mockResolvedValueOnce({ data: null });
    const wrapper = mountComponent();
    await flushPromises();
    const setup = setupState(wrapper);

    await setup.runNow();
    await setup.deleteConfig();
    expect(mocks.runBackup).not.toHaveBeenCalled();
    expect(mocks.deleteBackup).not.toHaveBeenCalled();

    setup.openDialog();
    expect(setup.storageProviderId).toBe(1);
    wrapper.unmount();
  });
});

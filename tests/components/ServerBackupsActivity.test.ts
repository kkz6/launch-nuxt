import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServerBackups from "../../components/server/settings/Backups.vue";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  openSettings: vi.fn(),
  handler: undefined as
    | ((data: Record<string, unknown>, event: string) => void)
    | undefined,
  closeHandler: undefined as ((open: boolean) => void) | undefined,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
  },
}));

const user = ref({ current_team_id: "team-1" });

const backup = {
  id: "backup-1",
  server_id: "server-1",
  user_id: "user-1",
  storage_provider_id: "1",
  cron_expression: "0 3 * * *",
  include_files: [],
  exclude_files: [],
  retention: 10,
  notification_on_failure: true,
  notification_on_success: false,
  enabled: true,
  path: "/var/lib/postgresql",
  installed_at: null,
  size_in_mb: 0,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
  jobs: [],
  databases: [],
};

const job = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  backup_id: "backup-1",
  storage_provider_id: "1",
  status: "pending",
  size: 0,
  size_in_mb: 0,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
  ...overrides,
});

const mountComponent = (serverId = "server-1") =>
  shallowMount(ServerBackups, {
    props: { serverId },
    global: {
      stubs: {
        Icon: true,
        Badge: true,
        Button: true,
        Card: { template: "<div><slot /></div>" },
        CardContent: { template: "<div><slot /></div>" },
        CardDescription: { template: "<div><slot /></div>" },
        CardHeader: { template: "<div><slot /></div>" },
        CardTitle: { template: "<div><slot /></div>" },
        SharedConfirmationDialog: true,
        ServerCreateBackup: true,
        ServerSettingsBackupHistorySheet: true,
        SharedCronSchedule: true,
        SharedDataTable: {
          props: ["data"],
          template:
            '<div><slot v-if="data.length" name="cell-schedule" :row="data[0]" /></div>',
        },
        SharedDateTooltip: true,
        Sheet: { template: "<div><slot /></div>" },
        SheetContent: { template: "<div><slot /></div>" },
        SheetDescription: { template: "<div><slot /></div>" },
        SheetHeader: { template: "<div><slot /></div>" },
        SheetTitle: { template: "<div><slot /></div>" },
        Tooltip: { template: "<div><slot /></div>" },
        TooltipContent: { template: "<div><slot /></div>" },
        TooltipProvider: { template: "<div><slot /></div>" },
        TooltipTrigger: { template: "<div><slot /></div>" },
        ServerBackupForm: true,
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

const installConfirmation = (
  wrapper: ReturnType<typeof mountComponent>,
  ok = true,
) => {
  setSetupRef(wrapper, "confirmationDialog", {
    show: vi.fn().mockResolvedValue({ ok }),
  });
};

describe("server backup activity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.api.mockReset().mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") return Promise.resolve({ data: job() });
      if (options?.method === "DELETE") return Promise.resolve({});
      if (url === "/storage-providers") {
        return Promise.resolve({ data: [{ id: 1, label: "S3" }] });
      }
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.openSettings.mockReset();
    mocks.handler = undefined;
    mocks.closeHandler = undefined;
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("useAuth", () => ({ user }));
    vi.stubGlobal("useSettingsSheet", () => ({ open: mocks.openSettings }));
    vi.stubGlobal(
      "useBackupEvents",
      (
        _teamId: unknown,
        handler: (data: Record<string, unknown>, event: string) => void,
      ) => {
        mocks.handler = handler;
      },
    );
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", (source: unknown, callback: any, options?: any) => {
      if (
        (source as { _key?: string })?._key === undefined &&
        options?.immediate
      ) {
        callback();
      } else if (typeof source !== "function") {
        mocks.closeHandler = callback;
      }
      return watch(source as any, callback, { ...options, immediate: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads and clears state when the server changes", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    expect(setupState(wrapper).backups).toHaveLength(1);

    await wrapper.setProps({ serverId: "server-2" });
    await flushPromises();
    expect(mocks.api).toHaveBeenCalledWith("/servers/server-2/backups");
    expect(setupState(wrapper).isLoading).toBe(false);
    wrapper.unmount();
  });

  it("surfaces current fetch failures", async () => {
    mocks.api.mockRejectedValueOnce(new Error("down"));
    const wrapper = mountComponent();
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith("Failed to load backups");
    wrapper.unmount();
  });

  it("buffers a fast taskless failure until the job response", async () => {
    let resolveRun!: (value: { data: ReturnType<typeof job> }) => void;
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return new Promise((resolve) => {
          resolveRun = resolve;
        });
      }
      if (url === "/storage-providers") {
        return Promise.resolve({ data: [{ id: 1, label: "S3" }] });
      }
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });

    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    const request = setupState(wrapper).runBackup(backup);
    await Promise.resolve();

    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        error: "Credential rejected",
      },
      "backup.run.failed",
    );
    resolveRun({
      data: job({ status: "failed", error: "Credential rejected" }),
    });
    await request;
    await flushPromises();

    expect(setupState(wrapper).logSheetError).toBe("Credential rejected");
    expect(mocks.error).toHaveBeenCalledWith("Credential rejected");
    wrapper.unmount();
  });

  it("attaches and refreshes a fast successful job", async () => {
    let resolveRun!: (value: { data: ReturnType<typeof job> }) => void;
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return new Promise((resolve) => {
          resolveRun = resolve;
        });
      }
      if (url === "/storage-providers") {
        return Promise.resolve({ data: [{ id: 1, label: "S3" }] });
      }
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });

    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    const request = setupState(wrapper).runBackup(backup);
    await Promise.resolve();

    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        task_id: "task-1",
      },
      "backup.run.started",
    );
    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        task_id: "task-1",
      },
      "backup.run.succeeded",
    );
    resolveRun({ data: job({ status: "finished", task_id: "task-1" }) });
    await request;

    expect(setupState(wrapper).logSheetTaskId).toBe("task-1");
    expect(mocks.success).toHaveBeenCalledWith("Backup completed");
    vi.advanceTimersByTime(800);
    expect(setupState(wrapper).logRefreshNonce).toBe(1);
    wrapper.unmount();
  });

  it("handles active job events and failure log hints", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    await setupState(wrapper).runBackup(backup);

    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "other",
      },
      "backup.run.failed",
    );
    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        task_id: "task-1",
      },
      "backup.run.started",
    );
    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        task_id: "task-1",
        error: "Dump failed",
      },
      "backup.run.failed",
    );

    expect(mocks.error).toHaveBeenCalledWith(
      "Backup failed — check the log console for details",
    );
    wrapper.unmount();
  });

  it("uses the failed response snapshot when no event arrives", async () => {
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return Promise.resolve({ data: job({ status: "failed" }) });
      }
      if (url === "/storage-providers") return Promise.resolve({ data: [] });
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });
    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    await setupState(wrapper).runBackup(backup);

    expect(setupState(wrapper).logSheetError).toBe(
      "Backup failed before log streaming could start.",
    );
    expect(mocks.error).toHaveBeenCalledWith("Backup failed");
    wrapper.unmount();
  });

  it("shows queue failures in the open console", async () => {
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return Promise.reject({ data: { message: "Queue down" } });
      }
      if (url === "/storage-providers") return Promise.resolve({ data: [] });
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });
    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    await setupState(wrapper).runBackup(backup);

    expect(setupState(wrapper).logSheetError).toBe("Queue down");
    expect(mocks.error).toHaveBeenCalledWith("Queue down");
    wrapper.unmount();
  });

  it("recovers a task id by polling when no event arrives", async () => {
    let reconciliationCalls = 0;
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return Promise.resolve({ data: job() });
      }
      if (url === "/servers/server-1/backups/backup-1") {
        reconciliationCalls++;
        return Promise.resolve({
          data: {
            ...backup,
            jobs: [
              job({ id: "other-job", task_id: "wrong-task" }),
              job({ task_id: "task-1", status: "running" }),
            ],
          },
        });
      }
      if (url === "/storage-providers") {
        return Promise.resolve({ data: [{ id: 1, label: "S3" }] });
      }
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });

    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    const setup = setupState(wrapper);
    await setup.runBackup(backup);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(setup.logSheetTaskId).toBe("task-1");
    expect(setup.awaitingRunLogs).toBe(false);
    expect(reconciliationCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(reconciliationCalls).toBe(1);
    wrapper.unmount();
  });

  it("recovers a taskless terminal error without duplicate toasts", async () => {
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return Promise.resolve({ data: job() });
      }
      if (url === "/servers/server-1/backups/backup-1") {
        return Promise.resolve({
          data: {
            ...backup,
            jobs: [
              job({ id: "other-job", status: "failed", error: "Wrong job" }),
              job({ status: "failed", error: "Credential rejected" }),
            ],
          },
        });
      }
      if (url === "/storage-providers") return Promise.resolve({ data: [] });
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });

    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    const setup = setupState(wrapper);
    await setup.runBackup(backup);
    await vi.advanceTimersByTimeAsync(1000);
    await flushPromises();

    expect(setup.logSheetError).toBe("Credential rejected");
    expect(setup.awaitingRunLogs).toBe(false);
    expect(mocks.error).toHaveBeenCalledTimes(1);
    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        error: "Credential rejected",
      },
      "backup.run.failed",
    );
    expect(mocks.error).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("uses the event fallback when a taskless failure has no detail", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    const setup = setupState(wrapper);
    await setup.runBackup(backup);

    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
      },
      "backup.run.failed",
    );

    expect(setup.logSheetError).toBe(
      "Backup failed before log streaming could start.",
    );
    expect(mocks.error).toHaveBeenCalledWith("Backup failed");
    wrapper.unmount();
  });

  it("bounds polling and shows an actionable fallback", async () => {
    let reconciliationCalls = 0;
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") {
        return Promise.resolve({ data: job() });
      }
      if (url === "/servers/server-1/backups/backup-1") {
        reconciliationCalls++;
        if (reconciliationCalls === 1) {
          return Promise.reject(new Error("temporary"));
        }
        return Promise.resolve({ data: { ...backup, jobs: [job()] } });
      }
      if (url === "/storage-providers") return Promise.resolve({ data: [] });
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });

    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    const setup = setupState(wrapper);
    await setup.runBackup(backup);
    await vi.advanceTimersByTimeAsync(60_000);
    await flushPromises();

    expect(setup.awaitingRunLogs).toBe(false);
    expect(setup.logSheetError).toBe(
      "Live output is not available yet. Follow this backup in Active actions.",
    );
    expect(reconciliationCalls).toBe(60);
    await vi.advanceTimersByTimeAsync(5000);
    expect(reconciliationCalls).toBe(60);
    wrapper.unmount();
  });

  it("rejects invalid run identities and cancelled confirmations", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper, false);
    await setupState(wrapper).runBackup(backup);

    installConfirmation(wrapper);
    mocks.api.mockImplementation((url: string, options?: any) => {
      if (options?.method === "POST") return Promise.resolve({ data: {} });
      if (url === "/storage-providers") return Promise.resolve({ data: [] });
      if (url.endsWith("/databases")) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [backup] });
    });
    await setupState(wrapper).runBackup(backup);
    expect(mocks.error).toHaveBeenCalledWith(
      "Backup started without a valid run identifier.",
    );
    wrapper.unmount();
  });

  it("invalidates timers and state when the console closes", async () => {
    const wrapper = mountComponent();
    await flushPromises();
    installConfirmation(wrapper);
    await setupState(wrapper).runBackup(backup);

    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        task_id: "task-1",
      },
      "backup.run.succeeded",
    );
    mocks.handler?.(
      {
        backup_id: "backup-1",
        job_id: "job-1",
        server_id: "server-1",
        task_id: "task-1",
      },
      "backup.run.succeeded",
    );
    setSetupRef(wrapper, "logSheetJobId", "other-job");
    vi.advanceTimersByTime(800);
    expect(setupState(wrapper).logRefreshNonce).toBe(0);
    mocks.closeHandler?.(false);
    expect(setupState(wrapper).logSheetTaskId).toBe("");
    wrapper.unmount();
  });
});

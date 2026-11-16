import { flushPromises, shallowMount } from "@vue/test-utils";
import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  ref,
  unref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SystemUpdates from "../../components/server/settings/SystemUpdates.vue";
import { useLiveRefresh } from "../../composables/useLiveRefresh";
import type { SystemUpdateStatus } from "../../services/serverService";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  repair: vi.fn(),
  retry: vi.fn(),
  logs: vi.fn(),
  reboot: vi.fn(),
  rebootStatus: vi.fn(),
  verifyReboot: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("~/services/serverService", () => ({
  serverService: {
    systemUpdates: {
      get: mocks.get,
      save: mocks.save,
      repair: mocks.repair,
      retry: mocks.retry,
      logs: mocks.logs,
    },
    reboot: mocks.reboot,
    rebootStatus: mocks.rebootStatus,
    verifyReboot: mocks.verifyReboot,
  },
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const connected = ref(true);
const canEdit = ref(true);
const canRestart = ref(true);
const user = ref({ current_team_id: "team-1" });
const handlers = new Map<string, (data: unknown, channel?: string) => void>();
const subscribeToChannel = vi.fn();
const unsubscribeFromChannel = vi.fn();
const status = (
  changes: Partial<SystemUpdateStatus> = {},
): SystemUpdateStatus => ({
  supported: true,
  enabled: true,
  schedule: "03:00",
  notifications: true,
  timer_active: true,
  running: false,
  native_enabled: false,
  reboot_required: false,
  security_patches_this_month: 0,
  last_run: null,
  recently_updated: [],
  ...changes,
});
const deferred = () => {
  let resolve!: (value: { data: SystemUpdateStatus }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ data: SystemUpdateStatus }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const mountPage = () =>
  shallowMount(SystemUpdates, {
    props: { serverId: "server-1" },
    global: {
      stubs: {
        Icon: true,
        SharedConfirmationDialog: defineComponent({
          setup(_props, { expose }) {
            expose({ show: mocks.confirm });
            return () => null;
          },
        }),
        Label: { template: "<label><slot /></label>" },
        Button: { template: "<button><slot /></button>" },
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Switch: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        },
      },
    },
  });
let page: ReturnType<typeof mountPage>;
const sendEvent = (
  serverId = "server-1",
  teamId = "team-1",
  channel = `team.${teamId}`,
) =>
  handlers.get("server.system_updates.updated")!(
    { server_id: serverId, team_id: teamId },
    channel,
  );
const settle = async () => {
  await vi.advanceTimersByTimeAsync(200);
  await flushPromises();
};
const timeInput = () => page.get<HTMLInputElement>("#system-updates-schedule");

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  connected.value = true;
  canEdit.value = true;
  canRestart.value = true;
  user.value = { current_team_id: "team-1" };
  handlers.clear();
  mocks.get.mockReset().mockResolvedValue({ data: status() });
  mocks.rebootStatus
    .mockReset()
    .mockResolvedValue({ data: { status: "idle" } });
  mocks.reboot.mockReset().mockResolvedValue({ data: null });
  mocks.verifyReboot
    .mockReset()
    .mockResolvedValue({ data: { status: "verifying", can_verify: true } });
  mocks.repair.mockReset().mockResolvedValue({ data: status() });
  mocks.retry
    .mockReset()
    .mockResolvedValue({ data: status({ running: true }) });
  mocks.logs
    .mockReset()
    .mockResolvedValue({
      data: { logs: "Package lock is held by another process." },
    });
  mocks.confirm.mockReset().mockResolvedValue({ ok: true });
  mocks.save
    .mockReset()
    .mockResolvedValue({ data: status({ schedule: "05:30" }) });
  for (const [name, value] of Object.entries({
    computed,
    ref,
    watch,
    unref,
    onMounted,
    onScopeDispose,
    onBeforeUnmount,
    useLiveRefresh,
  }))
    vi.stubGlobal(name, value);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useCan", () => ({ canEdit, canDelete: canRestart }));
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useWebSocket", () => ({
    isConnected: connected,
    subscribeToChannel,
    unsubscribeFromChannel,
    subscribe: (
      event: string,
      handler: (data: unknown, channel?: string) => void,
    ) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
  }));
});
afterEach(() => {
  page?.unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("system update live state", () => {
  it("refreshes matching events, coalesces bursts, and reconciles after reconnect", async () => {
    page = mountPage();
    await flushPromises();
    expect(subscribeToChannel).toHaveBeenCalledWith("team.team-1");
    sendEvent("other-server");
    sendEvent("server-1", "other-team");
    sendEvent("server-1", "team-1", "team.other-team");
    await settle();
    expect(mocks.get).toHaveBeenCalledOnce();
    mocks.get.mockResolvedValue({ data: status({ running: true }) });
    sendEvent();
    sendEvent();
    await settle();
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(page.get('[role="status"]').text()).toContain("Running");
    connected.value = false;
    await nextTick();
    mocks.get.mockResolvedValue({ data: status({ reboot_required: true }) });
    connected.value = true;
    await settle();
    expect(mocks.get).toHaveBeenCalledTimes(3);
    expect(page.text()).toContain("Required");
    expect(subscribeToChannel).toHaveBeenCalledOnce();
  });

  it("updates reports while retaining unsaved settings, including edits made during a read", async () => {
    page = mountPage();
    await flushPromises();
    const pending = deferred();
    mocks.get.mockReturnValueOnce(pending.promise);
    sendEvent();
    await settle();
    await timeInput().setValue("05:30");
    pending.resolve({
      data: status({
        schedule: "04:00",
        reboot_required: true,
        recently_updated: [{ name: "openssl", version: "3.0.20" }],
      }),
    });
    await flushPromises();
    expect(timeInput().element.value).toBe("05:30");
    expect(page.text()).toContain("openssl");
    expect(page.text()).toContain("Required");
    await page.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith("server-1", {
      enabled: true,
      schedule: "05:30",
      notifications: true,
    });
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it("defers events during saves and refreshes once the save completes", async () => {
    page = mountPage();
    await flushPromises();
    await timeInput().setValue("05:30");
    const pending = deferred();
    mocks.save.mockReturnValueOnce(pending.promise);
    await page.get("form").trigger("submit");
    sendEvent();
    await settle();
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(
      page.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    mocks.get.mockResolvedValue({
      data: status({ schedule: "05:30", running: true }),
    });
    pending.resolve({ data: status({ schedule: "05:30" }) });
    await flushPromises();
    await settle();
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(timeInput().element.value).toBe("05:30");
    expect(page.get('[role="status"]').text()).toContain("Running");
  });

  it("does not let an older background read overwrite a completed save", async () => {
    page = mountPage();
    await flushPromises();
    const pending = deferred();
    mocks.get.mockReturnValueOnce(pending.promise);
    sendEvent();
    await settle();
    await timeInput().setValue("05:30");
    await page.get("form").trigger("submit");
    await flushPromises();
    pending.resolve({ data: status({ schedule: "04:00" }) });
    await flushPromises();
    expect(timeInput().element.value).toBe("05:30");
    expect(
      page.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("retains confirmed data and drafts on failures and recovers on the next event", async () => {
    page = mountPage();
    await flushPromises();
    await timeInput().setValue("05:30");
    mocks.get.mockRejectedValueOnce(new Error("offline"));
    sendEvent();
    await settle();
    expect(page.find('[role="alert"]').exists()).toBe(true);
    expect(timeInput().element.value).toBe("05:30");
    mocks.save.mockRejectedValueOnce(new Error("offline"));
    await page.get("form").trigger("submit");
    await flushPromises();
    expect(timeInput().element.value).toBe("05:30");
    expect(mocks.error).toHaveBeenCalledOnce();
    mocks.get.mockResolvedValue({ data: status({ reboot_required: true }) });
    sendEvent();
    await settle();
    expect(page.text()).not.toContain("Could not refresh system updates.");
    expect(timeInput().element.value).toBe("05:30");
    expect(page.text()).toContain("Required");
  });

  it("discards stale responses across servers and replaces the team subscription", async () => {
    const pending = deferred();
    mocks.get.mockReturnValueOnce(pending.promise);
    page = mountPage();
    await page.setProps({ serverId: "server-2" });
    await flushPromises();
    pending.resolve({ data: status({ schedule: "23:00" }) });
    await flushPromises();
    expect(timeInput().element.value).toBe("03:00");
    expect(mocks.get).toHaveBeenLastCalledWith("server-2");
    user.value = { current_team_id: "team-2" };
    await flushPromises();
    expect(unsubscribeFromChannel).toHaveBeenCalledWith("team.team-1");
    expect(subscribeToChannel).toHaveBeenLastCalledWith("team.team-2");
    const calls = mocks.get.mock.calls.length;
    sendEvent("server-2");
    await settle();
    expect(mocks.get).toHaveBeenCalledTimes(calls);
    sendEvent("server-2", "team-2");
    await settle();
    expect(mocks.get).toHaveBeenCalledTimes(calls + 1);
  });

  it("keeps viewers read-only and cancels queued refreshes after leaving the page", async () => {
    canEdit.value = false;
    page = mountPage();
    await flushPromises();
    expect(timeInput().attributes("disabled")).toBeDefined();
    expect(page.find('button[type="submit"]').exists()).toBe(false);
    sendEvent();
    page.unmount();
    await settle();
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(unsubscribeFromChannel).toHaveBeenCalledWith("team.team-1");
  });
});

const button = (label: string) => {
  const found = page
    .findAll("button")
    .find((element) => element.text() === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
};
const restartEvent = (serverId = "server-1") =>
  handlers.get("server.reboot.updated")!(
    { server_id: serverId, team_id: "team-1" },
    "team.team-1",
  );

describe("system update remedies", () => {
  it("confirms downtime and tracks restart through verified completion instead of POST success", async () => {
    mocks.get.mockResolvedValue({ data: status({ reboot_required: true }) });
    page = mountPage();
    await flushPromises();
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    await button("Restart server").trigger("click");
    await flushPromises();
    expect(mocks.reboot).not.toHaveBeenCalled();
    mocks.rebootStatus.mockResolvedValue({ data: { status: "queued" } });
    await button("Restart server").trigger("click");
    await flushPromises();
    expect(mocks.confirm.mock.calls[0][0].description).toContain("unavailable");
    expect(mocks.reboot).toHaveBeenCalledWith("server-1");
    expect(page.get('[data-testid="restart-progress"]').text()).toContain(
      "Restart queued",
    );
    expect(page.text()).not.toContain("Restart confirmed");
    expect(timeInput().attributes("disabled")).toBeDefined();
    mocks.rebootStatus.mockResolvedValue({ data: { status: "verifying" } });
    restartEvent();
    await settle();
    expect(page.text()).toContain("Checking server recovery");
    mocks.rebootStatus.mockResolvedValue({ data: { status: "succeeded" } });
    mocks.get.mockResolvedValue({ data: status() });
    restartEvent();
    await settle();
    await settle();
    expect(page.text()).toContain("Restart confirmed");
    expect(page.text()).toContain("reachable again");
    expect(
      page
        .findAll("button")
        .some((element) => element.text() === "Restart server"),
    ).toBe(false);
  });

  it("loads persisted restart progress while SSH is offline and rechecks without another reboot", async () => {
    mocks.get.mockRejectedValue(new Error("offline"));
    mocks.rebootStatus.mockResolvedValue({ data: { status: "restarting" } });
    page = mountPage();
    await flushPromises();
    expect(page.text()).toContain("Restarting server");
    expect(page.text()).not.toContain("Could not refresh system updates");
    mocks.rebootStatus.mockResolvedValue({
      data: {
        status: "failed",
        can_verify: true,
        message: "Server has not returned.",
      },
    });
    restartEvent("other-server");
    await settle();
    expect(mocks.rebootStatus).toHaveBeenCalledOnce();
    restartEvent();
    await settle();
    expect(page.text()).toContain("hosting provider");
    await button("Check again").trigger("click");
    await flushPromises();
    expect(mocks.verifyReboot).toHaveBeenCalledWith("server-1");
    expect(mocks.reboot).not.toHaveBeenCalled();
    expect(page.text()).toContain("Checking server recovery");
  });

  it("recovers an accepted restart after the request response is lost and blocks duplicate requests", async () => {
    mocks.get.mockResolvedValue({ data: status({ reboot_required: true }) });
    page = mountPage();
    await flushPromises();
    mocks.reboot.mockRejectedValueOnce(new Error("response lost"));
    mocks.rebootStatus.mockResolvedValue({ data: { status: "queued" } });
    await button("Restart server").trigger("click");
    await flushPromises();
    expect(page.text()).toContain("Restart queued");
    expect(button("Restart server").attributes("disabled")).toBeDefined();
    expect(mocks.reboot).toHaveBeenCalledOnce();
  });

  it("repairs saved settings without overwriting drafts and offers failed-run logs and retry", async () => {
    mocks.get.mockResolvedValue({
      data: status({
        timer_active: false,
        last_run: {
          finished_at: "2026-11-16T03:00:00Z",
          status: "failed",
          packages: [],
        },
      }),
    });
    page = mountPage();
    await flushPromises();
    await timeInput().setValue("06:00");
    await button("Repair schedule").trigger("click");
    await flushPromises();
    expect(mocks.repair).toHaveBeenCalledWith("server-1");
    expect(timeInput().element.value).toBe("06:00");
    mocks.get.mockResolvedValue({
      data: status({
        last_run: {
          finished_at: "2026-11-16T03:00:00Z",
          status: "failed",
          packages: [],
        },
      }),
    });
    sendEvent();
    await settle();
    await button("View update log").trigger("click");
    await flushPromises();
    expect(page.text()).toContain("Package lock is held");
    await button("Retry updates").trigger("click");
    await flushPromises();
    expect(mocks.retry).toHaveBeenCalledWith("server-1");
    expect(page.text()).toContain("Security updates are running");
    expect(timeInput().element.value).toBe("06:00");
    expect(timeInput().attributes("disabled")).toBeDefined();
  });

  it("shows permission-appropriate solutions and actionable missing-support guidance", async () => {
    canRestart.value = false;
    canEdit.value = false;
    mocks.get.mockResolvedValue({
      data: status({
        reboot_required: true,
        updater_installed: false,
        timer_active: false,
      }),
    });
    page = mountPage();
    await flushPromises();
    expect(page.text()).toContain("Ask a team admin or owner");
    expect(page.text()).toContain("Ask a team editor");
    expect(
      page
        .findAll("button")
        .some((element) =>
          [
            "Restart server",
            "Repair schedule",
            "Copy install command",
          ].includes(element.text()),
        ),
    ).toBe(false);
    canEdit.value = true;
    await nextTick();
    expect(page.text()).toContain("sudo apt-get install unattended-upgrades");
    expect(button("Repair schedule").attributes("disabled")).toBeDefined();
  });

  it("keeps unsaved settings during explicit error recovery and retains action failure guidance", async () => {
    mocks.get.mockResolvedValue({ data: status({ timer_active: false }) });
    page = mountPage();
    await flushPromises();
    await timeInput().setValue("06:00");
    mocks.repair.mockRejectedValueOnce({
      data: { message: "The timer could not be started." },
    });
    await button("Repair schedule").trigger("click");
    await flushPromises();
    expect(page.text()).toContain("The timer could not be started.");
    mocks.get.mockRejectedValueOnce(new Error("offline"));
    sendEvent();
    await settle();
    await button("Try connection again").trigger("click");
    await flushPromises();
    expect(timeInput().element.value).toBe("06:00");
    expect(page.text()).toContain("The timer could not be started.");
    expect(page.text()).not.toContain("Could not refresh system updates");
  });
});

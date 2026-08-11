import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamSwitcher from "../../components/shared/TeamSwitcher.vue";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  fetchUser: vi.fn(),
  setCurrentTeamId: vi.fn(),
  reconnect: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const user = ref({ id: "user", current_team_id: "personal" });
const states = new Map<string, ReturnType<typeof ref<number>>>();
const teams = [
  {
    id: "personal",
    user_id: "user",
    name: "Launch",
    personal_team: true,
    is_owner: true,
  },
  {
    id: "01TEAM123456",
    user_id: "other",
    name: "Launch",
    personal_team: false,
    is_owner: false,
  },
];

interface TeamSwitcherState {
  loading: boolean;
  switchTeam: (teamId: string) => Promise<void>;
  teams: typeof teams;
}

const setupState = (wrapper: ReturnType<typeof mountSwitcher>) =>
  (wrapper.vm.$ as unknown as { setupState: TeamSwitcherState }).setupState;

const mountSwitcher = () =>
  shallowMount(TeamSwitcher, {
    global: {
      stubs: {
        Icon: true,
        Check: true,
        Plus: true,
        DropdownMenuGroup: { template: "<div><slot /></div>" },
        DropdownMenuItem: { template: "<button><slot /></button>" },
        SettingsCreateTeam: true,
      },
    },
  });

describe("team switcher", () => {
  beforeEach(() => {
    states.clear();
    mocks.api.mockReset().mockImplementation((url: string) => {
      if (url === "/teams") return Promise.resolve({ data: teams });
      return Promise.resolve({ data: null });
    });
    mocks.fetchUser.mockReset().mockResolvedValue(undefined);
    mocks.setCurrentTeamId.mockReset();
    mocks.reconnect.mockReset();
    mocks.navigateTo.mockReset().mockResolvedValue(undefined);
    mocks.success.mockReset();
    mocks.error.mockReset();
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("navigateTo", mocks.navigateTo);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useApi", () => ({
      setCurrentTeamId: mocks.setCurrentTeamId,
    }));
    vi.stubGlobal("useAuth", () => ({ user, fetchUser: mocks.fetchUser }));
    vi.stubGlobal("useWebSocket", () => ({ reconnect: mocks.reconnect }));
    vi.stubGlobal("useState", (key: string, factory: () => number) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows distinct identity labels for teams with the same name", async () => {
    const wrapper = mountSwitcher();
    await flushPromises();
    expect(wrapper.text()).toContain("Personal · rsonal");
    expect(wrapper.text()).toContain("Joined · 123456");
  });

  it("switches team context and refreshes all team-scoped views", async () => {
    const wrapper = mountSwitcher();
    await flushPromises();
    await setupState(wrapper).switchTeam("01TEAM123456");
    expect(mocks.setCurrentTeamId).toHaveBeenCalledWith("01TEAM123456");
    expect(mocks.fetchUser).toHaveBeenCalled();
    expect(mocks.reconnect).toHaveBeenCalled();
    expect([...states.values()].map((state) => state.value)).toEqual([
      0, 1, 1, 1, 1,
    ]);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    expect(mocks.success).toHaveBeenCalledWith("Switched to Launch");
  });

  it("does not switch the already active team", async () => {
    const wrapper = mountSwitcher();
    await flushPromises();
    await setupState(wrapper).switchTeam("personal");
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it("handles team list and switch failures", async () => {
    mocks.api.mockRejectedValueOnce(new Error("load"));
    const wrapper = mountSwitcher();
    await flushPromises();
    expect(setupState(wrapper).teams).toEqual([]);
    expect(setupState(wrapper).loading).toBe(false);

    mocks.api.mockRejectedValueOnce(new Error("switch"));
    await setupState(wrapper).switchTeam("missing");
    expect(mocks.error).toHaveBeenCalledWith("Failed to switch team");
  });
});

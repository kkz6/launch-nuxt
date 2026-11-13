import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onMounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamSwitcher from "../../components/shared/TeamSwitcher.vue";
import { useCan } from "../../composables/useCan";
import type { TeamRole } from "~/types";

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

const user = ref({
  id: "user",
  current_team_id: "personal",
  role: "owner" as TeamRole | undefined,
});
const states = new Map<string, ReturnType<typeof ref<number | boolean>>>();
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
const teamState = ref<Array<(typeof teams)[number]>>([]);
const teamLoading = ref(true);

const translate = (key: string, params: Record<string, unknown> = {}) => {
  const messages: Record<string, string> = {
    "common.teams.personal": "Personal",
    "common.teams.owned": "Owned",
    "common.teams.joined": "Joined",
    "common.teams.new": "New team",
    "common.teams.loadFailed": "Failed to load teams",
    "common.teams.switchFailed": "Failed to switch team",
    "common.teams.defaultName": "team",
    "common.teams.switched": `Switched to ${String(params.team ?? "")}`,
  };
  return messages[key] ?? key;
};

const loadTeams = vi.fn(async () => {
  try {
    const response = await mocks.api("/teams");
    teamState.value = response.data;
    return teamState.value;
  } finally {
    teamLoading.value = false;
  }
});

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
    user.value = { id: "user", current_team_id: "personal", role: "owner" };
    teamState.value = [];
    teamLoading.value = true;
    loadTeams.mockClear();
    mocks.api.mockReset().mockImplementation((url: string) => {
      if (url === "/teams") return Promise.resolve({ data: teams });
      return Promise.resolve({ data: null });
    });
    mocks.fetchUser.mockReset().mockImplementation(async () => {
      user.value = {
        id: "user",
        current_team_id: "01TEAM123456",
        role: "member",
      };
      return user.value;
    });
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
    vi.stubGlobal("useApi", () => ({
      setCurrentTeamId: mocks.setCurrentTeamId,
    }));
    vi.stubGlobal("useAuth", () => ({ user, fetchUser: mocks.fetchUser }));
    vi.stubGlobal("useImpersonation", () => ({ isImpersonating: ref(false) }));
    vi.stubGlobal("useI18n", () => ({ t: translate }));
    vi.stubGlobal("useWebSocket", () => ({ reconnect: mocks.reconnect }));
    vi.stubGlobal("useTeams", () => ({
      teams: teamState,
      loading: teamLoading,
      loadTeams,
    }));
    vi.stubGlobal("useActiveTeamRefresh", () => ({
      refreshActiveTeam: () => {
        mocks.reconnect();
        for (const key of [
          "serversRefreshKey",
          "dashboardRefreshKey",
          "scriptsRefreshKey",
          "dnsRefreshKey",
        ]) {
          const state = states.get(key) || ref(0);
          states.set(key, state);
          state.value = Number(state.value ?? 0) + 1;
        }
      },
    }));
    vi.stubGlobal(
      "useState",
      (key: string, factory: () => number | boolean) => {
        if (!states.has(key)) states.set(key, ref(factory()));
        return states.get(key);
      },
    );
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
    expect(
      [...states.values()]
        .filter((state) => typeof state.value === "number")
        .map((state) => state.value),
    ).toEqual([1, 1, 1, 1]);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    expect(mocks.success).toHaveBeenCalledWith("Switched to Launch");
  });

  it("clears the old role before changing team context and waits for the new role", async () => {
    let finishFetch!: () => void;
    mocks.fetchUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFetch = () => {
            user.value = {
              id: "user",
              current_team_id: "01TEAM123456",
              role: "member",
            };
            resolve(user.value);
          };
        }),
    );
    const access = useCan();
    const wrapper = mountSwitcher();
    await flushPromises();
    expect(access.canEdit.value).toBe(true);
    mocks.setCurrentTeamId.mockImplementation(() => {
      expect(access.canEdit.value).toBe(false);
      expect(user.value.role).toBeUndefined();
    });

    const switching = setupState(wrapper).switchTeam("01TEAM123456");
    await flushPromises();
    expect(access.canEdit.value).toBe(false);
    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    await setupState(wrapper).switchTeam("another-team");
    expect(
      mocks.api.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);

    finishFetch();
    await switching;
    expect(user.value.role).toBe("member");
    expect(access.canEdit.value).toBe(false);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    wrapper.unmount();
  });

  it.each(["reject", "empty"])(
    "does not restore the old rights when fetching the selected team fails: %s",
    async (failure) => {
      const wrapper = mountSwitcher();
      await flushPromises();
      if (failure === "reject")
        mocks.fetchUser.mockRejectedValueOnce(new Error("profile failed"));
      else mocks.fetchUser.mockResolvedValueOnce(null);
      const access = useCan();
      await setupState(wrapper).switchTeam("01TEAM123456");
      expect(access.canEdit.value).toBe(false);
      expect(user.value.role).toBeUndefined();
      expect(mocks.setCurrentTeamId).toHaveBeenCalledWith("01TEAM123456");
      expect(mocks.success).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalledWith("Failed to switch team");
      wrapper.unmount();
    },
  );

  it("retains the original role if the switch itself is rejected", async () => {
    const wrapper = mountSwitcher();
    await flushPromises();
    mocks.api.mockRejectedValueOnce(new Error("not a team member"));
    const access = useCan();
    await setupState(wrapper).switchTeam("01TEAM123456");
    expect(access.canEdit.value).toBe(true);
    expect(user.value.role).toBe("owner");
    expect(mocks.setCurrentTeamId).not.toHaveBeenCalled();
    expect(mocks.fetchUser).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("ignores concurrent clicks until the team switch finishes", async () => {
    let finishSwitch!: () => void;
    const wrapper = mountSwitcher();
    await flushPromises();
    mocks.api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSwitch = () => resolve({ data: null });
        }),
    );
    const switching = setupState(wrapper).switchTeam("01TEAM123456");
    await setupState(wrapper).switchTeam("another-team");
    expect(
      mocks.api.mock.calls.filter(([, options]) => options?.method === "POST"),
    ).toHaveLength(1);
    finishSwitch();
    await switching;
    expect(mocks.fetchUser).toHaveBeenCalledOnce();
    wrapper.unmount();
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

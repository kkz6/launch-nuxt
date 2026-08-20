import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onMounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeamsTab from "../../components/settings/TeamsTab.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  fetchUser: vi.fn(),
  setCurrentTeamId: vi.fn(),
  closeSettings: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  reconnect: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const user = ref({ id: "owner", current_team_id: "source" });
const teamsRefreshKey = ref(0);
const teamsState = ref([] as Array<typeof source>);
const source = {
  id: "source",
  user_id: "owner",
  name: "Source",
  personal_team: false,
  is_owner: true,
};
const destination = {
  id: "destination",
  user_id: "owner",
  name: "Personal",
  personal_team: true,
  is_owner: true,
};
const member = {
  id: "member",
  name: "Team Member",
  email: "member@example.com",
  role: "member",
};
const owner = {
  id: "owner",
  name: "Team Owner",
  email: "owner@example.com",
  role: "owner",
};
const invitation = {
  id: "invite",
  email: "pending@example.com",
  role: "editor",
  created_at: "",
};

interface TeamsTabState {
  assignableRoles: Array<{ value: string }>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  deleteTeam: () => Promise<void>;
  invitations: (typeof invitation)[];
  isDeleting: boolean;
  isLoading: boolean;
  isRenaming: boolean;
  renameTeam: () => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
  resendingId: string | null;
  transferToTeamId: string;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
}

const setupState = (wrapper: ReturnType<typeof mountTab>) =>
  (wrapper.vm.$ as unknown as { setupState: TeamsTabState }).setupState;

const setSetupRef = (
  wrapper: ReturnType<typeof mountTab>,
  key: string,
  value: unknown,
) => {
  (
    wrapper.vm.$ as unknown as {
      devtoolsRawSetupState: Record<string, { value: unknown }>;
    }
  ).devtoolsRawSetupState[key].value = value;
};

const mountTab = () =>
  shallowMount(TeamsTab, {
    global: {
      stubs: {
        Icon: true,
        SettingsInviteMember: true,
        Avatar: { template: "<div><slot /></div>" },
        AvatarFallback: { template: "<div><slot /></div>" },
        AvatarImage: true,
        Badge: { template: "<span><slot /></span>" },
        Button: { template: "<button><slot /></button>" },
        Input: true,
        Label: { template: "<label><slot /></label>" },
        Select: { template: "<div><slot /></div>" },
        SelectContent: { template: "<div><slot /></div>" },
        SelectItem: { template: "<div><slot /></div>" },
        SelectTrigger: { template: "<div><slot /></div>" },
        SelectValue: true,
        AlertDialog: { template: "<div><slot /></div>" },
        AlertDialogAction: { template: "<button><slot /></button>" },
        AlertDialogCancel: { template: "<button><slot /></button>" },
        AlertDialogContent: { template: "<div><slot /></div>" },
        AlertDialogDescription: { template: "<p><slot /></p>" },
        AlertDialogFooter: { template: "<div><slot /></div>" },
        AlertDialogHeader: { template: "<div><slot /></div>" },
        AlertDialogTitle: { template: "<h2><slot /></h2>" },
      },
    },
  });

describe("team settings", () => {
  beforeEach(() => {
    source.name = "Source";
    teamsRefreshKey.value = 0;
    teamsState.value = [source, destination];
    mocks.api
      .mockReset()
      .mockImplementation(
        (
          url: string,
          options?: { method?: string; body?: { name?: string } },
        ) => {
          if (
            url === "/teams/source" &&
            options?.method === "PUT" &&
            options.body
          ) {
            return Promise.resolve({
              data: { ...source, name: options.body.name },
            });
          }
          if (url === "/teams/source" && options?.method === "DELETE") {
            return Promise.resolve({ data: destination });
          }
          if (url === "/teams/source") return Promise.resolve({ data: source });
          if (url === "/teams/source/members")
            return Promise.resolve({ data: [owner, member] });
          if (url === "/teams/source/invitations") {
            return Promise.resolve({ data: [invitation] });
          }
          if (url === "/teams")
            return Promise.resolve({ data: [source, destination] });
          return Promise.resolve({ data: null });
        },
      );
    mocks.fetchUser.mockReset().mockResolvedValue(undefined);
    mocks.setCurrentTeamId.mockReset();
    mocks.closeSettings.mockReset();
    mocks.navigateTo.mockReset().mockResolvedValue(undefined);
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.reconnect.mockReset();
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("useAuth", () => ({ user, fetchUser: mocks.fetchUser }));
    vi.stubGlobal("useI18n", createI18nStub);
    vi.stubGlobal("useApi", () => ({
      setCurrentTeamId: mocks.setCurrentTeamId,
    }));
    vi.stubGlobal("useSettingsSheet", () => ({ close: mocks.closeSettings }));
    vi.stubGlobal("useCan", () => ({ canManageTeam: ref(true) }));
    vi.stubGlobal("useTeams", () => ({
      teams: teamsState,
      loadTeams: vi.fn().mockResolvedValue(teamsState.value),
      updateTeam: (team: typeof source) => {
        const index = teamsState.value.findIndex((item) => item.id === team.id);
        if (index === -1) teamsState.value.push(team);
        else teamsState.value[index] = team;
      },
      removeTeam: (teamId: string) => {
        teamsState.value = teamsState.value.filter(
          (team) => team.id !== teamId,
        );
      },
    }));
    vi.stubGlobal("useActiveTeamRefresh", () => ({
      refreshActiveTeam: () => {
        mocks.reconnect();
        teamsRefreshKey.value++;
      },
    }));
    vi.stubGlobal("useState", () => teamsRefreshKey);
    vi.stubGlobal("navigateTo", mocks.navigateTo);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads owner controls, members, invitations, and transfer destinations", async () => {
    const wrapper = mountTab();
    await flushPromises();
    expect(wrapper.text()).toContain("Team details");
    expect(wrapper.text()).toContain("Team Member");
    expect(wrapper.text()).toContain("pending@example.com");
    expect(wrapper.text()).toContain("Personal (Personal)");
    expect(setupState(wrapper).transferToTeamId).toBe("destination");
    expect(
      setupState(wrapper).assignableRoles.map((role) => role.value),
    ).toEqual(["admin", "editor", "member"]);
  });

  it("renames the current team and refreshes the user", async () => {
    const wrapper = mountTab();
    await flushPromises();
    setSetupRef(wrapper, "teamName", "  Renamed  ");
    await setupState(wrapper).renameTeam();
    expect(mocks.api).toHaveBeenCalledWith("/teams/source", {
      method: "PUT",
      body: { name: "Renamed" },
    });
    expect(mocks.fetchUser).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Team name updated");
    expect(teamsState.value.find((team) => team.id === "source")?.name).toBe(
      "Renamed",
    );
  });

  it("transfers resources before deleting and switches team context", async () => {
    const wrapper = mountTab();
    await flushPromises();
    await setupState(wrapper).deleteTeam();
    expect(mocks.api).toHaveBeenCalledWith("/teams/source", {
      method: "DELETE",
      body: { transfer_to_team_id: "destination" },
    });
    expect(mocks.setCurrentTeamId).toHaveBeenCalledWith("destination");
    expect(mocks.fetchUser).toHaveBeenCalled();
    expect(mocks.closeSettings).toHaveBeenCalled();
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    expect(teamsRefreshKey.value).toBe(1);
  });

  it("manages invitations and member roles", async () => {
    const wrapper = mountTab();
    await flushPromises();
    await setupState(wrapper).resendInvitation("invite");
    await setupState(wrapper).updateMemberRole("member", "editor");
    await setupState(wrapper).cancelInvitation("invite");
    expect(mocks.success).toHaveBeenCalledWith("Invitation resent");
    expect(mocks.success).toHaveBeenCalledWith("Role updated");
    expect(mocks.success).toHaveBeenCalledWith("Invitation cancelled");
    expect(setupState(wrapper).invitations).toEqual([]);
  });

  it("surfaces API messages and resets loading states", async () => {
    const wrapper = mountTab();
    await flushPromises();
    setSetupRef(wrapper, "teamName", "Renamed");
    mocks.api.mockRejectedValueOnce({ data: { message: "Rename failed" } });
    await setupState(wrapper).renameTeam();
    expect(mocks.error).toHaveBeenCalledWith("Rename failed");
    expect(setupState(wrapper).isRenaming).toBe(false);

    mocks.api.mockRejectedValueOnce(new Error("delete"));
    await setupState(wrapper).deleteTeam();
    expect(mocks.error).toHaveBeenCalledWith("Failed to delete team");
    expect(setupState(wrapper).isDeleting).toBe(false);
  });

  it("handles team settings and member-management failures", async () => {
    mocks.api.mockRejectedValueOnce(new Error("load"));
    const wrapper = mountTab();
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith("Failed to load team settings");
    expect(setupState(wrapper).isLoading).toBe(false);

    setSetupRef(wrapper, "currentTeam", source);
    mocks.api.mockRejectedValueOnce(new Error("resend"));
    await setupState(wrapper).resendInvitation("invite");
    expect(mocks.error).toHaveBeenCalledWith("Failed to resend invitation");
    expect(setupState(wrapper).resendingId).toBeNull();

    mocks.api.mockRejectedValueOnce(new Error("cancel"));
    await setupState(wrapper).cancelInvitation("invite");
    expect(mocks.error).toHaveBeenCalledWith("Failed to cancel invitation");

    mocks.api.mockRejectedValueOnce(new Error("role"));
    await setupState(wrapper).updateMemberRole("member", "editor");
    expect(mocks.error).toHaveBeenCalledWith("Failed to update role");
  });
});

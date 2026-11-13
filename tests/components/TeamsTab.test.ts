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

const user = ref<{ id: string; current_team_id: string | null; role?: string }>(
  {
    id: "owner",
    current_team_id: "source",
    role: "owner",
  },
);
const impersonating = ref(false);
const canManageTeam = ref(true);
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
        AlertDialog: {
          props: ["open"],
          template: '<div v-if="open" role="alertdialog"><slot /></div>',
        },
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
    user.value = { id: "owner", current_team_id: "source", role: "owner" };
    impersonating.value = false;
    canManageTeam.value = true;
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
    vi.stubGlobal("useCan", () => ({ canManageTeam }));
    vi.stubGlobal("useImpersonation", () => ({
      isImpersonating: impersonating,
    }));
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

  it("keeps a member on failure and removes them after a confirmed retry", async () => {
    const wrapper = mountTab();
    await flushPromises();
    expect(wrapper.findAll('button[aria-label^="Remove"]')).toHaveLength(1);
    await wrapper
      .get('button[aria-label="Remove Team Member?"]')
      .trigger("click");
    expect(mocks.api).not.toHaveBeenCalledWith("/teams/source/members/member", {
      method: "DELETE",
    });
    const confirm = () =>
      wrapper
        .get('[role="alertdialog"]')
        .findAll("button")
        .at(-1)!
        .trigger("click");
    mocks.api.mockRejectedValueOnce(new Error("removal failed"));
    await confirm();
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith("Failed to remove member");
    expect(wrapper.text()).toContain("Team Member");
    await confirm();
    await flushPromises();
    expect(mocks.api).toHaveBeenCalledWith("/teams/source/members/member", {
      method: "DELETE",
    });
    expect(wrapper.text()).not.toContain("Team Member");
    expect(mocks.success).toHaveBeenCalledWith("Member removed");
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("leaves the current team and refreshes the fallback context", async () => {
    user.value = { id: "member", current_team_id: "source", role: "member" };
    canManageTeam.value = false;
    mocks.fetchUser.mockImplementationOnce(async () => {
      expect(user.value.role).toBeUndefined();
      user.value.current_team_id = "destination";
      return user.value;
    });
    const wrapper = mountTab();
    await flushPromises();
    expect(wrapper.findAll('button[aria-label^="Remove"]')).toHaveLength(0);
    const leave = wrapper
      .findAll("button")
      .find((button) => button.text() === "Leave team")!;
    await leave.trigger("click");
    const confirm = () =>
      wrapper
        .get('[role="alertdialog"]')
        .findAll("button")
        .at(-1)!
        .trigger("click");
    mocks.api.mockRejectedValueOnce(new Error("leave failed"));
    await confirm();
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith("Failed to leave team");
    expect(user.value.current_team_id).toBe("source");
    await confirm();
    await flushPromises();
    expect(mocks.api).toHaveBeenCalledWith("/teams/source/members/member", {
      method: "DELETE",
    });
    expect(teamsState.value).toEqual([destination]);
    expect(mocks.setCurrentTeamId).toHaveBeenCalledWith(null);
    expect(user.value.current_team_id).toBe("destination");
    expect(mocks.closeSettings).toHaveBeenCalled();
    expect(teamsRefreshKey.value).toBe(1);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    expect(mocks.success).toHaveBeenCalledWith("You left the team");
  });

  it("hides membership changes in a read-only session", async () => {
    user.value = { id: "member", current_team_id: "source", role: "member" };
    impersonating.value = true;
    canManageTeam.value = false;
    const wrapper = mountTab();
    await flushPromises();
    expect(wrapper.findAll('button[aria-label^="Remove"]')).toHaveLength(0);
    expect(wrapper.text()).not.toContain("Leave team");
  });

  it("reports a failed resend and keeps the invitation available for retry", async () => {
    const wrapper = mountTab();
    await flushPromises();
    const resend = wrapper
      .findAll("button")
      .find((button) => button.text() === "Resend")!;
    mocks.api.mockRejectedValueOnce({
      data: { code: "team.invitation_email_failed" },
    });
    await resend.trigger("click");
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining("email could not be sent"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain(invitation.email);
    await resend.trigger("click");
    await flushPromises();
    expect(mocks.success).toHaveBeenCalledWith("Invitation resent");
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

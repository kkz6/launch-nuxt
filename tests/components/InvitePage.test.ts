import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onMounted, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InvitePage from "../../pages/invite/[token].vue";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  setTokens: vi.fn(),
  setUser: vi.fn(),
  navigateTo: vi.fn(),
  pageMeta: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

interface InvitePageState {
  errors: Record<string, string>;
  handleSubmit: () => Promise<void>;
  invitationLoading: boolean;
  loading: boolean;
}

const setupState = (wrapper: ReturnType<typeof mountPage>) =>
  (wrapper.vm.$ as unknown as { setupState: InvitePageState }).setupState;

const setSetupRef = (
  wrapper: ReturnType<typeof mountPage>,
  key: string,
  value: unknown,
) => {
  (
    wrapper.vm.$ as unknown as {
      devtoolsRawSetupState: Record<string, { value: unknown }>;
    }
  ).devtoolsRawSetupState[key].value = value;
};

const mountPage = () =>
  shallowMount(InvitePage, {
    global: {
      stubs: {
        Icon: true,
        NuxtLink: true,
        Button: { template: "<button><slot /></button>" },
        Input: true,
        Label: { template: "<label><slot /></label>" },
      },
    },
  });

describe("team invitation page", () => {
  beforeEach(() => {
    mocks.api.mockReset().mockImplementation((url: string) => {
      if (url === "/auth/invitations/invite") {
        return Promise.resolve({
          data: {
            email: "member@example.com",
            team_id: "01TEAM123456",
            team_name: "Shared",
            user_exists: true,
          },
        });
      }
      return Promise.resolve({
        data: {
          access_token: "access",
          refresh_token: "refresh",
          user: { id: "member", current_team_id: "01TEAM123456" },
        },
      });
    });
    mocks.setTokens.mockReset();
    mocks.setUser.mockReset();
    mocks.navigateTo.mockReset();
    mocks.pageMeta.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("definePageMeta", mocks.pageMeta);
    vi.stubGlobal("navigateTo", mocks.navigateTo);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("useApi", () => ({ setTokens: mocks.setTokens }));
    vi.stubGlobal("useAuth", () => ({ setUser: mocks.setUser }));
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("useRoute", () => ({ params: { token: "invite" } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows an authenticated invitee to reach the page and identifies the exact team", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(mocks.pageMeta).toHaveBeenCalledWith({ layout: "guest" });
    expect(wrapper.text()).toContain("Team code: 123456");
    expect(wrapper.text()).toContain("Shared");
  });

  it("accepts an existing user's invitation and switches authentication state", async () => {
    const wrapper = mountPage();
    await flushPromises();
    setSetupRef(wrapper, "password", "correct-password");
    await setupState(wrapper).handleSubmit();
    expect(mocks.api).toHaveBeenCalledWith("/auth/invitations/accept", {
      method: "POST",
      body: {
        invitation_token: "invite",
        password: "correct-password",
      },
    });
    expect(mocks.setTokens).toHaveBeenCalledWith("access", "refresh");
    expect(mocks.setUser).toHaveBeenCalled();
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
  });

  it("creates an account for a new invitee", async () => {
    mocks.api.mockImplementation((url: string) => {
      if (url === "/auth/invitations/invite") {
        return Promise.resolve({
          data: {
            email: "new@example.com",
            team_id: "01TEAM123456",
            team_name: "Shared",
            user_exists: false,
          },
        });
      }
      return Promise.resolve({
        data: {
          access_token: "access",
          refresh_token: "refresh",
          user: { id: "new", current_team_id: "01TEAM123456" },
        },
      });
    });
    const wrapper = mountPage();
    await flushPromises();
    setSetupRef(wrapper, "name", "New Member");
    setSetupRef(wrapper, "password", "correct-password");
    setSetupRef(wrapper, "passwordConfirmation", "correct-password");
    await setupState(wrapper).handleSubmit();
    expect(mocks.api).toHaveBeenCalledWith("/auth/invitations/accept", {
      method: "POST",
      body: {
        invitation_token: "invite",
        name: "New Member",
        password: "correct-password",
        password_confirmation: "correct-password",
      },
    });
    expect(mocks.success).toHaveBeenCalledWith("Account created successfully");
  });

  it("redirects invalid or expired invitations", async () => {
    mocks.api.mockRejectedValueOnce(new Error("expired"));
    const wrapper = mountPage();
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith("Invalid or expired invitation");
    expect(mocks.navigateTo).toHaveBeenCalledWith("/login");
    expect(setupState(wrapper).invitationLoading).toBe(false);
  });

  it("shows field validation errors from invitation acceptance", async () => {
    const wrapper = mountPage();
    await flushPromises();
    setSetupRef(wrapper, "userExists", false);
    mocks.api.mockRejectedValueOnce({
      data: {
        errors: {
          password: ["Password is incorrect"],
          name: "Name is required",
          password_confirmation: ["Passwords must match"],
        },
      },
    });
    await setupState(wrapper).handleSubmit();
    await flushPromises();
    expect(setupState(wrapper).errors).toEqual({
      password: "Password is incorrect",
      name: "Name is required",
      password_confirmation: "Passwords must match",
    });
    expect(wrapper.text()).toContain("Name is required");
    expect(wrapper.text()).toContain("Passwords must match");
    expect(setupState(wrapper).loading).toBe(false);
  });

  it("shows API and generic invitation acceptance errors", async () => {
    const wrapper = mountPage();
    await flushPromises();
    mocks.api.mockRejectedValueOnce({ data: { message: "Invite rejected" } });
    await setupState(wrapper).handleSubmit();
    expect(setupState(wrapper).errors).toEqual({ password: "Invite rejected" });

    mocks.api.mockRejectedValueOnce(new Error("network"));
    await setupState(wrapper).handleSubmit();
    expect(setupState(wrapper).errors).toEqual({
      password: "An error occurred. Please try again.",
    });
  });
});

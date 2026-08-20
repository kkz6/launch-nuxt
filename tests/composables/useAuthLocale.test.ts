import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../composables/useAuth";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  getUser: vi.fn(),
  getAccessToken: vi.fn(),
  applySavedUserLocale: vi.fn(),
  setTokens: vi.fn(),
  setCurrentTeamId: vi.fn(),
}));

vi.mock("~/services/authService", () => ({
  authService: {
    login: mocks.login,
    getUser: mocks.getUser,
  },
}));

describe("useAuth locale synchronization", () => {
  beforeEach(() => {
    const states = new Map<string, ReturnType<typeof ref>>();
    mocks.login.mockReset();
    mocks.getUser.mockReset();
    mocks.getAccessToken.mockReset().mockReturnValue(null);
    mocks.applySavedUserLocale.mockReset();
    mocks.setTokens.mockReset();
    mocks.setCurrentTeamId.mockReset();

    vi.stubGlobal("computed", computed);
    vi.stubGlobal("navigateTo", vi.fn());
    vi.stubGlobal("useApi", () => ({
      setTokens: mocks.setTokens,
      clearTokens: vi.fn(),
      getAccessToken: mocks.getAccessToken,
      setCurrentTeamId: mocks.setCurrentTeamId,
    }));
    vi.stubGlobal("useLocalePreference", () => ({
      applySavedUserLocale: mocks.applySavedUserLocale,
    }));
    vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not resolve login until the returned user's locale is applied", async () => {
    const user = {
      id: "user-id",
      name: "Japanese User",
      email: "user@example.com",
      current_team_id: "team-id",
      locale: "ja",
      onboarded: true,
    };
    mocks.login.mockResolvedValue({
      data: {
        two_factor_required: false,
        access_token: "access-token",
        refresh_token: "refresh-token",
        user,
      },
    });

    let finishLocaleSync!: () => void;
    mocks.applySavedUserLocale.mockReturnValue(
      new Promise<void>((resolve) => {
        finishLocaleSync = resolve;
      }),
    );

    let loginResolved = false;
    const login = useAuth()
      .login({ email: user.email, password: "password" })
      .then((result) => {
        loginResolved = true;
        return result;
      });

    await vi.waitFor(() => {
      expect(mocks.applySavedUserLocale).toHaveBeenCalledWith("ja");
    });
    expect(loginResolved).toBe(false);
    expect(mocks.setTokens).toHaveBeenCalledWith(
      "access-token",
      "refresh-token",
    );

    finishLocaleSync();
    await login;
    expect(loginResolved).toBe(true);
  });

  it("preserves the SSR-effective locale while initializing an automatic user", async () => {
    mocks.getAccessToken.mockReturnValue("access-token");
    mocks.getUser.mockResolvedValue({
      data: {
        id: "user-id",
        name: "Automatic User",
        email: "user@example.com",
        current_team_id: "team-id",
        locale: null,
        onboarded: true,
      },
    });
    mocks.applySavedUserLocale.mockResolvedValue("en");

    await useAuth().initAuth();

    expect(mocks.applySavedUserLocale).toHaveBeenCalledWith(null, {
      preferEffectiveCookie: true,
    });
  });
});

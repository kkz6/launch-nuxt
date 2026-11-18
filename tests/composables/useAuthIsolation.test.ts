import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../composables/useAuth";
import type { User } from "../../types";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), updateProfile: vi.fn(), updateLocale: vi.fn(),
  login: vi.fn(), logout: vi.fn(), clearTokens: vi.fn(),
  setTokens: vi.fn(), applyLocale: vi.fn(), navigate: vi.fn(),
}));
vi.mock("~/services/authService", () => ({ authService: mocks }));
const account = (id: string): User => ({
  id: id === "A" ? 1 : 2, name: id, email: `${id}@example.test`, current_team_id: id === "A" ? 101 : 202,
  locale: "en" as const, onboarded: true,
  email_verified_at: null, profile_photo_path: null, created_at: "", updated_at: null,
  two_factor_confirmed_at: null, profile_photo_url: "", timezone: "UTC",
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let session: string;
let team: string | null;
let accessToken: string;

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  session = "session-A";
  team = "101";
  accessToken = "access-A";
  const states = new Map<string, ReturnType<typeof ref>>();
  states.set("auth_user", ref(account("A")));
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("navigateTo", mocks.navigate);
  vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(factory()));
    return states.get(key);
  });
  vi.stubGlobal("useApi", () => ({
    getAccessToken: () => accessToken,
    getRefreshToken: () => session,
    getCurrentTeamId: () => team,
    setCurrentTeamId: (value: string | number | null) => { team = value === null ? null : String(value); },
    clearTokens: mocks.clearTokens,
    setTokens: mocks.setTokens,
  }));
  vi.stubGlobal("useLocalePreference", () => ({ applySavedUserLocale: mocks.applyLocale }));
});
afterEach(() => vi.unstubAllGlobals());

describe("authentication response account isolation", () => {
  it.each(["success", "failure"])("ignores an old account's late profile fetch: %s", async (result) => {
    const pending = deferred<{ data: ReturnType<typeof account> }>();
    mocks.getUser.mockReturnValue(pending.promise);
    const auth = useAuth();
    const fetching = auth.fetchUser();
    session = "session-B";
    await auth.setUser(account("B"));
    if (result === "success") pending.resolve({ data: account("A") });
    else pending.reject(new Error("expired A"));
    expect(await fetching).toBeNull();
    expect(auth.user.value?.id).toBe(2);
    expect(team).toBe("202");
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });

  it.each(["updateProfile", "updateLocale"] as const)("cannot restore A from a late %s response", async (method) => {
    const pending = deferred<{ data: ReturnType<typeof account> }>();
    mocks[method].mockReturnValue(pending.promise);
    const auth = useAuth();
    const updating = method === "updateProfile" ? auth.updateProfile({ name: "Changed" }) : auth.updateLocale("ja");
    const rejected = expect(updating).rejects.toMatchObject({ name: "AbortError" });
    session = "session-B";
    await auth.setUser(account("B"));
    pending.resolve({ data: account("A") });
    await rejected;
    expect(auth.user.value?.id).toBe(2);
    expect(team).toBe("202");
  });

  it("does not clear B's session when A's logout finishes", async () => {
    const pending = deferred<undefined>();
    mocks.logout.mockReturnValue(pending.promise);
    const auth = useAuth();
    const loggingOut = auth.logout();
    session = "session-B";
    await auth.setUser(account("B"));
    pending.resolve(undefined);
    await loggingOut;
    expect(auth.user.value?.id).toBe(2);
    expect(mocks.clearTokens).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("does not replace a newer login with a delayed login response", async () => {
    const pending = deferred<{ data: { user: ReturnType<typeof account>; access_token: string; refresh_token: string } }>();
    mocks.login.mockReturnValue(pending.promise);
    const auth = useAuth();
    const loggingIn = auth.login({ email: "A@example.test", password: "password" });
    const rejected = expect(loggingIn).rejects.toMatchObject({ name: "AbortError" });
    session = "session-B";
    await auth.setUser(account("B"));
    pending.resolve({ data: { user: account("A"), access_token: "new-A", refresh_token: "new-session-A" } });
    await rejected;
    expect(auth.user.value?.id).toBe(2);
    expect(mocks.setTokens).not.toHaveBeenCalled();
  });

  it("does not restore an old team from an earlier profile request", async () => {
    const pending = deferred<{ data: ReturnType<typeof account> }>();
    mocks.getUser.mockReturnValue(pending.promise);
    const auth = useAuth();
    const fetching = auth.fetchUser();
    team = "new-team";
    pending.resolve({ data: account("A") });
    expect(await fetching).toBeNull();
    expect(team).toBe("new-team");
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });

  it("accepts a profile response after an access-token refresh in the same session", async () => {
    mocks.getUser.mockImplementation(async () => {
      accessToken = "refreshed-A";
      return { data: { ...account("A"), name: "Current profile" } };
    });
    const auth = useAuth();
    await auth.fetchUser();
    expect(auth.user.value?.name).toBe("Current profile");
  });
});

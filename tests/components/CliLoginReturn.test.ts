import { flushPromises, shallowMount } from "@vue/test-utils";
import { onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../../pages/login.vue";
import TwoFactorPage from "../../pages/two-factor-challenge.vue";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  challenge: vi.fn(),
  navigateTo: vi.fn(),
  setTokens: vi.fn(),
  setUser: vi.fn(),
  post: vi.fn(),
  credential: vi.fn(),
}));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/services/authService", () => ({
  authService: { twoFactor: { challenge: mocks.challenge } },
}));

let redirect: unknown;
let accessToken: string | null;
let refreshToken: string | null;
const user = ref<{ id?: number; onboarded: boolean } | null>(null);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const assertion = () => ({
  id: "credential-A", type: "public-key", rawId: new ArrayBuffer(1),
  response: {
    clientDataJSON: new ArrayBuffer(1), authenticatorData: new ArrayBuffer(1),
    signature: new ArrayBuffer(1), userHandle: null,
  },
});

const stubs = {
  Icon: true,
  NuxtLink: true,
  ClientOnly: { template: "<div><slot /></div>" },
  AnimatePresence: { template: "<div><slot /></div>" },
  Motion: { template: "<div><slot /></div>" },
  Button: { template: "<button><slot /></button>" },
  Input: true,
  Label: true,
  Checkbox: true,
  Separator: true,
  PinInput: true,
  PinInputGroup: true,
  PinInputSeparator: true,
  PinInputSlot: true,
};

describe("returning to CLI approval after sign-in", () => {
  beforeEach(() => {
    redirect = "/cli/auth";
    accessToken = null;
    refreshToken = null;
    user.value = null;
    sessionStorage.clear();
    mocks.login.mockReset().mockResolvedValue({ user: { onboarded: true } });
    mocks.challenge.mockReset().mockResolvedValue({
      data: {
        access_token: "access",
        refresh_token: "refresh",
        user: { onboarded: true },
      },
    });
    mocks.navigateTo.mockReset();
    mocks.setTokens.mockReset().mockImplementation((access: string, refresh: string) => {
      accessToken = access;
      refreshToken = refresh;
    });
    mocks.setUser.mockReset().mockImplementation(async (value) => { user.value = value; });
    mocks.post.mockReset().mockResolvedValueOnce({ publicKey: { challenge: "YQ" } }).mockResolvedValue({
      user: { id: 1, onboarded: true }, access_token: "access-A", refresh_token: "refresh-A",
    });
    mocks.credential.mockReset().mockResolvedValue(assertion());
    vi.stubGlobal("navigator", { credentials: { get: mocks.credential } });
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
    vi.stubGlobal("useRoute", () => ({ query: { redirect } }));
    vi.stubGlobal("navigateTo", mocks.navigateTo);
    vi.stubGlobal("useApi", () => ({
      setTokens: mocks.setTokens,
      post: mocks.post,
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
    }));
    vi.stubGlobal("useAuth", () => ({
      login: mocks.login,
      checkUserStatus: vi.fn(),
      isLoading: ref(false),
      isInitialized: ref(false),
      setUser: mocks.setUser,
      user,
    }));
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("returns from password sign-in without approving the CLI automatically", async () => {
    const wrapper = shallowMount(LoginPage, { global: { stubs } });
    const state = (
      wrapper.vm.$ as unknown as {
        setupState: { handlePasswordSubmit: () => Promise<void> };
      }
    ).setupState;
    await state.handlePasswordSubmit();
    expect(mocks.navigateTo).toHaveBeenCalledWith("/cli/auth");
  });

  it("preserves the destination when login requires two-factor authentication", async () => {
    mocks.login.mockResolvedValueOnce({
      two_factor_required: true,
      challenge_token: "challenge",
    });
    const wrapper = shallowMount(LoginPage, { global: { stubs } });
    const state = (
      wrapper.vm.$ as unknown as {
        setupState: { handlePasswordSubmit: () => Promise<void> };
      }
    ).setupState;
    await state.handlePasswordSubmit();
    expect(sessionStorage.getItem("2fa_challenge_token")).toBe("challenge");
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      path: "/two-factor-challenge",
      query: { redirect: "/cli/auth" },
    });
  });

  it("returns after two-factor verification and waits for account setup", async () => {
    sessionStorage.setItem("2fa_challenge_token", "challenge");
    let finishAccountSetup!: () => void;
    mocks.setUser.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishAccountSetup = resolve;
      }),
    );
    const wrapper = shallowMount(TwoFactorPage, { global: { stubs } });
    const state = (
      wrapper.vm.$ as unknown as {
        setupState: { handleSubmit: (code: string) => Promise<void> };
      }
    ).setupState;
    const submission = state.handleSubmit("123456");
    await flushPromises();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    finishAccountSetup();
    await submission;
    expect(mocks.challenge).toHaveBeenCalledWith({
      challenge_token: "challenge",
      code: "123456",
    });
    expect(mocks.navigateTo).toHaveBeenCalledWith("/cli/auth");
    expect(sessionStorage.getItem("2fa_challenge_token")).toBeNull();
  });

  it("preserves the destination if the two-factor challenge has expired", async () => {
    shallowMount(TwoFactorPage, { global: { stubs } });
    await flushPromises();
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/cli/auth" },
    });
  });

  it.each([undefined, "https://other.example"])(
    "keeps the normal login destination for %j",
    async (value) => {
      redirect = value;
      const wrapper = shallowMount(LoginPage, { global: { stubs } });
      const state = (
        wrapper.vm.$ as unknown as {
          setupState: { handlePasswordSubmit: () => Promise<void> };
        }
      ).setupState;
      await state.handlePasswordSubmit();
      expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    },
  );

  it("completes passkey login within its originating session", async () => {
    const wrapper = shallowMount(LoginPage, { global: { stubs } });
    const state = (wrapper.vm.$ as unknown as { setupState: { handlePasskeyLogin: () => Promise<void> } }).setupState;
    await state.handlePasskeyLogin();
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(user.value?.id).toBe(1);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/cli/auth");
  });

  it.each(["account switch", "unmount"])("does not resume an old biometric prompt after %s", async (change) => {
    const pending = deferred<ReturnType<typeof assertion>>();
    mocks.credential.mockReturnValue(pending.promise);
    const wrapper = shallowMount(LoginPage, { global: { stubs } });
    const state = (wrapper.vm.$ as unknown as { setupState: { handlePasskeyLogin: () => Promise<void> } }).setupState;
    const login = state.handlePasskeyLogin();
    await flushPromises();
    expect(mocks.credential).toHaveBeenCalledOnce();
    if (change === "unmount") wrapper.unmount();
    else {
      accessToken = "access-B";
      refreshToken = "refresh-B";
      user.value = { id: 2, onboarded: true };
    }
    pending.resolve(assertion());
    await login;
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.setTokens).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    if (change === "account switch") expect(user.value?.id).toBe(2);
  });

  it("does not publish passkey credentials after another account signs in during verification", async () => {
    const pending = deferred<unknown>();
    mocks.post.mockReset().mockResolvedValueOnce({ publicKey: { challenge: "YQ" } }).mockReturnValueOnce(pending.promise);
    const wrapper = shallowMount(LoginPage, { global: { stubs } });
    const state = (wrapper.vm.$ as unknown as { setupState: { handlePasskeyLogin: () => Promise<void> } }).setupState;
    const login = state.handlePasskeyLogin();
    await flushPromises();
    accessToken = "access-B";
    refreshToken = "refresh-B";
    user.value = { id: 2, onboarded: true };
    pending.resolve({ user: { id: 1, onboarded: true }, access_token: "access-A", refresh_token: "refresh-A" });
    await login;
    expect(mocks.setTokens).not.toHaveBeenCalled();
    expect(user.value?.id).toBe(2);
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it.each(["account switch", "replaced challenge", "unmount"])("does not submit an old two-factor challenge after %s", async (change) => {
    sessionStorage.setItem("2fa_challenge_token", "challenge-A");
    const wrapper = shallowMount(TwoFactorPage, { global: { stubs } });
    const state = (wrapper.vm.$ as unknown as { setupState: { handleSubmit: (code: string) => Promise<void> } }).setupState;
    if (change === "unmount") wrapper.unmount();
    else if (change === "replaced challenge") sessionStorage.setItem("2fa_challenge_token", "challenge-B");
    else {
      accessToken = "access-B";
      refreshToken = "refresh-B";
      user.value = { id: 2, onboarded: true };
    }
    await state.handleSubmit("123456");
    expect(mocks.challenge).not.toHaveBeenCalled();
    expect(mocks.setTokens).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("does not publish a delayed two-factor response into another account", async () => {
    sessionStorage.setItem("2fa_challenge_token", "challenge-A");
    const pending = deferred<unknown>();
    mocks.challenge.mockReturnValue(pending.promise);
    const wrapper = shallowMount(TwoFactorPage, { global: { stubs } });
    const state = (wrapper.vm.$ as unknown as { setupState: { handleSubmit: (code: string) => Promise<void> } }).setupState;
    const verifying = state.handleSubmit("123456");
    accessToken = "access-B";
    refreshToken = "refresh-B";
    user.value = { id: 2, onboarded: true };
    pending.resolve({ data: { user: { id: 1, onboarded: true }, access_token: "access-A", refresh_token: "refresh-A" } });
    await verifying;
    expect(mocks.setTokens).not.toHaveBeenCalled();
    expect(user.value?.id).toBe(2);
    expect(sessionStorage.getItem("2fa_challenge_token")).toBe("challenge-A");
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });
});

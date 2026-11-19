import { flushPromises, shallowMount } from "@vue/test-utils";
import { onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../../pages/login.vue";

const mocks = vi.hoisted(() => ({
  supported: vi.fn(),
  credential: vi.fn(),
  post: vi.fn(),
  login: vi.fn(),
  checkUserStatus: vi.fn(),
  setTokens: vi.fn(),
  setUser: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("motion-v", () => ({
  AnimatePresence: { name: "AnimatePresence", template: "<div><slot /></div>" },
  Motion: { name: "Motion", template: "<div><slot /></div>" },
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const assertion = () => ({
  id: "credential-A",
  type: "public-key",
  rawId: new ArrayBuffer(1),
  response: {
    clientDataJSON: new ArrayBuffer(1),
    authenticatorData: new ArrayBuffer(1),
    signature: new ArrayBuffer(1),
    userHandle: new ArrayBuffer(1),
  },
});

const authResponse = () => ({
  user: { id: 1, onboarded: true },
  access_token: "access-A",
  refresh_token: "refresh-A",
});

const user = ref<{ id: number; onboarded: boolean } | null>(null);
const isInitialized = ref(false);
let accessToken: string | null;
let refreshToken: string | null;

const mountPage = () =>
  shallowMount(LoginPage, {
    global: {
      stubs: {
        Icon: true,
        NuxtLink: true,
        ClientOnly: { template: "<div><slot /></div>" },
        AnimatePresence: { template: "<div><slot /></div>" },
        Motion: { template: "<div><slot /></div>" },
        Button: { template: "<button><slot /></button>" },
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Label: true,
        Checkbox: true,
        Separator: true,
      },
    },
  });

type Page = ReturnType<typeof mountPage>;
const pages: Page[] = [];
const mount = () => {
  const page = mountPage();
  pages.push(page);
  return page;
};
const state = (page: Page) =>
  (page.vm.$ as unknown as {
    setupState: {
      email: string;
      password: string;
      passkeyLoading: boolean;
      showPasswordField: boolean;
      handleEmailSubmit: () => Promise<void>;
      handlePasswordSubmit: () => Promise<void>;
      handlePasskeyLogin: () => Promise<void>;
      handleChangeEmail: () => void;
    };
  }).setupState;

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  accessToken = null;
  refreshToken = null;
  user.value = null;
  isInitialized.value = false;
  mocks.supported.mockResolvedValue(true);
  mocks.credential.mockImplementation(() => new Promise(() => {}));
  mocks.post.mockImplementation(async (url: string) => {
    if (url.endsWith("/options")) return { publicKey: { challenge: "YQ" } };
    return authResponse();
  });
  mocks.checkUserStatus.mockResolvedValue({ user_exists: true, has_passkeys: true });
  mocks.login.mockResolvedValue({ user: { onboarded: true } });
  mocks.setTokens.mockImplementation((access: string, refresh: string) => {
    accessToken = access;
    refreshToken = refresh;
  });
  mocks.setUser.mockImplementation(async (value) => { user.value = value; });
  vi.stubGlobal("PublicKeyCredential", { isConditionalMediationAvailable: mocks.supported });
  vi.stubGlobal("navigator", { credentials: { get: mocks.credential } });
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useHead", vi.fn());
  vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
  vi.stubGlobal("useRoute", () => ({ query: {} }));
  vi.stubGlobal("navigateTo", mocks.navigateTo);
  vi.stubGlobal("useApi", () => ({
    post: mocks.post,
    setTokens: mocks.setTokens,
    getAccessToken: () => accessToken,
    getRefreshToken: () => refreshToken,
  }));
  vi.stubGlobal("useAuth", () => ({
    login: mocks.login,
    checkUserStatus: mocks.checkUserStatus,
    user,
    isInitialized,
    isLoading: ref(false),
    setUser: mocks.setUser,
  }));
});

afterEach(() => {
  pages.splice(0).forEach((page) => page.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("passkey autofill", () => {
  it("offers discoverable passkeys without submitting the typed email or blocking the form", async () => {
    const page = mount();
    state(page).email = "typed@example.test";
    await flushPromises();

    expect(page.get("#email").attributes("autocomplete")).toBe("username webauthn");
    expect(mocks.post).toHaveBeenCalledWith("/auth/passkey/login/options", {}, expect.any(Object));
    expect(mocks.credential).toHaveBeenCalledWith(expect.objectContaining({
      mediation: "conditional",
      signal: expect.any(AbortSignal),
      publicKey: expect.objectContaining({ challenge: expect.any(ArrayBuffer) }),
    }));
    expect(state(page).passkeyLoading).toBe(false);
    expect(page.get('button[type="submit"]').attributes("disabled")).toBeUndefined();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("verifies a selected autofill passkey and completes sign-in", async () => {
    const credential = deferred<ReturnType<typeof assertion>>();
    const verification = deferred<ReturnType<typeof authResponse>>();
    mocks.credential.mockReturnValue(credential.promise);
    mocks.post.mockImplementation(async (url: string) => {
      if (url.endsWith("/options")) return { publicKey: { challenge: "YQ" } };
      return verification.promise;
    });
    const page = mount();
    await flushPromises();
    credential.resolve(assertion());
    await flushPromises();
    expect(state(page).passkeyLoading).toBe(true);
    expect(mocks.post).toHaveBeenLastCalledWith(
      "/auth/passkey/login/verify",
      expect.objectContaining({ id: "credential-A", response: expect.objectContaining({ userHandle: "AA" }) }),
      expect.any(Object),
    );
    verification.resolve(authResponse());
    await flushPromises();
    expect(mocks.setTokens).toHaveBeenCalledWith("access-A", "refresh-A");
    expect(user.value?.id).toBe(1);
    expect(isInitialized.value).toBe(true);
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(state(page).passkeyLoading).toBe(false);
  });

  it.each([undefined, {}, { isConditionalMediationAvailable: () => Promise.resolve(false) }])(
    "keeps password and explicit passkey sign-in available without conditional support: %j",
    async (capability) => {
      vi.stubGlobal("PublicKeyCredential", capability);
      const page = mount();
      await flushPromises();
      expect(mocks.post).not.toHaveBeenCalled();
      expect(mocks.error).not.toHaveBeenCalled();
      mocks.credential.mockResolvedValue(assertion());
      await state(page).handlePasskeyLogin();
      expect(mocks.credential).toHaveBeenCalledOnce();
      expect(mocks.credential.mock.calls[0][0].mediation).not.toBe("conditional");
      expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
    },
  );

  it("does not show an error when capability detection fails", async () => {
    mocks.supported.mockRejectedValue(new Error("unavailable"));
    const page = mount();
    await flushPromises();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(state(page).passkeyLoading).toBe(false);
  });

  it.each(["NotAllowedError", "AbortError"])("silently handles a background %s", async (name) => {
    mocks.credential.mockRejectedValue(new DOMException("dismissed", name));
    const page = mount();
    await flushPromises();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(state(page).passkeyLoading).toBe(false);
    expect(mocks.setTokens).not.toHaveBeenCalled();
  });

  it("cancels autofill before explicit sign-in and ignores its late completion", async () => {
    const background = deferred<ReturnType<typeof assertion>>();
    const explicit = deferred<ReturnType<typeof assertion>>();
    mocks.credential.mockReturnValueOnce(background.promise).mockReturnValueOnce(explicit.promise);
    const page = mount();
    await flushPromises();
    const backgroundSignal = mocks.credential.mock.calls[0][0].signal as AbortSignal;
    state(page).email = "member@example.test";
    const signingIn = state(page).handlePasskeyLogin();
    await flushPromises();
    expect(backgroundSignal.aborted).toBe(true);
    expect(mocks.post).toHaveBeenLastCalledWith(
      "/auth/passkey/login/options", { email: "member@example.test" }, expect.any(Object),
    );
    expect(mocks.credential.mock.calls[1][0].mediation).not.toBe("conditional");
    background.resolve(assertion());
    await flushPromises();
    expect(state(page).passkeyLoading).toBe(true);
    expect(mocks.setTokens).not.toHaveBeenCalled();
    explicit.resolve(assertion());
    await signingIn;
    expect(mocks.post.mock.calls.filter(([url]) => url.endsWith("/verify"))).toHaveLength(1);
    expect(mocks.navigateTo).toHaveBeenCalledOnce();
  });

  it.each(["email", "password", "unmount"])("cancels pending autofill on %s and ignores a late result", async (action) => {
    const pending = deferred<ReturnType<typeof assertion>>();
    mocks.credential.mockReturnValue(pending.promise);
    const page = mount();
    await flushPromises();
    const signal = mocks.credential.mock.calls[0][0].signal as AbortSignal;
    if (action === "unmount") page.unmount();
    else if (action === "email") {
      state(page).email = "member@example.test";
      await state(page).handleEmailSubmit();
    } else await state(page).handlePasswordSubmit();
    expect(signal.aborted).toBe(true);
    pending.resolve(assertion());
    await flushPromises();
    expect(mocks.post.mock.calls.filter(([url]) => url.endsWith("/verify"))).toHaveLength(0);
    expect(mocks.setTokens).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("starts a fresh autofill request when returning to the email step", async () => {
    const page = mount();
    await flushPromises();
    state(page).email = "member@example.test";
    await state(page).handleEmailSubmit();
    expect(state(page).showPasswordField).toBe(true);
    state(page).handleChangeEmail();
    await flushPromises();
    expect(mocks.credential).toHaveBeenCalledTimes(2);
    expect(mocks.credential.mock.calls[1][0].mediation).toBe("conditional");
    expect(mocks.post).toHaveBeenLastCalledWith("/auth/passkey/login/options", {}, expect.any(Object));
  });

  it("does not start delayed autofill detection over an explicit prompt", async () => {
    const supported = deferred<boolean>();
    mocks.supported.mockReturnValue(supported.promise);
    const page = mount();
    void state(page).handlePasskeyLogin();
    await flushPromises();
    supported.resolve(true);
    await flushPromises();
    expect(mocks.credential).toHaveBeenCalledOnce();
    expect(mocks.credential.mock.calls[0][0].mediation).not.toBe("conditional");
  });

  it("renews an idle challenge before expiry and stops renewing after leaving", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const page = mount();
    await flushPromises();
    const firstSignal = mocks.credential.mock.calls[0][0].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    await flushPromises();
    expect(firstSignal.aborted).toBe(true);
    expect(mocks.credential).toHaveBeenCalledTimes(2);
    expect(mocks.credential.mock.calls[1][0].mediation).toBe("conditional");
    expect(state(page).passkeyLoading).toBe(false);
    page.unmount();
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    expect(mocks.credential).toHaveBeenCalledTimes(2);
  });

  it("does not renew or cancel a selected passkey while verification is pending", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const verification = deferred<ReturnType<typeof authResponse>>();
    mocks.credential.mockResolvedValue(assertion());
    mocks.post.mockImplementation(async (url: string) => {
      if (url.endsWith("/options")) return { publicKey: { challenge: "YQ" } };
      return verification.promise;
    });
    const page = mount();
    await flushPromises();
    const signal = mocks.credential.mock.calls[0][0].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    expect(mocks.credential).toHaveBeenCalledOnce();
    expect(signal.aborted).toBe(false);
    expect(state(page).passkeyLoading).toBe(true);
    verification.resolve(authResponse());
    await flushPromises();
    expect(mocks.navigateTo).toHaveBeenCalledWith("/dashboard");
  });

  it("does not publish autofill verification into a newer account", async () => {
    const verification = deferred<ReturnType<typeof authResponse>>();
    mocks.credential.mockResolvedValue(assertion());
    mocks.post.mockImplementation(async (url: string) => {
      if (url.endsWith("/options")) return { publicKey: { challenge: "YQ" } };
      return verification.promise;
    });
    mount();
    await flushPromises();
    accessToken = "access-B";
    refreshToken = "refresh-B";
    user.value = { id: 2, onboarded: true };
    verification.resolve(authResponse());
    await flushPromises();
    expect(mocks.setTokens).not.toHaveBeenCalled();
    expect(user.value.id).toBe(2);
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });
});

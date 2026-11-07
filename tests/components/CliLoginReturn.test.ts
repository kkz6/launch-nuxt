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
}));

vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("~/services/authService", () => ({
  authService: { twoFactor: { challenge: mocks.challenge } },
}));

let redirect: unknown;

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
    mocks.setTokens.mockReset();
    mocks.setUser.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
    vi.stubGlobal("useRoute", () => ({ query: { redirect } }));
    vi.stubGlobal("navigateTo", mocks.navigateTo);
    vi.stubGlobal("useApi", () => ({ setTokens: mocks.setTokens }));
    vi.stubGlobal("useAuth", () => ({
      login: mocks.login,
      checkUserStatus: vi.fn(),
      isLoading: ref(false),
      isInitialized: ref(false),
      setUser: mocks.setUser,
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
});

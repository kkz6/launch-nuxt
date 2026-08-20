import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "../../components/layout/Navbar.vue";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("vue-sonner", () => ({ toast: toastMocks }));
vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));

const activeUser = ref({
  id: "user",
  name: "Team Owner",
  email: "owner@example.com",
  current_team_id: "team",
  current_team: { is_subscribed: true },
  onboarded: true,
  locale: null,
});
const localePreference = ref<"auto" | "en" | "ja">("auto");
const updateLocale = vi.fn();
const setLocalePreference = vi.fn(async (preference: "auto" | "en" | "ja") => {
  localePreference.value = preference;
  return preference === "auto" ? "en" : preference;
});
const translations: Record<string, string> = {
  "common.language": "Language",
  "common.languageAutomatic": "Automatic",
  "common.english": "English",
  "common.japanese": "日本語",
  "common.localeUpdated": "Language preference updated",
  "common.localeUpdateFailed": "Could not update your language preference",
  "common.subscriptionInactive": "Your subscription is inactive",
  "common.subscribeNow": "Subscribe now",
  "common.settings": "Settings",
  "common.adminPanel": "Admin Panel",
  "common.backToApp": "Back to App",
  "common.theme": "Theme",
  "common.signOut": "Sign Out",
  "common.navigation.dashboard": "Dashboard",
  "common.navigation.servers": "Servers",
  "common.navigation.domains": "Domains",
  "common.navigation.scripts": "Scripts",
};
const translate = vi.fn((key: string) => translations[key] ?? key);

const mountNavbar = () =>
  shallowMount(Navbar, {
    global: {
      stubs: {
        Avatar: { template: "<div><slot /></div>" },
        AvatarFallback: { template: "<div><slot /></div>" },
        AvatarImage: true,
        Button: { template: "<button><slot /></button>" },
        ClientOnly: { template: "<div><slot /></div>" },
        DropdownMenu: { template: "<div><slot /></div>" },
        DropdownMenuContent: { template: "<div><slot /></div>" },
        DropdownMenuItem: { template: "<div><slot /></div>" },
        DropdownMenuRadioGroup: {
          name: "DropdownMenuRadioGroup",
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: '<div data-test="locale-radio-group"><slot /></div>',
        },
        DropdownMenuRadioItem: {
          props: ["value"],
          template: '<div :data-value="value"><slot /></div>',
        },
        DropdownMenuSeparator: true,
        DropdownMenuSub: { template: "<div><slot /></div>" },
        DropdownMenuSubContent: { template: "<div><slot /></div>" },
        DropdownMenuSubTrigger: { template: "<div><slot /></div>" },
        DropdownMenuTrigger: { template: "<div><slot /></div>" },
        Icon: true,
        LayoutActiveActions: true,
        LayoutTabStrip: true,
        NuxtLink: true,
        ServerCreateServerDialog: true,
        DnsAddDomain: true,
        ScriptsCreateScript: true,
        ServerAddSite: true,
        ServerDockerCreateProject: true,
        SharedLogsSheet: true,
        SharedTeamSwitcher: { template: '<div data-test="team-switcher" />' },
        SiteDeployApplication: true,
        SettingsSheet: true,
        ServerProvisionCommandDialog: true,
      },
    },
  });

describe("Navbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const states = new Map<string, ReturnType<typeof ref>>();
    activeUser.value = {
      id: "user",
      name: "Team Owner",
      email: "owner@example.com",
      current_team_id: "team",
      current_team: { is_subscribed: true },
      onboarded: true,
      locale: null,
    };
    localePreference.value = "auto";
    updateLocale.mockReset().mockResolvedValue(activeUser.value);
    setLocalePreference.mockClear();
    translate.mockClear();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    vi.stubGlobal("$api", vi.fn().mockResolvedValue({ data: {} }));
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("nextTick", nextTick);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useAuth", () => ({
      user: activeUser,
      logout: vi.fn(),
      updateLocale,
    }));
    vi.stubGlobal("useCan", () => ({
      canEdit: ref(true),
      canDelete: ref(true),
    }));
    vi.stubGlobal("useColorMode", () => ({ preference: "system" }));
    vi.stubGlobal("useI18n", () => ({ t: translate }));
    vi.stubGlobal("useLocalePreference", () => ({
      localePreference,
      setLocalePreference,
    }));
    vi.stubGlobal("useNavbarCache", () => ({
      getCachedServer: vi.fn(),
      getCachedSite: vi.fn(),
    }));
    vi.stubGlobal("usePageBreadcrumbState", () => ref(null));
    vi.stubGlobal("useRoute", () => ({ path: "/dashboard", query: {} }));
    vi.stubGlobal("useRouter", () => ({ push: vi.fn() }));
    vi.stubGlobal("useSettingsSheet", () => ({ open: vi.fn() }));
    vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the shared team switcher", async () => {
    const wrapper = mountNavbar();
    await flushPromises();
    await vi.runAllTimersAsync();
    expect(wrapper.find('[data-test="team-switcher"]').exists()).toBe(true);
  });

  it("renders Automatic, English, and Japanese locale choices", async () => {
    const wrapper = mountNavbar();
    await flushPromises();

    expect(wrapper.find('[data-value="auto"]').text()).toBe("Automatic");
    expect(wrapper.find('[data-value="en"]').text()).toBe("English");
    expect(wrapper.find('[data-value="ja"]').text()).toBe("日本語");
    expect(
      wrapper
        .getComponent({ name: "DropdownMenuRadioGroup" })
        .props("modelValue"),
    ).toBe("auto");
  });

  it("updates both the local preference and authenticated user locale", async () => {
    const wrapper = mountNavbar();
    wrapper
      .getComponent({ name: "DropdownMenuRadioGroup" })
      .vm.$emit("update:modelValue", "ja");
    await flushPromises();

    expect(setLocalePreference).toHaveBeenCalledWith("ja");
    expect(updateLocale).toHaveBeenCalledWith("ja");
    expect(toastMocks.success).toHaveBeenCalledWith(
      "Language preference updated",
    );
  });

  it("serializes locale updates so the latest selection wins", async () => {
    let resolveJapanese!: (value: typeof activeUser.value) => void;
    const japaneseUpdate = new Promise<typeof activeUser.value>((resolve) => {
      resolveJapanese = resolve;
    });
    updateLocale
      .mockImplementationOnce(() => japaneseUpdate)
      .mockResolvedValueOnce(activeUser.value);

    const wrapper = mountNavbar();
    const group = wrapper.getComponent({ name: "DropdownMenuRadioGroup" });
    group.vm.$emit("update:modelValue", "ja");
    group.vm.$emit("update:modelValue", "en");
    await flushPromises();

    expect(updateLocale).toHaveBeenCalledTimes(1);
    expect(updateLocale).toHaveBeenNthCalledWith(1, "ja");

    resolveJapanese(activeUser.value);
    await flushPromises();

    expect(updateLocale).toHaveBeenNthCalledWith(2, "en");
    expect(localePreference.value).toBe("en");
    expect(toastMocks.success).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale failed update roll back a newer selection", async () => {
    let rejectJapanese!: (reason?: unknown) => void;
    const japaneseUpdate = new Promise<typeof activeUser.value>(
      (_resolve, reject) => {
        rejectJapanese = reject;
      },
    );
    updateLocale
      .mockImplementationOnce(() => japaneseUpdate)
      .mockResolvedValueOnce(activeUser.value);

    const wrapper = mountNavbar();
    const group = wrapper.getComponent({ name: "DropdownMenuRadioGroup" });
    group.vm.$emit("update:modelValue", "ja");
    group.vm.$emit("update:modelValue", "en");
    await flushPromises();

    rejectJapanese(new Error("request failed"));
    await flushPromises();

    expect(updateLocale).toHaveBeenNthCalledWith(2, "en");
    expect(localePreference.value).toBe("en");
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("routes primary navigation labels through the common catalog", async () => {
    mountNavbar();
    await flushPromises();

    expect(translate).toHaveBeenCalledWith("common.navigation.dashboard");
    expect(translate).toHaveBeenCalledWith("common.navigation.servers");
    expect(translate).toHaveBeenCalledWith("common.navigation.domains");
    expect(translate).toHaveBeenCalledWith("common.navigation.scripts");
  });
});

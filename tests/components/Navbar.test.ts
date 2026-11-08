import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerTypeRules } from "../../composables/useServerTypeRules";
import Navbar from "../../components/layout/Navbar.vue";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("vue-sonner", () => ({ toast: toastMocks }));
vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));

const live = vi.hoisted(() => ({
  resource: undefined as undefined | (() => Promise<void>),
}));
vi.mock("~/composables/useNavbarLiveUpdates", () => ({
  useNavbarLiveUpdates: (
    _team: unknown,
    _context: unknown,
    resource: () => Promise<void>,
  ) => {
    live.resource = resource;
  },
}));
const currentRoute = reactive({
  path: "/dashboard",
  query: {} as Record<string, string | string[]>,
});
const cache = vi.fn();
const clearCache = vi.fn(() => cache.mockReturnValue(null));
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
  "admin.userDetail.searchServers": "Search servers",
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

const states = new Map<string, ReturnType<typeof ref>>();
const wrappers: VueWrapper[] = [];
const mountNavbar = () => {
  const wrapper = shallowMount(Navbar, {
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
        TooltipProvider: { template: "<div><slot /></div>" },
        Tooltip: { template: "<div><slot /></div>" },
        TooltipTrigger: { template: "<div><slot /></div>" },
        TooltipContent: {
          name: "TooltipContent",
          template: "<span><slot /></span>",
        },
        Icon: true,
        LayoutActiveActions: true,
        LayoutTabStrip: {
          name: "LayoutTabStrip",
          props: ["tabs", "activeKey"],
          template:
            '<nav><span v-for="tab in tabs" :key="tab.value">{{ tab.label }}</span></nav>',
        },
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
  wrappers.push(wrapper);
  return wrapper;
};

describe("Navbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentRoute.path = "/dashboard";
    currentRoute.query = {};
    cache.mockReset();
    clearCache.mockClear();
    states.clear();
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
    vi.stubGlobal("getServerTypeRules", getServerTypeRules);
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
      getCachedServer: cache,
      clearCache,
      getCachedSite: vi.fn(),
    }));
    vi.stubGlobal("usePageBreadcrumbState", () => ref(null));
    vi.stubGlobal("useRoute", () => currentRoute);
    vi.stubGlobal("useRouter", () => ({ push: vi.fn() }));
    vi.stubGlobal("useSettingsSheet", () => ({ open: vi.fn() }));
    vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(async () => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
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
  it("refreshes cached header metadata when a resource event arrives", async () => {
    currentRoute.path = "/servers/server-1";
    cache.mockReturnValue({
      name: "Old server",
      status: "running",
      type: "php",
      connected: true,
    });
    const api = vi.fn().mockResolvedValue({
      data: {
        name: "Renamed server",
        status: "running",
        type: "php",
        connected: true,
      },
    });
    vi.stubGlobal("$api", api);
    const wrapper = mountNavbar();
    await flushPromises();
    expect(wrapper.text()).toContain("Old server");
    await live.resource?.();
    await flushPromises();
    expect(clearCache).toHaveBeenCalledOnce();
    expect(api).toHaveBeenCalledWith("/servers/server-1");
    expect(wrapper.text()).toContain("Renamed server");
    wrapper.unmount();
  });

  it("does not let a slow previous route replace the current header", async () => {
    currentRoute.path = "/servers/server-1";
    let finishOld!: (value: unknown) => void;
    const old = new Promise((resolve) => {
      finishOld = resolve;
    });
    const api = vi.fn().mockImplementation((path: string) =>
      path === "/servers/server-1"
        ? old
        : Promise.resolve({
            data: {
              name: "Current server",
              status: "running",
              type: "php",
              connected: true,
            },
          }),
    );
    vi.stubGlobal("$api", api);
    const wrapper = mountNavbar();
    await nextTick();
    currentRoute.path = "/servers/server-2";
    await flushPromises();
    expect(wrapper.text()).toContain("Current server");
    finishOld({
      data: {
        name: "Previous server",
        status: "running",
        type: "php",
        connected: true,
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Current server");
    expect(wrapper.text()).not.toContain("Previous server");
    wrapper.unmount();
  });
  it.each(["/admin/servers", "/admin/servers/"])(
    "opens server search from an icon with a tooltip at the end of the admin tabs on %s",
    async (path) => {
      currentRoute.path = path;
      const wrapper = mountNavbar();
      const button = wrapper.get('button[aria-label="Search servers"]');
      expect(button.text()).toBe("");
      expect(button.attributes("title")).toBe("Search servers");
      expect(button.attributes("aria-haspopup")).toBe("dialog");
      expect(button.attributes("variant")).toBe("ghost");
      expect(button.attributes("size")).toBe("icon-sm");
      expect(wrapper.getComponent({ name: "TooltipContent" }).text()).toBe(
        "Search servers",
      );
      const navigation = wrapper.getComponent({ name: "AdminNavigation" });
      expect(navigation.classes()).toEqual(
        expect.arrayContaining(["min-w-0", "flex-1"]),
      );
      expect(navigation.element.parentElement?.contains(button.element)).toBe(
        true,
      );
      expect(navigation.element.parentElement?.classList.contains("flex")).toBe(
        true,
      );
      expect(states.get("adminServerSearchOpen")?.value).toBe(false);
      await button.trigger("click");
      expect(states.get("adminServerSearchOpen")?.value).toBe(true);
    },
  );

  it.each([
    "/admin",
    "/admin/servers/server-1",
    "/admin/users/customer",
    "/servers",
  ])("hides the admin server search action on %s", (path) => {
    currentRoute.path = path;
    const wrapper = mountNavbar();
    expect(wrapper.find('button[aria-label="Search servers"]').exists()).toBe(
      false,
    );
  });

  it("uses a second shared tab row for user sections with the user's name first", async () => {
    currentRoute.path = "/admin/users/customer";
    currentRoute.query = { tab: "servers" };
    vi.stubGlobal("usePageBreadcrumbState", () =>
      ref({
        path: currentRoute.path,
        crumbs: [
          { label: "Admin", to: "/admin/overview" },
          { label: "Users", to: "/admin" },
          { label: "Alex Morgan" },
        ],
      }),
    );
    const wrapper = mountNavbar();
    await flushPromises();
    const sections = wrapper.findComponent({ name: "LayoutTabStrip" });
    expect(sections.props("activeKey")).toBe("servers");
    expect(
      sections.props("tabs").map((tab: { value: string }) => tab.value),
    ).toEqual(["profile", "teams", "servers", "sites"]);
    expect(sections.props("tabs")[0].label).toBe("Alex Morgan");
    currentRoute.query = { tab: "subscriptions" };
    await nextTick();
    expect(sections.props("activeKey")).toBe("profile");
    expect(
      wrapper
        .findComponent({ name: "AdminNavigation" })
        .attributes("extendborder"),
    ).toBe("true");
    currentRoute.query = { tab: ["sites", "servers"] };
    await nextTick();
    expect(sections.props("activeKey")).toBe("profile");
  });
});

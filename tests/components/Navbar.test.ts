import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "../../components/layout/Navbar.vue";

vi.mock("~/composables/useChannelEvents", () => ({
  useDeploymentEvents: vi.fn(),
}));

describe("navbar team switcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const states = new Map<string, ReturnType<typeof ref>>();
    vi.stubGlobal("$api", vi.fn().mockResolvedValue({ data: {} }));
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("nextTick", nextTick);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useAuth", () => ({
      user: ref({
        id: "user",
        name: "Team Owner",
        email: "owner@example.com",
        current_team_id: "team",
        current_team: { is_subscribed: true },
        onboarded: true,
      }),
      logout: vi.fn(),
    }));
    vi.stubGlobal("useCan", () => ({
      canEdit: ref(true),
      canDelete: ref(true),
    }));
    vi.stubGlobal("useColorMode", () => ({ preference: "system" }));
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
          DropdownMenuSeparator: true,
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
    await flushPromises();
    await vi.runAllTimersAsync();
    expect(wrapper.find('[data-test="team-switcher"]').exists()).toBe(true);
  });
});

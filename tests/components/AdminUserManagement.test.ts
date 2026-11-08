import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent, reactive, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUserPage from "../../pages/admin/users/[id].vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  liveUpdates: vi.fn(),
  showUser: vi.fn(),
  showServer: vi.fn(),
  deleteServer: vi.fn(),
  userSites: vi.fn(),
  userServers: vi.fn(),
  userSubscriptions: vi.fn(),
  updateStaffRole: vi.fn(),
  deleteSite: vi.fn(),
  deleteUser: vi.fn(),
  suspendUser: vi.fn(),
  unsuspendUser: vi.fn(),
  confirm: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  start: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: mocks.liveUpdates,
}));
vi.mock("~/services/adminService", () => ({ adminService: mocks }));
vi.mock("~/composables/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("~/composables/useImpersonation", () => ({
  useImpersonation: () => ({ start: mocks.start }),
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const currentUser = ref({ id: "admin-1", staff_role: "super_admin" });
const route = reactive({
  params: { id: "user-1" },
  query: {} as Record<string, unknown>,
});
const customer = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  name: "Anila",
  email: "anila@example.com",
  status: "active",
  staff_role: null,
  teams: [],
  ...overrides,
});
const site = (overrides: Record<string, unknown> = {}) => ({
  id: "site-1",
  address: "app.example.com",
  server_id: "server-1",
  server_name: "Production",
  type: "laravel",
  tls_setting: "auto",
  ...overrides,
});
const slots = { template: "<div><slot /></div>" };
enableAutoUnmount(afterEach);
const mountPage = (stubs = {}) =>
  mount(AdminUserPage, {
    attachTo: document.body,
    global: {
      stubs: {
        Icon: true,
        UserSitesTable: true,
        UserServersTable: true,
        UserStaffRoleControl: true,
        Input: true,
        Label: true,
        Badge: slots,
        Avatar: slots,
        AvatarFallback: slots,
        SharedDateTooltip: true,
        NuxtLink: { template: "<a><slot /></a>" },
        Button: { template: "<button><slot /></button>" },
        DropdownMenu: false,
        DropdownMenuTrigger: false,
        DropdownMenuContent: false,
        DropdownMenuItem: false,
        DropdownMenuSeparator: false,
        Teleport: slots,
        SharedConfirmationDialog: defineComponent({
          setup(_, { expose }) {
            expose({ show: mocks.confirm });
            return () => null;
          },
        }),
        ...stubs,
      },
    },
  });
type Page = ReturnType<typeof mountPage>;
const deleteUserButton = (page: Page) =>
  page
    .findAll('[role="menuitem"]')
    .find((item) => item.text() === "Delete user")!;
const openActions = async (page: Page) => {
  await page
    .get('button[aria-label="More actions"]')
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
};
const sitesTable = (page: Page) =>
  page.findComponent({ name: "UserSitesTable" });
const roleControl = (page: Page) =>
  page.findComponent({ name: "UserStaffRoleControl" });
const activateTab = async (tab: string) => {
  route.query = { tab };
  await flushPromises();
};
const requestDeleteSite = async (page: Page) => {
  sitesTable(page).vm.$emit("delete", site());
  await flushPromises();
};

describe("admin user management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUser.value = { id: "admin-1", staff_role: "super_admin" };
    route.query = {};
    mocks.useAuth.mockReturnValue({ user: currentUser });
    mocks.showUser.mockImplementation(async () => ({ data: customer() }));
    mocks.userSites.mockResolvedValue({ data: [site()] });
    mocks.userServers.mockResolvedValue({ data: [] });
    mocks.userSubscriptions.mockResolvedValue({ data: [] });
    mocks.updateStaffRole.mockResolvedValue({
      data: { id: "user-1", staff_role: null },
    });
    mocks.deleteSite.mockResolvedValue({
      data: { site_id: "site-1", status: "deletion_requested" },
    });
    mocks.deleteUser.mockResolvedValue({ success: true });
    mocks.confirm.mockResolvedValue({ ok: true });
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("setBreadcrumbs", vi.fn());
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useRoute", () => route);
    vi.stubGlobal("useI18n", () => ({ ...createI18nStub(), te: () => true }));
    vi.stubGlobal("navigateTo", mocks.navigateTo);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts with the profile and shows only the query-selected resource section", async () => {
    const page = mountPage();
    await flushPromises();
    expect(page.get("h1").text()).toBe("Anila");
    expect(page.text()).toContain("anila@example.com");
    expect(roleControl(page).exists()).toBe(true);
    expect(sitesTable(page).exists()).toBe(false);
    expect(page.find('[role="tablist"]').exists()).toBe(false);
    expect(mocks.userSites).not.toHaveBeenCalled();
    expect(mocks.userServers).not.toHaveBeenCalled();
    expect(mocks.userSubscriptions).toHaveBeenCalledOnce();
    expect(page.get("#user-subscriptions-title").text()).toBe("Subscriptions");

    await activateTab("sites");
    expect(page.get("h1").text()).toBe("Sites");
    expect(page.get("h1").classes()).toContain("sr-only");
    expect(page.find("header").exists()).toBe(false);
    expect(page.text()).not.toContain("Spectate");
    expect(page.find('button[aria-label="More actions"]').exists()).toBe(false);
    expect(sitesTable(page).exists()).toBe(true);
    expect(roleControl(page).exists()).toBe(false);
    expect(page.text()).not.toContain("anila@example.com");
    expect(page.find("#user-subscriptions-title").exists()).toBe(false);
    expect(mocks.userSites).toHaveBeenCalledOnce();
    await activateTab("profile");
    expect(roleControl(page).exists()).toBe(true);
    expect(sitesTable(page).exists()).toBe(false);
    await activateTab("sites");
    expect(mocks.userSites).toHaveBeenCalledOnce();
  });

  it.each([
    ["sites", "userSites", "Sites"],
    ["servers", "userServers", "Servers"],
  ] as const)(
    "loads a direct link to %s without showing profile controls",
    async (tab, method, heading) => {
      route.query = { tab };
      const page = mountPage();
      await flushPromises();
      expect(page.get("h1").text()).toBe(heading);
      expect(page.get("h1").classes()).toContain("sr-only");
      expect(page.find("header").exists()).toBe(false);
      expect(page.text()).not.toContain("Spectate");
      expect(page.find('button[aria-label="More actions"]').exists()).toBe(
        false,
      );
      expect(roleControl(page).exists()).toBe(false);
      expect(mocks[method]).toHaveBeenCalledWith("user-1");
      expect(mocks.userSubscriptions).not.toHaveBeenCalled();
    },
  );

  it.each(["unknown", "subscriptions", ["sites", "servers"]])(
    "falls back to the profile for an invalid tab %j",
    async (tab) => {
      route.query = { tab };
      const page = mountPage();
      await flushPromises();
      expect(page.get("h1").text()).toBe("Anila");
      expect(roleControl(page).exists()).toBe(true);
      expect(page.get("#user-subscriptions-title").text()).toBe(
        "Subscriptions",
      );
      expect(mocks.userSubscriptions).toHaveBeenCalledWith("user-1");
      expect(mocks.userSites).not.toHaveBeenCalled();
      expect(mocks.userServers).not.toHaveBeenCalled();
    },
  );

  it("keeps Spectate visible and opens account actions from the keyboard", async () => {
    const page = mountPage();
    await flushPromises();
    expect(page.findAll('[role="menuitem"]')).toHaveLength(0);
    const spectate = page
      .findAll("button")
      .find((button) => button.text() === "Spectate")!;
    expect(spectate.attributes("variant")).toBe("outline");
    await openActions(page);
    expect(
      page.findAll('[role="menuitem"]').map((item) => item.text()),
    ).toEqual(["Suspend", "Delete user"]);
    expect(deleteUserButton(page).classes()).toContain("text-destructive");
    await page.get('[role="menu"]').trigger("keydown", { key: "Escape" });
    await flushPromises();
    await spectate.trigger("click");
    await flushPromises();
    expect(mocks.start).toHaveBeenCalledWith("user-1", "Staff support session");
  });

  it("shows subscription billing details on the name tab and reconciles status and active counts", async () => {
    const subscription = {
      team_id: "team-1",
      team_name: "Production",
      status: "active",
      renews_at: "2026-12-01T00:00:00Z",
      card_last_four: "4242",
    };
    mocks.userSubscriptions.mockResolvedValue({ data: [subscription] });
    mocks.showUser.mockResolvedValueOnce({
      data: customer({
        teams: [{ id: "team-1", subscription: { status: "active" } }],
      }),
    });
    const page = mountPage();
    await flushPromises();
    const section = page.get(
      'section[aria-labelledby="user-subscriptions-title"]',
    );
    expect(section.text()).toContain("Production");
    expect(section.text()).toContain("Active");
    expect(section.text()).toContain("renews");
    expect(section.text()).toContain("4242");
    expect(section.get("shared-date-tooltip-stub").attributes("date")).toBe(
      subscription.renews_at,
    );
    const activeCount = () =>
      page
        .findAll("dl > div")
        .find((row) => row.get("dt").text() === "Active subs")!
        .get("dd")
        .text();
    expect(activeCount()).toBe("1");
    mocks.userSubscriptions.mockResolvedValueOnce({
      data: [{ ...subscription, status: "past_due" }],
    });
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(section.text()).toContain("Past due");
    expect(activeCount()).toBe("0");
  });

  it("shows a subscription load failure on the profile and retries without claiming an empty list", async () => {
    mocks.userSubscriptions.mockRejectedValueOnce(new Error("offline"));
    const page = mountPage();
    await flushPromises();
    const section = page.get(
      'section[aria-labelledby="user-subscriptions-title"]',
    );
    expect(section.get('[role="alert"]').text()).toContain(
      "Failed to load Subscriptions",
    );
    expect(section.text()).not.toContain("This user has no subscriptions.");
    await section.get("button").trigger("click");
    await flushPromises();
    expect(mocks.userSubscriptions).toHaveBeenCalledTimes(2);
    expect(section.find('[role="alert"]').exists()).toBe(false);
    expect(section.text()).toContain("This user has no subscriptions.");
  });

  it("retains subscription rows if a live refresh fails and allows retry", async () => {
    mocks.userSubscriptions.mockResolvedValue({
      data: [{ team_id: "team-1", team_name: "Production", status: "active" }],
    });
    const page = mountPage();
    await flushPromises();
    mocks.userSubscriptions.mockRejectedValueOnce(new Error("offline"));
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    const section = page.get(
      'section[aria-labelledby="user-subscriptions-title"]',
    );
    expect(section.text()).toContain("Production");
    expect(section.get('[role="alert"]').text()).toContain(
      "Failed to load Subscriptions",
    );
    await section.get("button").trigger("click");
    await flushPromises();
    expect(section.find('[role="alert"]').exists()).toBe(false);
    expect(section.text()).toContain("Production");
  });

  it.each([
    ["active", "Suspend", "suspendUser"],
    ["suspended", "Reactivate", "unsuspendUser"],
  ] as const)(
    "runs the appropriate account action for %s users",
    async (status, label, method) => {
      mocks.showUser.mockResolvedValueOnce({ data: customer({ status }) });
      const page = mountPage();
      await flushPromises();
      await openActions(page);
      const action = page
        .findAll('[role="menuitem"]')
        .find((item) => item.text() === label)!;
      expect(action.classes()).not.toContain("text-destructive");
      await action.trigger("click");
      await flushPromises();
      expect(mocks[method]).toHaveBeenCalledOnce();
      expect(mocks[method]).toHaveBeenCalledWith("user-1");
      expect(mocks.showUser).toHaveBeenCalledTimes(2);
    },
  );

  it("updates loaded resource tabs and counts after completed deletion without loading untouched tabs", async () => {
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    await requestDeleteSite(page);
    expect(sitesTable(page).props("pendingIds")).toEqual(["site-1"]);
    mocks.userSites.mockResolvedValueOnce({ data: [] });
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(sitesTable(page).props("sites")).toEqual([]);
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(mocks.userServers).not.toHaveBeenCalled();
    expect(mocks.userSubscriptions).toHaveBeenCalledTimes(2);
    expect(page.get("h1").text()).toBe("Sites");
    page.unmount();
  });

  it("reports a late server deletion failure after the detail drawer has closed", async () => {
    route.query = { tab: "servers" };
    const server = {
      id: "server-1",
      name: "Production",
      provider: "hetzner",
      status: "running",
      connected: true,
      sites_count: 0,
      projects_count: 0,
      owner: { team_name: "Customer team", user_id: "user-1" },
    };
    mocks.userServers.mockResolvedValue({ data: [server] });
    mocks.showServer.mockResolvedValue({ data: server });
    mocks.deleteServer.mockResolvedValue({
      data: { status: "deletion_requested" },
    });
    vi.stubGlobal("useAuth", mocks.useAuth);
    vi.stubGlobal("useStableMetadataLabels", () => ({
      getServerTypeLabel: (type: string) => type,
    }));
    const page = mountPage({ UserServersTable: false });
    await flushPromises();
    await page
      .get('button[aria-label="View server Production"]')
      .trigger("click");
    await flushPromises();
    const sheet = page.getComponent({ name: "ServerDetailsSheet" });
    expect(sheet.props("serverId")).toBe("server-1");
    await page
      .get('section[aria-labelledby="server-delete-heading"] button')
      .trigger("click");
    await flushPromises();
    expect(mocks.deleteServer).toHaveBeenCalledWith("server-1", "Production");
    expect(sheet.props("serverId")).toBeNull();
    expect(page.findComponent({ name: "ServerDetail" }).exists()).toBe(false);
    const [refresh, options] = mocks.liveUpdates.mock.calls.find(
      ([, options]) => options.userId === "user-1",
    )!;
    options.onChange({ resource: "site", action: "deletion_failed" });
    options.onChange({ resource: "server", action: "updated" });
    expect(mocks.error).not.toHaveBeenCalled();
    options.onChange({
      resource: "server",
      action: "deletion_failed",
      server_id: "server-1",
    });
    await refresh();
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.error).toHaveBeenCalledWith("Failed to delete server");
    expect(
      page.getComponent({ name: "UserServersTable" }).props("servers"),
    ).toEqual([server]);
    expect(route.query).toEqual({ tab: "servers" });
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("hides staff mutations for support and rejects site actions", async () => {
    currentUser.value.staff_role = "support";
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    expect(roleControl(page).exists()).toBe(false);
    expect(page.find('button[aria-label="More actions"]').exists()).toBe(false);
    expect(deleteUserButton(page)).toBeUndefined();
    expect(sitesTable(page).props("canDelete")).toBe(false);
    await requestDeleteSite(page);
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.deleteSite).not.toHaveBeenCalled();
  });

  it("prevents changing or deleting the current staff account", async () => {
    currentUser.value.id = "user-1";
    const page = mountPage();
    await flushPromises();
    expect(roleControl(page).props("isSelf")).toBe(true);
    expect(page.find('button[aria-label="More actions"]').exists()).toBe(false);
    expect(deleteUserButton(page)).toBeUndefined();
    roleControl(page).vm.$emit("save", null);
    await flushPromises();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.updateStaffRole).not.toHaveBeenCalled();
  });

  it("requires demotion before deleting staff, then refreshes eligibility after confirmed role change", async () => {
    mocks.showUser.mockResolvedValueOnce({
      data: customer({ staff_role: "support" }),
    });
    const page = mountPage();
    await flushPromises();
    await openActions(page);
    expect(deleteUserButton(page).attributes("aria-disabled")).toBe("true");
    expect(deleteUserButton(page).attributes("aria-describedby")).toBe(
      "staff-deletion-help",
    );
    await deleteUserButton(page).trigger("click");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(page.text()).toContain("Billing-history restrictions still apply");
    roleControl(page).vm.$emit("save", null);
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Change staff access?",
        description: expect.stringContaining("Regular user"),
        destructive: true,
      }),
    );
    expect(mocks.updateStaffRole).toHaveBeenCalledWith("user-1", null);
    expect(mocks.showUser).toHaveBeenCalledTimes(2);
    expect(deleteUserButton(page).attributes("aria-disabled")).toBeUndefined();
  });

  it("does not change staff access after cancellation", async () => {
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    const page = mountPage();
    await flushPromises();
    roleControl(page).vm.$emit("save", "support");
    await flushPromises();
    expect(mocks.updateStaffRole).not.toHaveBeenCalled();
    expect(mocks.showUser).toHaveBeenCalledTimes(1);
  });

  it("keeps the role and displays a backend refusal inline", async () => {
    mocks.showUser.mockResolvedValueOnce({
      data: customer({ staff_role: "super_admin" }),
    });
    mocks.updateStaffRole.mockRejectedValueOnce({
      data: { message: "The last super admin cannot be demoted." },
    });
    const page = mountPage();
    await flushPromises();
    roleControl(page).vm.$emit("save", null);
    await flushPromises();
    expect(roleControl(page).props("error")).toBe(
      "The last super admin cannot be demoted.",
    );
    expect(roleControl(page).props("role")).toBe("super_admin");
    await openActions(page);
    expect(deleteUserButton(page).attributes("aria-disabled")).toBe("true");
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("shows paid-history deletion refusals without navigating or claiming success", async () => {
    mocks.deleteUser.mockRejectedValueOnce({
      data: {
        message: "Users with paid subscription history cannot be deleted.",
      },
    });
    const page = mountPage();
    await flushPromises();
    await openActions(page);
    await deleteUserButton(page).trigger("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmText: "Delete user",
        destructive: true,
      }),
    );
    expect(page.get('[role="alert"]').text()).toContain(
      "paid subscription history",
    );
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("requires exact-domain confirmation and retains a queued site with duplicate deletion disabled", async () => {
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    await requestDeleteSite(page);
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        inputVerificationText: "app.example.com",
        description: expect.stringContaining("Production"),
        destructive: true,
      }),
    );
    expect(mocks.deleteSite).toHaveBeenCalledWith("site-1", "app.example.com");
    expect(sitesTable(page).props("sites")).toHaveLength(1);
    expect(sitesTable(page).props("pendingIds")).toEqual(["site-1"]);
    expect(mocks.success).toHaveBeenCalledWith("Deletion requested");
    await requestDeleteSite(page);
    expect(mocks.deleteSite).toHaveBeenCalledTimes(1);
  });

  it("leaves the site unchanged when confirmation is cancelled", async () => {
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    await requestDeleteSite(page);
    expect(mocks.deleteSite).not.toHaveBeenCalled();
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(sitesTable(page).props("sites")).toHaveLength(1);
  });

  it("retains a site and allows retry when the deletion request fails", async () => {
    mocks.deleteSite.mockRejectedValueOnce({
      data: { message: "Could not queue site deletion." },
    });
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    await requestDeleteSite(page);
    expect(sitesTable(page).props("errors")).toEqual({
      "site-1": "Could not queue site deletion.",
    });
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(sitesTable(page).props("sites")).toHaveLength(1);
    expect(mocks.success).not.toHaveBeenCalled();
    await requestDeleteSite(page);
    expect(mocks.deleteSite).toHaveBeenCalledTimes(2);
  });

  it("reconciles completed deletion and remote failure from live events", async () => {
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    await requestDeleteSite(page);
    mocks.userSites.mockResolvedValueOnce({
      data: [
        site({
          uninstallation_requested_at: "2026-11-08T00:00:00Z",
          uninstallation_failed_at: "2026-11-08T00:01:00Z",
        }),
      ],
    });
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(sitesTable(page).props("sites")).toHaveLength(1);
    await requestDeleteSite(page);
    expect(mocks.deleteSite).toHaveBeenCalledTimes(2);
    mocks.userSites.mockResolvedValueOnce({ data: [] });
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(sitesTable(page).props("sites")).toEqual([]);
  });

  it("keeps loaded sites after a failed live update and offers an error-only Retry action", async () => {
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    mocks.userSites.mockRejectedValueOnce(new Error("offline"));
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(sitesTable(page).props("sites")).toHaveLength(1);
    expect(page.get('[role="alert"]').text()).toContain("Failed to load");
    expect(page.get('[role="alert"] button').text()).toBe("Retry");
    mocks.userSites.mockResolvedValueOnce({ data: [] });
    await page.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(sitesTable(page).props("sites")).toEqual([]);
    expect(page.find('[role="alert"]').exists()).toBe(false);
  });

  it("blocks duplicate requests while a site request is in flight", async () => {
    let finish!: (value: unknown) => void;
    mocks.deleteSite.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const page = mountPage();
    await flushPromises();
    await activateTab("sites");
    await requestDeleteSite(page);
    expect(sitesTable(page).props("disabled")).toBe(true);
    await activateTab("profile");
    expect(roleControl(page).props("disabled")).toBe(true);
    expect(
      page.get('button[aria-label="More actions"]').attributes("disabled"),
    ).toBeDefined();
    await activateTab("sites");
    await requestDeleteSite(page);
    expect(mocks.deleteSite).toHaveBeenCalledTimes(1);
    finish({ data: { status: "deletion_requested" } });
    await flushPromises();
  });
});

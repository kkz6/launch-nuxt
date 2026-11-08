import { flushPromises, shallowMount } from "@vue/test-utils";
import { defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUserPage from "../../pages/admin/users/[id].vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  showUser: vi.fn(),
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
vi.mock("~/services/adminService", () => ({ adminService: mocks }));
vi.mock("~/composables/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("~/composables/useImpersonation", () => ({
  useImpersonation: () => ({ start: mocks.start }),
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const currentUser = ref({ id: "admin-1", staff_role: "super_admin" });
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
const mountPage = () =>
  shallowMount(AdminUserPage, {
    global: {
      stubs: {
        Icon: true,
        Badge: slots,
        Avatar: slots,
        AvatarFallback: slots,
        SharedDateTooltip: true,
        NuxtLink: { template: "<a><slot /></a>" },
        Button: { template: "<button><slot /></button>" },
        Tabs: {
          ...slots,
          name: "Tabs",
          props: ["modelValue"],
          emits: ["update:modelValue"],
        },
        TabsContent: slots,
        TabsList: slots,
        TabsTrigger: slots,
        SharedConfirmationDialog: defineComponent({
          setup(_, { expose }) {
            expose({ show: mocks.confirm });
            return () => null;
          },
        }),
      },
    },
  });
type Page = ReturnType<typeof mountPage>;
const deleteUserButton = (page: Page) =>
  page.findAll("button").find((button) => button.text() === "Delete user")!;
const sitesTable = (page: Page) =>
  page.findComponent({ name: "UserSitesTable" });
const roleControl = (page: Page) =>
  page.findComponent({ name: "UserStaffRoleControl" });
const activateTab = async (page: Page, tab: string) => {
  page.findComponent({ name: "Tabs" }).vm.$emit("update:modelValue", tab);
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
    vi.stubGlobal("useRoute", () => ({ params: { id: "user-1" } }));
    vi.stubGlobal("useI18n", () => ({ ...createI18nStub(), te: () => true }));
    vi.stubGlobal("navigateTo", mocks.navigateTo);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("hides staff mutations for support and rejects site actions", async () => {
    currentUser.value.staff_role = "support";
    const page = mountPage();
    await flushPromises();
    await activateTab(page, "sites");
    expect(roleControl(page).exists()).toBe(false);
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
    expect(deleteUserButton(page).attributes("disabled")).toBeDefined();
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
    expect(deleteUserButton(page).attributes("disabled")).toBeUndefined();
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
    expect(deleteUserButton(page).attributes("disabled")).toBeDefined();
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
    await activateTab(page, "sites");
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
    await activateTab(page, "sites");
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
    await activateTab(page, "sites");
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

  it("reconciles completed deletion and remote failure on refresh", async () => {
    const page = mountPage();
    await flushPromises();
    await activateTab(page, "sites");
    await requestDeleteSite(page);
    mocks.userSites.mockResolvedValueOnce({
      data: [
        site({
          uninstallation_requested_at: "2026-11-08T00:00:00Z",
          uninstallation_failed_at: "2026-11-08T00:01:00Z",
        }),
      ],
    });
    sitesTable(page).vm.$emit("refresh");
    await flushPromises();
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(sitesTable(page).props("sites")).toHaveLength(1);
    await requestDeleteSite(page);
    expect(mocks.deleteSite).toHaveBeenCalledTimes(2);
    mocks.userSites.mockResolvedValueOnce({ data: [] });
    sitesTable(page).vm.$emit("refresh");
    await flushPromises();
    expect(sitesTable(page).props("pendingIds")).toEqual([]);
    expect(sitesTable(page).props("sites")).toEqual([]);
  });

  it("keeps loaded sites and reports refresh failure", async () => {
    const page = mountPage();
    await flushPromises();
    await activateTab(page, "sites");
    mocks.userSites.mockRejectedValueOnce(new Error("offline"));
    sitesTable(page).vm.$emit("refresh");
    await flushPromises();
    expect(sitesTable(page).props("sites")).toHaveLength(1);
    expect(page.get('[role="alert"]').text()).toContain("Failed to load");
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
    await activateTab(page, "sites");
    await requestDeleteSite(page);
    expect(sitesTable(page).props("disabled")).toBe(true);
    expect(roleControl(page).props("disabled")).toBe(true);
    await requestDeleteSite(page);
    expect(mocks.deleteSite).toHaveBeenCalledTimes(1);
    finish({ data: { status: "deletion_requested" } });
    await flushPromises();
  });
});

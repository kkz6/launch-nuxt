import { flushPromises, shallowMount } from "@vue/test-utils";
import { defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminServerPage from "../../pages/admin/servers/[id].vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  showServer: vi.fn(),
  deleteServer: vi.fn(),
  confirm: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("~/services/adminService", () => ({
  adminService: {
    showServer: mocks.showServer,
    deleteServer: mocks.deleteServer,
  },
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const currentUser = ref({ staff_role: "super_admin" });
const server = (overrides: Record<string, unknown> = {}) => ({
  id: "server-1",
  name: "production-web",
  provider: "custom_server",
  status: "running",
  connected: true,
  monitoring_enabled: true,
  auto_update: false,
  sites_count: 0,
  projects_count: 0,
  owner: { team_name: "Customer team", user_id: "customer-1" },
  ...overrides,
});

const mountPage = () =>
  shallowMount(AdminServerPage, {
    global: {
      mocks: { navigateTo: mocks.navigateTo },
      stubs: {
        Icon: true,
        AdminPageHeader: false,
        Badge: true,
        Avatar: true,
        AvatarFallback: true,
        SharedDateTooltip: true,
        NuxtLink: { template: "<a><slot /></a>" },
        Button: { template: "<button><slot /></button>" },
        SharedConfirmationDialog: defineComponent({
          setup(_, { expose }) {
            expose({ show: mocks.confirm });
            return () => null;
          },
        }),
      },
    },
  });

const deleteButton = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.get('section[aria-labelledby="server-delete-heading"] button');

describe("admin server deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showServer.mockResolvedValue({ data: server() });
    mocks.deleteServer.mockResolvedValue({
      data: { status: "deletion_requested" },
    });
    mocks.confirm.mockResolvedValue({ ok: true });
    currentUser.value = { staff_role: "super_admin" };
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("setBreadcrumbs", vi.fn());
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useRoute", () => ({ params: { id: "server-1" } }));
    vi.stubGlobal("useAuth", () => ({ user: currentUser }));
    vi.stubGlobal("useI18n", () => ({ ...createI18nStub(), te: () => true }));
    vi.stubGlobal("useStableMetadataLabels", () => ({
      getServerTypeLabel: (type: string) => type,
    }));
    vi.stubGlobal("navigateTo", mocks.navigateTo);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the server heading and return action available above its management cards", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.findAll("h1")).toHaveLength(1);
    expect(wrapper.get("h1").text()).toBe("production-web");
    expect(wrapper.text()).toContain("Configuration");
    const back = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Back to servers"));
    expect(back).toBeDefined();
    await back!.trigger("click");
    expect(mocks.navigateTo).toHaveBeenCalledWith("/admin/servers");
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });

  it.each(["support", ""])("hides deletion for role %j", async (role) => {
    currentUser.value.staff_role = role;
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find("#server-delete-heading").exists()).toBe(false);
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });

  it("requires a destructive, typed-name confirmation and respects cancellation", async () => {
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    const wrapper = mountPage();
    await flushPromises();
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        destructive: true,
        inputVerificationText: "production-web",
        description: expect.stringContaining("production-web"),
      }),
    );
    expect(mocks.deleteServer).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("deletes the selected server and returns to the admin server list", async () => {
    const wrapper = mountPage();
    await flushPromises();
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(mocks.deleteServer).toHaveBeenCalledTimes(1);
    expect(mocks.deleteServer).toHaveBeenCalledWith(
      "server-1",
      "production-web",
    );
    expect(mocks.success).toHaveBeenCalledWith("Server deletion requested");
    expect(mocks.navigateTo).toHaveBeenCalledWith("/admin/servers");
  });

  it("prevents duplicate requests while deletion is pending", async () => {
    let finish!: (value: unknown) => void;
    mocks.deleteServer.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const wrapper = mountPage();
    await flushPromises();
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
    await deleteButton(wrapper).trigger("click");
    expect(mocks.deleteServer).toHaveBeenCalledTimes(1);
    finish({ data: { status: "deleted" } });
    await flushPromises();
  });

  it.each(["starting", "provisioning", "deleting"])(
    "disables deletion while %s",
    async (status) => {
      mocks.showServer.mockResolvedValueOnce({ data: server({ status }) });
      const wrapper = mountPage();
      await flushPromises();
      expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
      await deleteButton(wrapper).trigger("click");
      expect(mocks.confirm).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ sites_count: 2 }, "Remove the 2 site(s)"],
    [{ projects_count: 3 }, "Remove the 3 Docker project(s)"],
  ])(
    "disables deletion until child resources are removed",
    async (counts, reason) => {
      mocks.showServer.mockResolvedValueOnce({ data: server(counts) });
      const wrapper = mountPage();
      await flushPromises();
      expect(wrapper.text()).toContain(reason);
      expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
      await deleteButton(wrapper).trigger("click");
      expect(mocks.deleteServer).not.toHaveBeenCalled();
      expect(mocks.confirm).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "custom_server",
      "machine, its files, and installed services remain running",
    ],
    ["hetzner", "deletion of the cloud provider instance and its data"],
  ])(
    "explains the deletion impact for %s servers",
    async (provider, impact) => {
      mocks.showServer.mockResolvedValueOnce({ data: server({ provider }) });
      const wrapper = mountPage();
      await flushPromises();
      expect(wrapper.text()).toContain(impact);
      await deleteButton(wrapper).trigger("click");
      await flushPromises();
      expect(mocks.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ warning: expect.stringContaining(impact) }),
      );
      if (provider === "custom_server") {
        expect(wrapper.text()).not.toContain(
          "deletion of the cloud provider instance",
        );
        expect(mocks.confirm.mock.calls[0][0].warning).not.toContain(
          "deletion of the cloud provider instance",
        );
      }
    },
  );

  it("reports completed record removal separately from a queued cloud deletion", async () => {
    mocks.deleteServer.mockResolvedValueOnce({ data: { status: "deleted" } });
    const wrapper = mountPage();
    await flushPromises();
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(mocks.success).toHaveBeenCalledWith("Server deleted");
  });

  it.each([
    { data: { message: "Remove every project before deleting this server." } },
    new Error("Network unavailable"),
  ])(
    "keeps the server visible and displays deletion failures",
    async (error) => {
      mocks.deleteServer.mockRejectedValueOnce(error);
      const wrapper = mountPage();
      await flushPromises();
      await deleteButton(wrapper).trigger("click");
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toBe(
        "data" in error ? error.data.message : "Failed to delete server",
      );
      expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
      expect(mocks.navigateTo).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
    },
  );

  it("does not offer deletion when the server cannot be loaded", async () => {
    mocks.showServer.mockRejectedValueOnce({ statusCode: 404 });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find("#server-delete-heading").exists()).toBe(false);
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });
});

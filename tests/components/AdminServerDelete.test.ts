import { flushPromises, shallowMount } from "@vue/test-utils";
import { defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminServerPage from "../../pages/admin/servers/[id].vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  liveUpdates: vi.fn(),
  showServer: vi.fn(),
  deleteServer: vi.fn(),
  removeServerRecord: vi.fn(),
  confirm: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: mocks.liveUpdates,
}));
vi.mock("~/services/adminService", () => ({
  adminService: {
    showServer: mocks.showServer,
    uninstallServer: mocks.deleteServer,
    removeServerRecord: mocks.removeServerRecord,
  },
}));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error, warning: mocks.warning },
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
        ServerDetail: false,
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
    mocks.removeServerRecord.mockResolvedValue({ data: { status: "removed" } });
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

  it("reconciles deletion counts after a site event without hiding the server", async () => {
    mocks.showServer.mockResolvedValueOnce({
      data: server({ sites_count: 1 }),
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("requires removing its 1 site");
    expect(mocks.liveUpdates).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        serverId: "server-1",
        resources: expect.arrayContaining(["site", "docker", "server"]),
      }),
    );
    let finish!: (value: unknown) => void;
    mocks.showServer.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const refreshing = mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("production-web");
    expect(wrapper.text()).toContain("requires removing its 1 site");
    finish({ data: server({ sites_count: 0 }) });
    await refreshing;
    await flushPromises();
    expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).not.toContain("requires removing its 1 site");
    expect(mocks.deleteServer).not.toHaveBeenCalled();
    wrapper.unmount();
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

  it.each([
    [undefined, "Failed to delete server"],
    ["unknown_provider_error", "Failed to delete server"],
    [
      "provider_unauthorized",
      "The cloud provider rejected the saved credentials. Update the provider connection and try again.",
    ],
    [
      "provider_forbidden",
      "The cloud provider denied deletion. Check the connection permissions and try again.",
    ],
  ])(
    "shows safe deletion feedback for %j and restores retry from canonical server state",
    async (code, message) => {
      mocks.showServer.mockResolvedValueOnce({
        data: server({ provider: "digital_ocean", status: "deleting" }),
      });
      const wrapper = mountPage();
      await flushPromises();
      expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
      const [refresh, options] = mocks.liveUpdates.mock.calls[0];
      options.onChange({ resource: "site", action: "deletion_failed" });
      expect(mocks.error).not.toHaveBeenCalled();
      options.onChange({
        resource: "server",
        action: "deletion_failed",
        server_id: "server-1",
        error_code: code,
        error: "raw-provider-error-with-secret",
      });
      await refresh();
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(mocks.error).toHaveBeenCalledWith(message);
      expect(wrapper.text()).not.toContain("raw-provider-error-with-secret");
      expect(wrapper.get("h1").text()).toBe("production-web");
      expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
      expect(mocks.navigateTo).not.toHaveBeenCalled();
      expect(mocks.deleteServer).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

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
    [{ sites_count: 2 }, "requires removing its 2 site(s)"],
    [{ projects_count: 3 }, "requires removing its 3 Docker project(s)"],
  ])(
    "explains the reachable-server requirements while allowing a connection check",
    async (counts, reason) => {
      mocks.showServer.mockResolvedValueOnce({ data: server(counts) });
      const wrapper = mountPage();
      await flushPromises();
      expect(wrapper.text()).toContain(reason);
      expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
      await deleteButton(wrapper).trigger("click");
      await flushPromises();
      expect(mocks.confirm).toHaveBeenCalledOnce();
      expect(mocks.deleteServer).toHaveBeenCalledOnce();
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

  it("warns when an unreachable server and its sites were removed locally", async () => {
    mocks.showServer.mockResolvedValue({
      data: server({ sites_count: 2, connected: false }),
    });
    mocks.deleteServer.mockResolvedValueOnce({
      data: { status: "removed_offline" },
    });
    const wrapper = mountPage();
    await flushPromises();
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(mocks.warning).toHaveBeenCalledWith(
      expect.stringContaining("Server unreachable"),
    );
    expect(mocks.navigateTo).toHaveBeenCalledWith("/admin/servers");
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
      expect(mocks.error).toHaveBeenCalledWith(
        "data" in error ? error.data.message : "Failed to delete server",
      );
      expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
      expect(mocks.navigateTo).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
    },
  );

  it("reconciles stale deletion eligibility after a refusal while keeping its error", async () => {
    const message = "Remove every site before deleting this server";
    mocks.deleteServer.mockRejectedValueOnce({ data: { message } });
    mocks.showServer
      .mockResolvedValueOnce({ data: server({ sites_count: 0 }) })
      .mockResolvedValueOnce({ data: server({ sites_count: 1 }) });
    const wrapper = mountPage();
    await flushPromises();
    expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
    await deleteButton(wrapper).trigger("click");
    await flushPromises();
    expect(mocks.showServer).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalledWith(message);
    expect(wrapper.text()).toContain("requires removing its 1 site");
    expect(deleteButton(wrapper).attributes("disabled")).toBeUndefined();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
  });

  it("removes only the cloud server record after explicit confirmation and a successful response", async () => {
    mocks.showServer.mockResolvedValue({
      data: server({ provider: "digitalocean", connected: false }),
    });
    let finish!: (value: unknown) => void;
    mocks.removeServerRecord.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountPage();
    await flushPromises();
    const remove = wrapper
      .findAll("button")
      .find((button) => button.text() === "Remove from launchctl")!;
    expect(remove.attributes("disabled")).toBeUndefined();
    await remove.trigger("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Remove from launchctl",
        confirmText: "Remove from launchctl",
        inputVerificationText: "production-web",
        destructive: true,
        warning: expect.stringContaining("its sites, and its Docker projects"),
      }),
    );
    expect(mocks.removeServerRecord).toHaveBeenCalledWith(
      "server-1",
      "production-web",
    );
    expect(mocks.deleteServer).not.toHaveBeenCalled();
    expect(remove.attributes("disabled")).toBeDefined();
    expect(deleteButton(wrapper).attributes("disabled")).toBeDefined();
    expect(deleteButton(wrapper).text()).toBe("Uninstall server");
    expect(wrapper.get("h1").text()).toBe("production-web");
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    finish({ data: { status: "removed" } });
    await flushPromises();
    expect(mocks.success).toHaveBeenCalledWith("Server removed from launchctl");
    expect(mocks.navigateTo).toHaveBeenCalledWith("/admin/servers");
  });

  it("sends only the name confirmed for record removal if the server is renamed while the dialog is open", async () => {
    mocks.showServer.mockResolvedValueOnce({
      data: server({ provider: "digitalocean" }),
    });
    let confirm!: (value: { ok: boolean }) => void;
    mocks.confirm.mockReturnValueOnce(
      new Promise((resolve) => {
        confirm = resolve;
      }),
    );
    const wrapper = mountPage();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Remove from launchctl")!
      .trigger("click");
    await flushPromises();
    expect(mocks.confirm.mock.calls[0][0].inputVerificationText).toBe(
      "production-web",
    );
    mocks.showServer.mockResolvedValue({
      data: server({ provider: "digitalocean", name: "Renamed server" }),
    });
    await mocks.liveUpdates.mock.calls[0][0]();
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("Renamed server");
    mocks.removeServerRecord.mockRejectedValueOnce({
      data: { message: "Type the server name exactly to confirm deletion" },
    });
    confirm({ ok: true });
    await flushPromises();
    expect(mocks.removeServerRecord).toHaveBeenCalledWith(
      "server-1",
      "production-web",
    );
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "Type the server name exactly to confirm deletion",
    );
  });

  it.each([
    ["support", "digitalocean", false],
    ["super_admin", "custom_server", true],
  ])(
    "sets record removal availability for %s on %s",
    async (role, provider, available) => {
      currentUser.value.staff_role = role;
      mocks.showServer.mockResolvedValue({ data: server({ provider }) });
      const wrapper = mountPage();
      await flushPromises();
      expect(
        wrapper
          .findAll("button")
          .some((button) => button.text() === "Remove from launchctl"),
      ).toBe(available);
      expect(mocks.removeServerRecord).not.toHaveBeenCalled();
    },
  );

  it.each([
    { status: "starting" },
    { status: "provisioning" },
    { status: "deleting" },
  ])("retains lifecycle guards for record removal: %j", async (guard) => {
    mocks.showServer.mockResolvedValue({
      data: server({ provider: "digitalocean", ...guard }),
    });
    const wrapper = mountPage();
    await flushPromises();
    const remove = wrapper
      .findAll("button")
      .find((button) => button.text() === "Remove from launchctl")!;
    expect(remove.attributes("disabled")).toBeDefined();
    await remove.trigger("click");
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.removeServerRecord).not.toHaveBeenCalled();
  });

  it("keeps the record when removal is cancelled or rejected, without falling back to cloud deletion", async () => {
    mocks.showServer.mockResolvedValue({
      data: server({ provider: "digitalocean" }),
    });
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    mocks.removeServerRecord.mockRejectedValueOnce({
      data: { message: "Remove every project before removing this server" },
    });
    const wrapper = mountPage();
    await flushPromises();
    const remove = wrapper
      .findAll("button")
      .find((button) => button.text() === "Remove from launchctl")!;
    await remove.trigger("click");
    await flushPromises();
    expect(mocks.removeServerRecord).not.toHaveBeenCalled();
    await remove.trigger("click");
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith(
      "Remove every project before removing this server",
    );
    expect(wrapper.get("h1").text()).toBe("production-web");
    expect(remove.attributes("disabled")).toBeUndefined();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.navigateTo).not.toHaveBeenCalled();
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });

  it("offers a retry when the initial detail request fails", async () => {
    mocks.showServer.mockRejectedValueOnce(new Error("Network unavailable"));
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Failed to load server",
    );
    expect(wrapper.find("#server-delete-heading").exists()).toBe(false);
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.get("h1").text()).toBe("production-web");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("does not offer deletion when the server cannot be loaded", async () => {
    mocks.showServer.mockRejectedValueOnce({ statusCode: 404 });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.find("#server-delete-heading").exists()).toBe(false);
    expect(mocks.deleteServer).not.toHaveBeenCalled();
  });
});

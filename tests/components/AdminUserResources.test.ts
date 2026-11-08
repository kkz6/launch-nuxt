import { shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserSitesTable from "../../components/admin/UserSitesTable.vue";
import SiteDetailsSheet from "../../components/admin/SiteDetailsSheet.vue";
import ServerDetailsSheet from "../../components/admin/ServerDetailsSheet.vue";
import UserStaffRoleControl from "../../components/admin/UserStaffRoleControl.vue";
import { createI18nStub } from "../helpers/i18n";
import type { AdminSiteSummary } from "../../types";

const slots = { template: "<div><slot /></div>" };
const input = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};
const site = (overrides: Partial<AdminSiteSummary> = {}): AdminSiteSummary => ({
  id: "site-1",
  address: "app.example.com",
  server_id: "server-1",
  server_name: "Production",
  type: "laravel",
  tls_setting: "auto",
  ...overrides,
});
const mountSites = (overrides = {}) =>
  shallowMount(UserSitesTable, {
    props: {
      sites: [
        site(),
        site({
          id: "site-2",
          address: "staging.example.com",
          server_name: "Preview",
          tls_setting: "off",
        }),
      ],
      loading: false,
      canDelete: true,
      busyId: null,
      pendingIds: [],
      errors: {},
      ...overrides,
    },
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
        Input: input,
        Label: { template: "<label><slot /></label>" },
        Badge: slots,
        Table: { template: "<table><slot /></table>" },
        TableBody: { template: "<tbody><slot /></tbody>" },
        TableRow: { template: "<tr><slot /></tr>" },
        TableCell: { template: "<td><slot /></td>" },
        TableHead: { template: "<th><slot /></th>" },
        TableHeader: { template: "<thead><slot /></thead>" },
        NuxtLink: { template: "<a><slot /></a>" },
        TooltipProvider: slots,
        Tooltip: slots,
        TooltipTrigger: slots,
        TooltipContent: { ...slots, name: "TooltipContent" },
        Icon: true,
      },
    },
  });
const mountRole = (overrides = {}) =>
  shallowMount(UserStaffRoleControl, {
    props: {
      role: null,
      isSelf: false,
      disabled: false,
      busy: false,
      error: "",
      ...overrides,
    },
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
        Label: slots,
        Select: {
          ...slots,
          name: "Select",
          props: ["modelValue", "disabled"],
          emits: ["update:modelValue"],
        },
        SelectTrigger: slots,
        SelectContent: slots,
        SelectItem: slots,
        SelectValue: true,
        Icon: true,
      },
    },
  });

describe("admin user resource controls", () => {
  beforeEach(() => {
    vi.stubGlobal("useI18n", createI18nStub);
    vi.stubGlobal("useStableMetadataLabels", () => ({
      getSiteTypeLabel: (type: string) =>
        ({ laravel: "Laravel" })[type] || type,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("provides explicit site/server/type/TLS columns and target-specific delete labels", async () => {
    const wrapper = mountSites();
    expect(wrapper.findAll("th").map((cell) => cell.text())).toEqual([
      "Site",
      "Server",
      "Type",
      "TLS",
      "Action",
    ]);
    expect(wrapper.text()).toContain("Laravel");
    expect(wrapper.text()).toContain("Automatic");
    expect(wrapper.text()).toContain("Disabled");
    const action = wrapper.get(
      'button[aria-label="Delete site app.example.com"]',
    );
    expect(action.text()).toBe("");
    expect(action.attributes("title")).toBe("Delete site app.example.com");
    expect(
      wrapper
        .findAllComponents({ name: "TooltipContent" })
        .map((tooltip) => tooltip.text()),
    ).toEqual([
      "View site app.example.com",
      "Delete site app.example.com",
      "View site staging.example.com",
      "Delete site staging.example.com",
    ]);
    await wrapper
      .get('button[aria-label="Delete site app.example.com"]')
      .trigger("click");
    expect(wrapper.emitted("delete")).toEqual([[site()]]);
  });

  it.each(["STAGING", " Preview "])(
    "filters sites by address or server with %j",
    async (search) => {
      const wrapper = mountSites();
      await wrapper.get("input").setValue(search);
      expect(wrapper.findAll("tbody tr")).toHaveLength(1);
      expect(wrapper.text()).toContain("staging.example.com");
      expect(wrapper.text()).not.toContain("app.example.com");
      await wrapper.get("input").setValue("missing");
      expect(wrapper.text()).toContain("No sites match");
      expect(wrapper.emitted("delete")).toBeUndefined();
    },
  );

  it("does not offer delete actions to support staff", () => {
    const wrapper = mountSites({ canDelete: false });
    expect(wrapper.findAll('button[aria-label^="Delete site"]')).toHaveLength(
      0,
    );
    expect(wrapper.findAll('button[aria-label^="View site"]')).toHaveLength(2);
  });

  it("retains pending sites with a status and no duplicate delete button", () => {
    const wrapper = mountSites({
      sites: [site({ uninstallation_requested_at: "2026-11-08T00:00:00Z" })],
    });
    expect(wrapper.text()).toContain("app.example.com");
    expect(wrapper.text()).toContain("Deletion requested");
    expect(wrapper.get('[role="status"]').text()).toContain(
      "updates automatically",
    );
    expect(wrapper.find('button[aria-label^="Delete site"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('button[aria-label^="View site"]').exists()).toBe(true);
  });

  it("shows a retryable remote-cleanup failure and request errors beside the retained site", async () => {
    const wrapper = mountSites({
      sites: [
        site({
          uninstallation_requested_at: null,
          uninstallation_failed_at: "2026-11-08T00:01:00Z",
        }),
      ],
    });
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Site deletion failed",
    );
    expect(
      wrapper
        .get('button[aria-label="Delete site app.example.com"]')
        .attributes("disabled"),
    ).toBeUndefined();
    await wrapper.setProps({ errors: { "site-1": "Queue unavailable" } });
    expect(wrapper.get('[role="alert"]').text()).toBe("Queue unavailable");
    expect(wrapper.text()).toContain("app.example.com");
  });

  it("disables resource mutations during another action without a manual refresh control", () => {
    const wrapper = mountSites({ disabled: true });
    expect(
      wrapper
        .get('button[aria-label="Delete site app.example.com"]')
        .attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.findAll("button").some((button) => button.text() === "Refresh"),
    ).toBe(false);
    expect(
      wrapper
        .get('button[aria-label="View site app.example.com"]')
        .attributes("disabled"),
    ).toBeUndefined();
  });

  it("opens live site details by icon or domain without emitting a delete", async () => {
    const wrapper = mountSites();
    const view = wrapper.get('button[aria-label="View site app.example.com"]');
    expect(view.text()).toBe("");
    expect(view.attributes("title")).toBe("View site app.example.com");
    await view.trigger("click");
    const details = wrapper.getComponent(SiteDetailsSheet);
    expect(details.props("open")).toBe(true);
    expect(details.props("site")).toEqual(site());
    expect(wrapper.emitted("delete")).toBeUndefined();
    const updated = site({
      repository_branch: "release",
      uninstallation_requested_at: "2026-11-08T10:00:00Z",
    });
    await wrapper.setProps({ sites: [updated] });
    expect(details.props("site")).toEqual(updated);
    expect(details.props("pending")).toBe(true);
    details.vm.$emit("update:open", false);
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "app.example.com")!
      .trigger("click");
    expect(details.props("open")).toBe(true);
    await wrapper.setProps({ sites: [] });
    expect(details.props("site")).toBeNull();
  });

  it("opens the server in a sheet from the row or site details and preserves user context", async () => {
    const wrapper = mountSites();
    expect(wrapper.find('a[href^="/admin/servers/"]').exists()).toBe(false);
    await wrapper
      .get('button[aria-label="View server Production"]')
      .trigger("click");
    const serverDetails = wrapper.getComponent(ServerDetailsSheet);
    expect(serverDetails.props("serverId")).toBe("server-1");
    serverDetails.vm.$emit("update:serverId", null);
    await wrapper
      .get('button[aria-label="View site app.example.com"]')
      .trigger("click");
    const details = wrapper.getComponent(SiteDetailsSheet);
    details.vm.$emit("viewServer", "server-1");
    await wrapper.vm.$nextTick();
    expect(details.props("open")).toBe(false);
    expect(serverDetails.props("serverId")).toBe("server-1");
    expect(wrapper.emitted("delete")).toBeUndefined();
  });

  it("maps Regular user to explicit null and saves only changed roles", async () => {
    const wrapper = mountRole({ role: "support" });
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    wrapper
      .findComponent({ name: "Select" })
      .vm.$emit("update:modelValue", "regular");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("save")).toEqual([[null]]);
    await wrapper.setProps({ role: null });
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("prevents changing your own role and explains the restriction", async () => {
    const wrapper = mountRole({ role: "super_admin", isSelf: true });
    expect(wrapper.text()).toContain("You cannot change your own staff role");
    expect(wrapper.findComponent({ name: "Select" }).props("disabled")).toBe(
      true,
    );
    wrapper
      .findComponent({ name: "Select" })
      .vm.$emit("update:modelValue", "regular");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("save")).toBeUndefined();
  });
});

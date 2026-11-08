import { shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SiteDetailsSheet from "../../components/admin/SiteDetailsSheet.vue";
import type { AdminSiteSummary } from "../../types";
import { createI18nStub } from "../helpers/i18n";

const site = (overrides: Partial<AdminSiteSummary> = {}): AdminSiteSummary => ({
  id: "site-1",
  address: "app.example.com",
  server_id: "server-1",
  server_name: "Production",
  type: "laravel",
  tls_setting: "auto",
  ...overrides,
});
const slots = { template: "<div><slot /></div>" };
const mountDetails = (overrides = {}) =>
  shallowMount(SiteDetailsSheet, {
    props: { open: true, site: site(), ...overrides },
    global: {
      stubs: {
        Sheet: {
          ...slots,
          name: "Sheet",
          props: ["open"],
          emits: ["update:open"],
        },
        SheetContent: slots,
        SheetHeader: slots,
        SheetTitle: { template: "<h2><slot /></h2>" },
        SheetDescription: { template: "<p><slot /></p>" },
        Badge: slots,
        SharedDateTooltip: true,
      },
    },
  });

beforeEach(() => {
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useStableMetadataLabels", () => ({
    getSiteTypeLabel: (value: string) =>
      value === "laravel" ? "Laravel" : value,
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("admin site details", () => {
  it("shows actual configuration and optional branch/date without inventing unavailable fields", () => {
    const wrapper = mountDetails({
      site: site({
        repository_branch: "main",
        created_at: "2026-11-08T10:00:00Z",
      }),
    });
    expect(wrapper.get("h2").text()).toBe("Site details");
    expect(wrapper.text()).toContain("app.example.com");
    expect(wrapper.text()).toContain("Production");
    expect(wrapper.text()).toContain("Laravel");
    expect(wrapper.text()).toContain("Automatic");
    expect(wrapper.text()).toContain("main");
    expect(wrapper.text()).toContain("Not requested");
    expect(wrapper.get("shared-date-tooltip-stub").attributes("date")).toBe(
      "2026-11-08T10:00:00Z",
    );
    expect(wrapper.findAll("dt").map((row) => row.text())).toEqual([
      "Server",
      "Type",
      "TLS",
      "Repository branch",
      "Created",
      "Deletion",
    ]);
  });

  it("omits unavailable optional fields and opens its server without navigating", async () => {
    const wrapper = mountDetails();
    expect(wrapper.findAll("dt").map((row) => row.text())).toEqual([
      "Server",
      "Type",
      "TLS",
      "Deletion",
    ]);
    await wrapper
      .get('button[aria-label="View server Production"]')
      .trigger("click");
    expect(wrapper.emitted("viewServer")).toEqual([["server-1"]]);
    expect(wrapper.find("a").exists()).toBe(false);
    wrapper.getComponent({ name: "Sheet" }).vm.$emit("update:open", false);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("updates pending and failed cleanup state while retaining the site details", async () => {
    const wrapper = mountDetails({ pending: true });
    expect(wrapper.text()).toContain("Deletion requested");
    expect(wrapper.get('[role="status"]').text()).toContain(
      "updates automatically",
    );
    await wrapper.setProps({
      site: site({ uninstallation_failed_at: "2026-11-08T11:00:00Z" }),
    });
    expect(wrapper.text()).not.toContain("Deletion requested");
    expect(wrapper.text()).toContain("app.example.com");
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Site deletion failed",
    );
    await wrapper.setProps({ error: "Queue unavailable" });
    expect(wrapper.get('[role="alert"]').text()).toBe("Queue unavailable");
    await wrapper.setProps({ site: null });
    expect(wrapper.text()).toContain("This site is no longer available.");
    expect(wrapper.find("dl").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("app.example.com");
  });
});

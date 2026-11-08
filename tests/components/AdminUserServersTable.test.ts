import { shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserServersTable from "../../components/admin/UserServersTable.vue";
import ServerDetailsSheet from "../../components/admin/ServerDetailsSheet.vue";
import type { AdminServerSummary } from "../../types";
import { createI18nStub } from "../helpers/i18n";

const server = (
  overrides: Partial<AdminServerSummary> = {},
): AdminServerSummary => ({
  id: "server-1",
  team_id: "team-1",
  user_id: "user-1",
  name: "Production Europe",
  provider: "hetzner",
  public_ipv4: "192.0.2.1",
  status: "running",
  connected: true,
  ...overrides,
});
const mountTable = (overrides = {}) =>
  shallowMount(UserServersTable, {
    props: {
      servers: [
        server(),
        server({
          id: "server-2",
          name: "Websites",
          provider: "custom_server",
          public_ipv4: null,
          status: "failed",
          connected: false,
        }),
      ],
      loading: false,
      loaded: true,
      ...overrides,
    },
    global: {
      stubs: {
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Label: { template: "<label><slot /></label>" },
        Badge: {
          name: "Badge",
          props: ["variant"],
          template: "<span><slot /></span>",
        },
        Button: { template: "<button><slot /></button>" },
        Table: { template: "<table><slot /></table>" },
        TableHeader: { template: "<thead><slot /></thead>" },
        TableHead: { template: "<th><slot /></th>" },
        TableBody: { template: "<tbody><slot /></tbody>" },
        TableRow: { template: "<tr><slot /></tr>" },
        TableCell: { template: "<td><slot /></td>" },
        NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
        TooltipProvider: { template: "<span><slot /></span>" },
        Tooltip: { template: "<span><slot /></span>" },
        TooltipTrigger: { template: "<span><slot /></span>" },
        TooltipContent: {
          name: "TooltipContent",
          template: "<span><slot /></span>",
        },
        Icon: true,
      },
    },
  });

describe("admin user server table", () => {
  beforeEach(() => {
    vi.stubGlobal("useI18n", () => ({ ...createI18nStub(), te: () => true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows provider, IP, one status per server, and accessible detail actions", () => {
    const wrapper = mountTable();
    expect(wrapper.findAll("th").map((head) => head.text())).toEqual([
      "Name",
      "Provider",
      "Public IPv4",
      "Status",
      "Action",
    ]);
    const rows = wrapper.findAll("tbody tr");
    expect(
      rows[0]
        .findAll("td")
        .slice(0, 4)
        .map((cell) => cell.text()),
    ).toEqual(["Production Europe", "Hetzner", "192.0.2.1", "Running"]);
    expect(
      rows[1]
        .findAll("td")
        .slice(0, 4)
        .map((cell) => cell.text()),
    ).toEqual(["Websites", "Custom Server", "—", "Failed"]);
    const view = wrapper.get('button[aria-label="View server Websites"]');
    expect(view.attributes("aria-haspopup")).toBe("dialog");
    expect(view.text()).toBe("");
    expect(view.attributes("title")).toBe("View server Websites");
    expect(wrapper.find("a").exists()).toBe(false);
    expect(
      wrapper
        .findAllComponents({ name: "TooltipContent" })
        .map((tooltip) => tooltip.text()),
    ).toEqual(["View server Production Europe", "View server Websites"]);
    expect(
      wrapper
        .findAllComponents({ name: "Badge" })
        .map((badge) => badge.props("variant")),
    ).toEqual(["green", "red"]);
  });

  it("opens details from either action and retains the user search when closed", async () => {
    const navigate = vi.fn();
    vi.stubGlobal("navigateTo", navigate);
    const wrapper = mountTable();
    await wrapper.get("input").setValue("Websites");
    await wrapper.get("tbody tr td button").trigger("click");
    const details = wrapper.getComponent(ServerDetailsSheet);
    expect(details.props("serverId")).toBe("server-2");
    details.vm.$emit("update:serverId", null);
    await wrapper.vm.$nextTick();
    expect(details.props("serverId")).toBeNull();
    expect((wrapper.get("input").element as HTMLInputElement).value).toBe(
      "Websites",
    );
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    await wrapper
      .get('button[aria-label="View server Websites"]')
      .trigger("click");
    expect(details.props("serverId")).toBe("server-2");
    expect(wrapper.find("a").exists()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(["CUSTOM SERVER", " Websites "])(
    "filters by displayed provider or server name with %j",
    async (search) => {
      const wrapper = mountTable();
      await wrapper.get("input").setValue(search);
      expect(wrapper.findAll("tbody tr")).toHaveLength(1);
      expect(wrapper.text()).toContain("Websites");
      await wrapper.get("input").setValue("192.0.2.1");
      expect(wrapper.findAll("tbody tr")).toHaveLength(1);
      expect(wrapper.text()).toContain("Production Europe");
      await wrapper.get("input").setValue("missing");
      expect(wrapper.text()).toContain("No servers match");
      expect(wrapper.find("table").exists()).toBe(false);
    },
  );

  it("keeps loaded rows visible during refresh and removes only confirmed missing rows", async () => {
    const wrapper = mountTable({ loading: true });
    expect(wrapper.findAll("tbody tr")).toHaveLength(2);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    await wrapper.setProps({ servers: [server({ status: "deleting" })] });
    expect(wrapper.findAll("tbody tr")).toHaveLength(1);
    expect(wrapper.text()).toContain("Deleting");
    await wrapper.setProps({ servers: [], loading: false });
    expect(wrapper.text()).toContain("This user does not own any servers.");
  });

  it("shows initial loading separately from an empty result", () => {
    const wrapper = mountTable({ servers: [], loading: true, loaded: false });
    expect(wrapper.get('[role="status"]').attributes("aria-label")).toBe(
      "Loading...",
    );
    expect(wrapper.text()).not.toContain("This user does not own any servers.");
  });
});

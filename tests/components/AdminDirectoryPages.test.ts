import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, defineComponent, ref, watch } from "vue";
import { CalendarDate } from "@internationalized/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "../../pages/admin/index.vue";
import InvitationsPage from "../../pages/admin/invitations.vue";
import { createI18nStub } from "../helpers/i18n";

vi.mock("~/composables/useAdminLiveUpdates", () => ({
  useAdminLiveUpdates: (...args: unknown[]) => mocks.liveUpdates(...args),
}));

const mocks = vi.hoisted(() => ({
  liveUpdates: vi.fn(),
  plans: vi.fn(),
  createInvitation: vi.fn(),
  useAuth: vi.fn(),
  refresh: vi.fn(),
  navigateTo: vi.fn(),
  success: vi.fn(),
}));
vi.mock("~/services/adminService", () => ({
  adminService: {
    plans: mocks.plans,
    createInvitation: mocks.createInvitation,
  },
}));
vi.mock("~/composables/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("vue-sonner", () => ({ toast: { success: mocks.success } }));
const currentUser = ref({ staff_role: "super_admin" });
const slots = { template: "<div><slot /></div>" };
const stubs = {
  AdminPageHeader: {
    props: ["title", "description"],
    template:
      '<header><h1>{{ title }}</h1><p>{{ description }}</p><slot name="actions" /></header>',
  },
  DataTable: defineComponent({
    name: "DataTable",
    props: ["endpoint", "rowActionsFilter"],
    emits: ["row-click"],
    setup(_, { expose }) {
      expose({ refresh: mocks.refresh });
    },
    template:
      '<div><slot name="cell-name" :row="{id: \'user-1\', name: \'Anila Rao\'}" /><slot name="cell-teams" :value="[]" /></div>',
  }),
  NuxtLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
  Button: { template: "<button><slot /></button>" },
  Icon: true,
  TeamsCell: true,
  Input: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  Label: { template: "<label><slot /></label>" },
  Dialog: {
    name: "Dialog",
    props: ["open"],
    template: '<div v-if="open"><slot /></div>',
  },
  DialogContent: slots,
  DialogHeader: slots,
  DialogTitle: slots,
  DialogDescription: slots,
  DialogFooter: slots,
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
  Popover: {
    ...slots,
    name: "Popover",
    props: ["open"],
    emits: ["update:open"],
  },
  PopoverTrigger: slots,
  PopoverContent: slots,
  Calendar: {
    name: "Calendar",
    props: ["modelValue", "isDateDisabled", "locale"],
    emits: ["update:modelValue"],
    template: "<div />",
  },
};
const mountInvitations = () =>
  shallowMount(InvitationsPage, { global: { stubs } });
const openInvite = async (wrapper: ReturnType<typeof mountInvitations>) => {
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Invite user")!
    .trigger("click");
  await flushPromises();
};
const completeInvite = async (wrapper: ReturnType<typeof mountInvitations>) => {
  await wrapper.get("#invite-email").setValue("customer@example.com");
  wrapper
    .findComponent({ name: "Select" })
    .vm.$emit("update:modelValue", "pro");
  wrapper
    .findComponent({ name: "Calendar" })
    .vm.$emit("update:modelValue", new CalendarDate(2027, 1, 1));
  await flushPromises();
};

describe("admin directory pages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T23:30:00Z"));
    currentUser.value = { staff_role: "super_admin" };
    mocks.useAuth.mockReturnValue({ user: currentUser });
    mocks.plans.mockResolvedValue({
      data: [{ id: "pro", name: "Pro", monthly_pricing: 1000 }],
    });
    mocks.createInvitation.mockResolvedValue({ success: true });
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useI18n", createI18nStub);
    vi.stubGlobal("definePageMeta", vi.fn());
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("setBreadcrumbs", vi.fn());
    vi.stubGlobal("navigateTo", mocks.navigateTo);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps user search/table integration and adds a keyboard-accessible detail link", async () => {
    const wrapper = shallowMount(UsersPage, { global: { stubs } });
    expect(wrapper.get("h1").text()).toBe("Users");
    expect(wrapper.get('a[href="/admin/users/user-1"]').text()).toContain(
      "Anila Rao",
    );
    const table = wrapper.findComponent({ name: "DataTable" });
    expect(table.props("endpoint")).toBe("/admin/users/table");
    expect(table.props("rowActionsFilter")([{ name: "delete" }])).toEqual([]);
    table.vm.$emit("row-click", { id: "user-2" });
    expect(mocks.navigateTo).toHaveBeenCalledWith("/admin/users/user-2");
    expect(wrapper.find("button").exists()).toBe(false);
    await mocks.liveUpdates.mock.calls[0][0]();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("hides invitation creation and revoke actions for support staff", () => {
    currentUser.value.staff_role = "support";
    const wrapper = mountInvitations();
    expect(wrapper.get("h1").text()).toBe("Invitations");
    expect(wrapper.text()).not.toContain("Invite user");
    expect(
      wrapper.findComponent({ name: "DataTable" }).props("rowActionsFilter")([
        { name: "revoke" },
      ]),
    ).toEqual([]);
    expect(mocks.plans).not.toHaveBeenCalled();
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("updates invitations automatically when a live change arrives", async () => {
    const wrapper = mountInvitations();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual([
      "Invite user",
    ]);
    await mocks.liveUpdates.mock.calls[0][0]();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("shows plan loading failure in the form and allows retry", async () => {
    mocks.plans.mockRejectedValueOnce(new Error("offline"));
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Failed to load plans",
    );
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.get('[role="alert"] button').trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeUndefined();
  });

  it("validates required invitation inputs inline without making a request", async () => {
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get('[role="alert"]').text()).toBe("Email is required");
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("selects a future date from the calendar and closes the popover", async () => {
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    expect(wrapper.find('input[type="date"]').exists()).toBe(false);
    expect(wrapper.get("#invite-trial").text()).toBe("Select a date");
    const calendar = wrapper.findComponent({ name: "Calendar" });
    expect(
      calendar.props("isDateDisabled")(new CalendarDate(2026, 11, 8)),
    ).toBe(true);
    expect(
      calendar.props("isDateDisabled")(new CalendarDate(2026, 11, 9)),
    ).toBe(false);
    wrapper.findComponent({ name: "Popover" }).vm.$emit("update:open", true);
    calendar.vm.$emit("update:modelValue", new CalendarDate(2027, 1, 1));
    await flushPromises();
    expect(wrapper.get("#invite-trial").text()).toBe("January 1, 2027");
    expect(wrapper.findComponent({ name: "Popover" }).props("open")).toBe(
      false,
    );
    calendar.vm.$emit("update:modelValue", new CalendarDate(2026, 11, 8));
    await flushPromises();
    expect(wrapper.get("#invite-trial").text()).toBe("January 1, 2027");
  });

  it("requires a calendar date before sending an invitation", async () => {
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    await wrapper.get("#invite-email").setValue("customer@example.com");
    wrapper
      .findComponent({ name: "Select" })
      .vm.$emit("update:modelValue", "pro");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Trial end date is required",
    );
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("rejects a selected date that has elapsed before the form is submitted", async () => {
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    await completeInvite(wrapper);
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Choose a trial end date in the future.",
    );
    expect(mocks.createInvitation).not.toHaveBeenCalled();
  });

  it("retains the invitation form and inputs when the API rejects a submission", async () => {
    mocks.createInvitation.mockRejectedValueOnce({
      data: { message: "This customer already has an invitation." },
    });
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    await completeInvite(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "already has an invitation",
    );
    expect(
      (wrapper.get("#invite-email").element as HTMLInputElement).value,
    ).toBe("customer@example.com");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("sends the existing invitation contract and refreshes only after success", async () => {
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    await completeInvite(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      email: "customer@example.com",
      plan_id: "pro",
      trial_ends_at: "2027-01-01T00:00:00.000Z",
    });
    expect(wrapper.find("form").exists()).toBe(false);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not submit twice while an invitation is being sent", async () => {
    let finish!: () => void;
    mocks.createInvitation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const wrapper = mountInvitations();
    await openInvite(wrapper);
    await completeInvite(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    await wrapper.get("form").trigger("submit");
    expect(mocks.createInvitation).toHaveBeenCalledTimes(1);
    finish();
    await flushPromises();
  });
});

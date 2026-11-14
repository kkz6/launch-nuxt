import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InviteMember from "../../components/settings/InviteMember.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { error: mocks.error, success: mocks.success },
}));

const mountInvite = () =>
  shallowMount(InviteMember, {
    props: { open: true, teamId: "team" },
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        Icon: true,
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Button: { template: "<button><slot /></button>" },
      },
    },
  });

describe("team invitation form", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("$api", mocks.api);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useI18n", createI18nStub);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reports delivery failure and refreshes the saved invitation for resend", async () => {
    mocks.api.mockRejectedValueOnce({
      data: { code: "team.invitation_email_failed" },
    });
    const wrapper = mountInvite();
    await wrapper.get('input[type="email"]').setValue("invitee@example.com");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(mocks.api).toHaveBeenCalledWith("/teams/team/invitations", {
      method: "POST",
      body: { email: "invitee@example.com", role: "member" },
    });
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringContaining("Use Resend"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
    expect(wrapper.emitted("invited")).toHaveLength(1);
  });

  it("keeps the form open for other failures and reports success after retry", async () => {
    mocks.api
      .mockRejectedValueOnce({ data: { message: "Invalid invitation" } })
      .mockResolvedValueOnce({});
    const wrapper = mountInvite();
    await wrapper.get('input[type="email"]').setValue("invitee@example.com");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.error).toHaveBeenCalledWith("Invalid invitation");
    expect(wrapper.emitted("invited")).toBeUndefined();
    expect(wrapper.emitted("update:open")).toBeUndefined();

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.success).toHaveBeenCalledWith("Invitation sent");
    expect(wrapper.emitted("invited")).toHaveLength(1);
  });
});

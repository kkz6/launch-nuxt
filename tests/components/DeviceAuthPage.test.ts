import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeviceAuthPage from "../../pages/cli/auth.vue";
import messages from "../../i18n/locales/en/auth.json";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  navigateTo: vi.fn(),
  pageMeta: vi.fn(),
}));

vi.mock("~/services/deviceAuthService", () => ({
  deviceAuthService: { authorize: mocks.authorize },
}));

const user = ref({ email: "member@example.com", two_factor_enabled: false });

const mountPage = () =>
  shallowMount(DeviceAuthPage, {
    global: {
      stubs: {
        Icon: true,
        NuxtLink: { template: "<a><slot /></a>" },
        Button: { template: "<button><slot /></button>" },
        Label: { template: "<label><slot /></label>" },
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  });

const translate = (key: string, params: Record<string, string> = {}) => {
  const message =
    messages.auth.cli[
      key.replace("auth.cli.", "") as keyof typeof messages.auth.cli
    ] || key;
  return message.replace(/\{(\w+)\}/g, (_, name: string) => params[name] || "");
};

describe("CLI device authorization", () => {
  beforeEach(() => {
    mocks.authorize
      .mockReset()
      .mockResolvedValue({ data: { status: "approved" } });
    mocks.navigateTo.mockReset();
    mocks.pageMeta.mockReset();
    user.value = { email: "member@example.com", two_factor_enabled: false };
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("definePageMeta", mocks.pageMeta);
    vi.stubGlobal("useHead", vi.fn());
    vi.stubGlobal("useI18n", () => ({ t: translate }));
    vi.stubGlobal("useAuth", () => ({ user }));
    vi.stubGlobal("navigateTo", mocks.navigateTo);
    vi.stubGlobal("useRoute", () => ({
      query: { user_code: "12345678", approve: "true" },
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("requires a deliberate decision and identifies the signed-in account", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(mocks.pageMeta).toHaveBeenCalledWith({
      layout: "guest",
      middleware: "device-auth",
    });
    expect(wrapper.text()).toContain("member@example.com");
    expect(wrapper.text()).toContain("account's permissions");
    expect(
      (wrapper.get("#cli-user-code").element as HTMLInputElement).value,
    ).toBe("");
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it.each(["", "1234567", "123456789", "1234abcd"])(
    "rejects invalid user code %j",
    async (code) => {
      const wrapper = mountPage();
      await wrapper.get("#cli-user-code").setValue(code);
      await wrapper.get("form").trigger("submit");
      expect(mocks.authorize).not.toHaveBeenCalled();
      expect(wrapper.get("[role=alert]").text()).toContain(
        "8-digit numeric code",
      );
    },
  );

  it("approves the exact code including leading zeroes and returns to the terminal", async () => {
    const wrapper = mountPage();
    await wrapper.get("#cli-user-code").setValue("01234567");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.authorize).toHaveBeenCalledWith({
      user_code: "01234567",
      approve: true,
    });
    expect(wrapper.get("[role=status]").text()).toContain(
      "CLI sign-in approved",
    );
    expect(wrapper.text()).toContain("Return to your terminal");
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("denies without asking for a second-factor code", async () => {
    user.value.two_factor_enabled = true;
    mocks.authorize.mockResolvedValueOnce({ data: { status: "denied" } });
    const wrapper = mountPage();
    await wrapper.get("#cli-user-code").setValue("12345678");
    await wrapper.get('button[type="button"]').trigger("click");
    await flushPromises();
    expect(mocks.authorize).toHaveBeenCalledWith({
      user_code: "12345678",
      approve: false,
    });
    expect(wrapper.get("[role=status]").text()).toContain("CLI sign-in denied");
  });

  it("requires an authentication or recovery code when the account uses two-factor authentication", async () => {
    user.value.two_factor_enabled = true;
    const wrapper = mountPage();
    await wrapper.get("#cli-user-code").setValue("12345678");
    await wrapper.get("form").trigger("submit");
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(wrapper.get("[role=alert]").text()).toContain(
      "authentication or recovery code",
    );

    await wrapper.get("#cli-security-code").setValue("recovery-code");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.authorize).toHaveBeenCalledWith({
      user_code: "12345678",
      approve: true,
      code: "recovery-code",
    });
  });

  it("shows server validation errors and allows a corrected approval", async () => {
    mocks.authorize.mockRejectedValueOnce({
      data: { errors: { code: ["Authentication code required"] } },
    });
    const wrapper = mountPage();
    await wrapper.get("#cli-user-code").setValue("12345678");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("#cli-security-error").text()).toBe(
      "Authentication code required",
    );
    await wrapper.get("#cli-security-code").setValue("123456");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.authorize).toHaveBeenLastCalledWith({
      user_code: "12345678",
      approve: true,
      code: "123456",
    });
    expect(wrapper.text()).toContain("CLI sign-in approved");
  });

  it.each([
    { data: { errors: { user_code: ["Code is expired"] } } },
    {
      response: { status: 409 },
      data: { message: "Request already finalized" },
    },
  ])(
    "shows an expired or completed request without claiming success",
    async (error) => {
      mocks.authorize.mockRejectedValueOnce(error);
      const wrapper = mountPage();
      await wrapper.get("#cli-user-code").setValue("12345678");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(wrapper.get("[role=alert]").text()).toMatch(
        /expired|already finalized/,
      );
      expect(wrapper.find("[role=status]").exists()).toBe(false);
    },
  );

  it("prevents duplicate requests while approval is pending", async () => {
    let finish!: (result: { data: { status: string } }) => void;
    mocks.authorize.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const wrapper = mountPage();
    await wrapper.get("#cli-user-code").setValue("12345678");
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(mocks.authorize).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get('button[type="submit"]').attributes("disabled"),
    ).toBeDefined();
    finish({ data: { status: "approved" } });
    await flushPromises();
  });

  it("returns an expired browser session through login to the approval page", async () => {
    mocks.authorize.mockRejectedValueOnce({ response: { status: 401 } });
    const wrapper = mountPage();
    await wrapper.get("#cli-user-code").setValue("12345678");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/cli/auth" },
    });
  });
});

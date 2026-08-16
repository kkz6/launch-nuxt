import { flushPromises, mount } from "@vue/test-utils";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CertificateStatus from "../../components/shared/CertificateStatus.vue";
import type { CertificateStatusResult } from "../../types";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("vue-sonner", () => ({ toast }));

const status = (
  overrides: Partial<CertificateStatusResult> = {},
): CertificateStatusResult => ({
  host: "app.example.com",
  status: "valid",
  valid: true,
  message: "A valid certificate is being served for app.example.com.",
  issuer: "Let's Encrypt",
  expires_at: "2026-10-01T00:00:00Z",
  days_remaining: 45,
  checked_at: "2026-08-16T00:00:00Z",
  ...overrides,
});

const mountStatus = (
  check: () => Promise<{ data: CertificateStatusResult }>,
  retry?: () => Promise<unknown>,
  compact = false,
) =>
  mount(CertificateStatus, {
    props: { check, retry, compact },
    global: {
      stubs: {
        Icon: true,
        Badge: {
          template: "<span><slot /></span>",
        },
        Button: {
          props: ["disabled"],
          emits: ["click"],
          template:
            '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        Popover: {
          template: "<div><slot /></div>",
        },
        PopoverTrigger: {
          template: "<div><slot /></div>",
        },
        PopoverContent: {
          template: "<div><slot /></div>",
        },
      },
    },
  });

describe("CertificateStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
    vi.stubGlobal("onMounted", onMounted);
    vi.stubGlobal("ref", ref);
    vi.stubGlobal("watch", watch);
    toast.success.mockReset();
    toast.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("checks on mount and shows the served certificate details", async () => {
    const check = vi.fn().mockResolvedValue({ data: status() });
    const wrapper = mountStatus(check);
    await flushPromises();

    expect(check).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("Valid");
    expect(wrapper.text()).toContain("Let's Encrypt");
    expect(wrapper.text()).toContain("45 days");
    wrapper.unmount();
  });

  it("offers retry for a missing certificate and verifies again", async () => {
    const missing = status({
      status: "not_issued",
      valid: false,
      message: "No TLS certificate could be retrieved.",
      issuer: undefined,
      expires_at: undefined,
      days_remaining: undefined,
    });
    const check = vi.fn().mockResolvedValue({ data: missing });
    const retry = vi.fn().mockResolvedValue({ data: null });
    const wrapper = mountStatus(check, retry);
    await flushPromises();

    expect(wrapper.text()).toContain("Not issued");
    const retryButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Retry certificate"));
    expect(retryButton).toBeDefined();
    await retryButton!.trigger("click");
    await flushPromises();

    expect(retry).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(12_000);
    await flushPromises();
    expect(check).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("shows a clear diagnosis beside an invalid compact badge", async () => {
    const check = vi.fn().mockResolvedValue({
      data: status({
        status: "invalid",
        valid: false,
        message: "The server is not presenting a certificate for this hostname.",
      }),
    });
    const wrapper = mountStatus(check, undefined, true);
    await flushPromises();

    expect(wrapper.text()).toContain("Invalid");
    expect(wrapper.text()).toContain("Hostname does not match");
    expect(wrapper.text()).toContain(
      "The proxy is serving a certificate for another hostname.",
    );
    wrapper.unmount();
  });
});

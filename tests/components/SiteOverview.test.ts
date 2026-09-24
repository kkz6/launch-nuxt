import { shallowMount } from "@vue/test-utils";
import { computed } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SiteOverview from "../../components/site/Overview.vue";
import { createI18nStub } from "../helpers/i18n";

beforeEach(() => {
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useI18n", () => createI18nStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("site overview", () => {
  it("renders the human-readable PHP 8.4 label", () => {
    const wrapper = shallowMount(SiteOverview, {
      props: {
        server: { id: "server-1" } as never,
        site: {
          id: "site-1",
          type: "laravel",
          php_version: "php84",
          tls_setting: "auto",
        } as never,
      },
      global: {
        stubs: { Icon: true },
      },
    });

    expect(wrapper.text()).toContain("PHP 8.4");
    expect(wrapper.text()).not.toContain("php84");
  });
});

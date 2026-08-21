import { shallowMount } from "@vue/test-utils";
import { computed } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QueueFailureBanner from "../../components/dashboard/QueueFailureBanner.vue";

const queue = (id: string) => ({
  id,
  name: `queue-${id}`,
  connection: "redis",
  site_id: `site-${id}`,
  site_name: `site-${id}.test`,
  server_id: `server-${id}`,
  server_name: `Server ${id}`,
  last_status_check: "2026-08-20T00:00:00Z",
});

const mountBanner = (queues: ReturnType<typeof queue>[]) =>
  shallowMount(QueueFailureBanner, {
    props: { queues },
    global: {
      stubs: {
        Alert: { template: "<section><slot /></section>" },
        AlertTitle: { template: "<h2><slot /></h2>" },
        AlertDescription: { template: "<div><slot /></div>" },
        Icon: true,
        NuxtLink: {
          props: ["to"],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });

describe("QueueFailureBanner", () => {
  beforeEach(() => {
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("useI18n", () => ({
      t: (key: string, params?: { count?: number }) =>
        params?.count === undefined ? key : `${key}:${params.count}`,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays hidden when every queue is healthy", () => {
    const wrapper = mountBanner([]);
    expect(wrapper.find("section").exists()).toBe(false);
  });

  it("shows stopped queues with links to their queue tabs", () => {
    const wrapper = mountBanner([queue("1"), queue("2"), queue("3"), queue("4")]);
    expect(wrapper.text()).toContain("public.dashboard.queueFailure.title:4");
    expect(wrapper.findAll("a")).toHaveLength(3);
    expect(wrapper.find("a").attributes("href")).toBe(
      "/servers/server-1/sites/site-1?tab=queues",
    );
    expect(wrapper.text()).toContain("public.dashboard.queueFailure.more:1");
  });
});

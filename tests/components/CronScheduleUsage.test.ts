import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, onMounted, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationSchedules from "../../components/application/Schedules.vue";
import ShowSchedulers from "../../components/server/ShowSchedulers.vue";

const mocks = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  api: vi.fn(),
}));

vi.mock("~/services/dockerService", () => ({
  dockerService: {
    applications: {
      listSchedules: mocks.listSchedules,
      deleteSchedule: vi.fn(),
    },
  },
}));

const dataTableStub = {
  props: ["data"],
  template:
    '<div><slot v-if="data.length" name="cell-frequency" :row="data[0]" /></div>',
};

const cronScheduleStub = {
  props: ["expression", "timeZone"],
  template:
    '<span data-testid="cron-schedule">{{ expression }}|{{ timeZone }}</span>',
};

beforeEach(() => {
  mocks.listSchedules.mockReset().mockResolvedValue({
    data: [
      {
        id: "schedule-1",
        cron: "0 3 * * *",
        command: "php artisan queue:prune-batches",
      },
    ],
  });
  mocks.api.mockReset().mockResolvedValue({
    data: [
      {
        id: "cron-1",
        expression: "0 2 * * *",
        frequency: "daily_2am",
        command: "php artisan schedule:run",
      },
    ],
  });
  vi.stubGlobal("$api", mocks.api);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useAuth", () => ({
    user: ref({ current_team_id: "team-1" }),
  }));
  vi.stubGlobal("useDockerApplicationEvents", vi.fn());
  vi.stubGlobal("useServerModelEvents", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cron schedule usage", () => {
  it("uses the common component for application schedules in UTC", async () => {
    const wrapper = shallowMount(ApplicationSchedules, {
      props: {
        application: {
          id: "application-1",
          server_id: "server-1",
          project_id: "project-1",
        } as never,
      },
      global: {
        stubs: {
          ApplicationCreateSchedule: true,
          Button: true,
          Dialog: true,
          Icon: true,
          ServerLogViewer: true,
          SharedConfirmationDialog: true,
          SharedCronSchedule: cronScheduleStub,
          SharedDataTable: dataTableStub,
          SharedDateTooltip: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-testid="cron-schedule"]').text()).toBe(
      "0 3 * * *|UTC",
    );
  });

  it("uses the common component for server schedulers", async () => {
    const wrapper = shallowMount(ShowSchedulers, {
      props: { server: { id: "server-1" } as never },
      global: {
        stubs: {
          Dialog: true,
          Icon: true,
          ServerCreateScheduler: true,
          ServerLogViewer: true,
          SharedConfirmationDialog: true,
          SharedCronSchedule: cronScheduleStub,
          SharedDataTable: dataTableStub,
          SharedInstallationStatus: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-testid="cron-schedule"]').text()).toBe(
      "0 2 * * *|",
    );
  });
});

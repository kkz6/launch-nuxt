import { flushPromises, shallowMount } from "@vue/test-utils";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Services from "../../components/server/settings/Services.vue";
import SiteSettings from "../../components/site/Settings.vue";
import type { Site } from "../../types";
import { createI18nStub } from "../helpers/i18n";

type EventHandler = (
  data: Record<string, unknown>,
  eventName: string,
) => void | Promise<void>;

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  serviceEventHandler: null as EventHandler | null,
  siteEventHandler: null as EventHandler | null,
  resetField: vi.fn(),
  resetForm: vi.fn(),
  setFieldError: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

vi.mock("@vueuse/core", () => ({
  useIntervalFn: vi.fn(() => ({
    pause: mocks.pause,
    resume: mocks.resume,
  })),
}));

vi.mock("vee-validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vee-validate")>();
  return {
    ...actual,
    useForm: () => ({
      handleSubmit: (callback: unknown) => callback,
      resetField: mocks.resetField,
      resetForm: mocks.resetForm,
      setFieldError: mocks.setFieldError,
    }),
  };
});

vi.mock("@vee-validate/zod", () => ({
  toTypedSchema: (schema: unknown) => schema,
}));

vi.mock("~/services/serverService", () => ({
  serverService: {
    sites: {
      checkCertificate: vi.fn(),
      retryCertificate: vi.fn(),
    },
  },
}));

vi.mock("~/composables/useStableMetadataLabels", () => ({
  useStableMetadataLabels: () => ({ getLogName: (value: string) => value }),
}));

const setupRef = <T>(
  wrapper: ReturnType<typeof shallowMount>,
  key: string,
): T =>
  (
    wrapper.vm.$ as unknown as {
      devtoolsRawSetupState: Record<string, { value: T }>;
    }
  ).devtoolsRawSetupState[key].value;

const siteFixture = (): Site => ({
  id: "site-1",
  server_id: "server-1",
  user_id: "user-1",
  source_control_id: "source-1",
  address: "example.test",
  name: "Example",
  type: "laravel",
  tls_setting: "auto",
  zero_downtime_deployment: false,
  deployment_releases_retention: 5,
  deploy_token: "token",
  user: "launch",
  path: "/home/launch/example.test",
  web_folder: "public",
  app_directory: "/home/launch/example.test/current",
  php_version: "php83",
  pending_php_version: null,
  shared_directories: [],
  writeable_directories: [],
  shared_files: [],
  url: "https://example.test",
  created_at: "2026-09-17T00:00:00Z",
  updated_at: "2026-09-17T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.serviceEventHandler = null;
  mocks.siteEventHandler = null;
  mocks.api.mockResolvedValue({ data: [] });

  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("onMounted", onMounted);
  vi.stubGlobal("onBeforeUnmount", onBeforeUnmount);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useAuth", () => ({
    user: ref({ current_team_id: "team-1" }),
  }));
  vi.stubGlobal("useCan", () => ({ canDelete: computed(() => true) }));
  vi.stubGlobal("useServiceStatus", () => ({
    services: ref([]),
    isConnected: ref(true),
    isConnecting: ref(false),
    error: ref(null),
    lastUpdated: ref(null),
    reconnect: vi.fn(),
  }));
  vi.stubGlobal("useServiceEvents", (_teamId: unknown, handler: EventHandler) => {
    mocks.serviceEventHandler = handler;
  });
  vi.stubGlobal("useSiteEvents", (_teamId: unknown, handler: EventHandler) => {
    mocks.siteEventHandler = handler;
  });
  vi.stubGlobal("$api", mocks.api);
  vi.stubGlobal("navigateTo", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PHP lifecycle websocket handling", () => {
  it("keeps the queued server patch log available and opens it on failure", async () => {
    let serviceStatus = "running";
    mocks.api.mockImplementation(async (url: string) => {
      if (url.endsWith("/services")) {
        return {
          data: [
            {
              id: "php-84",
              server_id: "server-1",
              type: "php",
              type_label: "PHP",
              name: "PHP 8.4",
              version: "8.4.11",
              status: serviceStatus,
              status_label: serviceStatus,
              is_default: true,
              software: "php84",
              software_label: "PHP 8.4",
              created_at: "2026-09-17T00:00:00Z",
              updated_at: "2026-09-17T00:00:00Z",
            },
          ],
        };
      }
      return { data: [] };
    });
    const wrapper = shallowMount(Services, {
      props: { serverId: "server-1", serverType: "php" },
      global: {
        stubs: {
          Icon: true,
          SharedConfirmationDialog: true,
          ServerSettingsInstallServiceDialog: true,
          ServerSettingsPhpExtensionsDialog: true,
          ServerSettingsPhpOpcacheDialog: true,
          ServerSettingsPhpConfigEditorDialog: true,
          ServerSettingsServiceStatusDialog: true,
          ServerLogViewer: true,
        },
      },
    });
    await flushPromises();
    expect(mocks.serviceEventHandler).toBeTypeOf("function");

    serviceStatus = "updating";
    mocks.serviceEventHandler?.(
      {
        server_id: "server-1",
        service_id: "php-84",
        task_id: "task-patch-1",
        status: "queued",
        version: "8.4",
      },
      "php.patch",
    );
    await flushPromises();

    expect(
      setupRef<Set<string>>(wrapper, "patchingServiceIds").has("php-84"),
    ).toBe(true);
    expect(
      setupRef<Map<string, { taskId: string }>>(
        wrapper,
        "phpPatchLogsByService",
      ).get("php-84")?.taskId,
    ).toBe("task-patch-1");

    serviceStatus = "running";
    mocks.serviceEventHandler?.(
      {
        server_id: "server-1",
        service_id: "php-84",
        task_id: "task-patch-1",
        status: "failed",
        version: "8.4",
        output: "apt upgrade failed",
      },
      "php.patch",
    );
    await flushPromises();

    expect(
      setupRef<Set<string>>(wrapper, "patchingServiceIds").has("php-84"),
    ).toBe(false);
    expect(setupRef<boolean>(wrapper, "isTaskLogSheetOpen")).toBe(true);
    expect(
      setupRef<{ taskId: string; error?: string }>(wrapper, "selectedTaskLog"),
    ).toMatchObject({ taskId: "task-patch-1", error: "apt upgrade failed" });
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining("apt upgrade failed"),
    );
  });

  it("refreshes site PHP state and reports a failed runtime switch", async () => {
    const originalSite = siteFixture();
    let apiSite: Site = originalSite;
    mocks.api.mockImplementation(async (url: string) => {
      if (url.endsWith("/settings")) {
        return {
          data: {
            site: apiSite,
            php_versions: [
              { value: "php83", label: "PHP 8.3", is_default: true },
              { value: "php84", label: "PHP 8.4", is_default: false },
            ],
            tls_options: [],
            source_control: null,
            repository: null,
          },
        };
      }
      return { data: {} };
    });

    const wrapper = shallowMount(SiteSettings, {
      props: { serverId: "server-1", site: originalSite },
      global: {
        stubs: {
          Icon: true,
          SharedConfirmationDialog: true,
          SharedCertificateStatus: true,
          SiteUpdateSsl: true,
          SiteDeploymentSettings: true,
        },
      },
    });
    await flushPromises();
    expect(mocks.siteEventHandler).toBeTypeOf("function");

    apiSite = { ...originalSite, pending_php_version: "php84" };
    await mocks.siteEventHandler?.(
      { site_id: "site-1", php_version: "php84", task_id: "task-site-1" },
      "site.php_version_update_requested",
    );
    expect(setupRef<string | null>(wrapper, "pendingPhpVersion")).toBe(
      "php84",
    );
    expect(mocks.resetField).toHaveBeenCalledWith("php_version", {
      value: "php84",
    });

    apiSite = { ...originalSite, pending_php_version: null };
    await mocks.siteEventHandler?.(
      {
        site_id: "site-1",
        php_version: "php84",
        task_id: "task-site-1",
        error: "PHP-FPM reload failed",
      },
      "site.php_version_update_failed",
    );
    await nextTick();

    expect(setupRef<string | null>(wrapper, "pendingPhpVersion")).toBeNull();
    expect(mocks.resetField).toHaveBeenCalledWith("php_version", {
      value: "php83",
    });
    expect(mocks.toastError).toHaveBeenCalledWith("PHP-FPM reload failed");
    expect(wrapper.emitted("updated")).toHaveLength(1);
    expect(
      mocks.api.mock.calls.filter(([url]) =>
        String(url).endsWith("/settings"),
      ),
    ).toHaveLength(3);
  });
});

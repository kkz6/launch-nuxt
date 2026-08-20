import { shallowMount } from "@vue/test-utils";
import { computed, nextTick, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProvisionLogsSheet from "../../components/server/ProvisionLogsSheet.vue";
import PhpExtensionsDialog from "../../components/server/settings/PhpExtensionsDialog.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  getProvisionStatus: vi.fn(),
  retryProvision: vi.fn(),
  openSettingsSheet: vi.fn(),
  phpExtensionEvents: vi.fn(),
}));

vi.mock("~/services/serverService", () => ({
  serverService: {
    getProvisionStatus: mocks.getProvisionStatus,
    retryProvision: mocks.retryProvision,
  },
}));

vi.mock("~/stores/useServersStore", () => ({
  useServersStore: () => ({ servers: [] }),
}));

vi.mock("~/composables/useChannelEvents", () => ({
  usePhpExtensionEvents: mocks.phpExtensionEvents,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const passthroughStub = { template: "<div><slot /></div>" };

const setupRef = (
  wrapper: ReturnType<typeof shallowMount>,
  key: string,
  value: unknown,
) => {
  (
    wrapper.vm.$ as unknown as {
      devtoolsRawSetupState: Record<string, { value: unknown }>;
    }
  ).devtoolsRawSetupState[key].value = value;
};

beforeEach(() => {
  mocks.getProvisionStatus.mockReset();
  mocks.retryProvision.mockReset();
  mocks.openSettingsSheet.mockReset();
  mocks.phpExtensionEvents.mockReset();

  vi.stubGlobal("computed", computed);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useI18n", () => createI18nStub("ja"));
  vi.stubGlobal("useSettingsSheet", () => ({
    open: mocks.openSettingsSheet,
  }));
  vi.stubGlobal("$api", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stable-value Japanese translations", () => {
  it("renders provisioning errors and steps from stable codes, not backend English", async () => {
    const wrapper = shallowMount(ProvisionLogsSheet, {
      props: {
        open: true,
        server: {
          id: "server-1",
          name: "Tokyo server",
          status: "failed",
          provider: "custom_server",
        } as never,
      },
      global: {
        stubs: {
          Icon: true,
          Button: passthroughStub,
          ServerLogViewer: true,
          Sheet: passthroughStub,
          SheetContent: passthroughStub,
          SheetDescription: passthroughStub,
          SheetHeader: passthroughStub,
          SheetTitle: passthroughStub,
        },
      },
    });

    setupRef(wrapper, "provisionStatus", {
      failed: true,
      error_code: "disk_space",
      error_message: "Backend English: the disk is full",
      steps: [
        {
          name: "install_docker",
          description: "Backend English: install Docker",
          status: "current",
        },
        {
          name: "configure_firewall",
          description: "Backend English: configure firewall",
          status: "pending",
        },
      ],
    });
    await nextTick();

    const text = wrapper.text();
    expect(text).toContain(
      "セットアップ中にサーバーのディスク容量が不足しました。容量を拡張するか、より大きなプランを選択してもう一度お試しください。",
    );
    expect(text).toContain(
      "Docker CE、Composeプラグイン、Buildxをインストールします",
    );
    expect(text).toContain(
      "デフォルトルール（SSH、HTTP、HTTPS）でファイアウォールを設定します",
    );
    expect(text).not.toContain("Backend English");
  });

  it("renders and searches PHP extensions by Japanese stable-value descriptions", async () => {
    const wrapper = shallowMount(PhpExtensionsDialog, {
      props: {
        open: true,
        serverId: "server-1",
        service: {
          key: "php84",
          display_name: "PHP 8.4",
          version: "8.4",
          is_installed: true,
          is_default: true,
          details: {
            id: "php-service-1",
            server_id: "server-1",
            type: "php",
            name: "PHP 8.4",
            version: "8.4",
            status: "installed",
            software: "php",
            extensions: [
              {
                value: "intl",
                label: "Intl extension",
                description: "Backend English: internationalization",
                status: "available",
                is_installed: false,
                is_pending: false,
              },
              {
                value: "curl",
                label: "cURL extension",
                description: "Backend English: URL transfers",
                status: "available",
                is_installed: false,
                is_pending: false,
              },
            ],
          },
        },
      },
      global: {
        stubs: {
          Icon: true,
          Badge: passthroughStub,
          Button: passthroughStub,
          Dialog: passthroughStub,
          DialogContent: passthroughStub,
          DialogDescription: passthroughStub,
          DialogHeader: passthroughStub,
          DialogTitle: passthroughStub,
          AlertDialog: passthroughStub,
          AlertDialogAction: passthroughStub,
          AlertDialogCancel: passthroughStub,
          AlertDialogContent: passthroughStub,
          AlertDialogDescription: passthroughStub,
          AlertDialogFooter: passthroughStub,
          AlertDialogHeader: passthroughStub,
          AlertDialogTitle: passthroughStub,
          Input: {
            props: ["modelValue", "placeholder"],
            emits: ["update:modelValue"],
            template:
              '<input data-testid="extension-search" :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain("国際化機能");
    expect(wrapper.text()).toContain("URL転送ライブラリ");
    expect(wrapper.text()).not.toContain("Backend English");

    await wrapper.get('[data-testid="extension-search"]').setValue("国際化");

    expect(wrapper.text()).toContain("Intl extension");
    expect(wrapper.text()).toContain("国際化機能");
    expect(wrapper.text()).not.toContain("cURL extension");
  });
});

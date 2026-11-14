import { flushPromises, shallowMount } from "@vue/test-utils";
import { computed, ref, watch } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AddDnsProvider from "../../components/settings/AddDnsProvider.vue";
import AddStorageProvider from "../../components/settings/AddStorageProvider.vue";
import AddServerProvider from "../../components/settings/AddServerProvider.vue";
import { createI18nStub } from "../helpers/i18n";

const api = vi.fn().mockResolvedValue({});
vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  api.mockClear();
  vi.stubGlobal("$api", api);
  vi.stubGlobal("ref", ref);
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("watch", watch);
  vi.stubGlobal("useI18n", createI18nStub);
});

afterEach(() => vi.unstubAllGlobals());

const renderForm = async (
  component:
    | typeof AddDnsProvider
    | typeof AddStorageProvider
    | typeof AddServerProvider,
  provider: string,
  fields: Record<string, string>,
) => {
  const wrapper = shallowMount(component, {
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        Icon: true,
        Select: {
          props: ["modelValue"],
          template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
        },
        SelectTrigger: true,
        SelectContent: { template: "<slot />" },
        SelectItem: {
          props: ["value"],
          template: '<option :value="value">{{ value }}</option>',
        },
        Input: {
          props: ["modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
      },
    },
  });
  await wrapper.get("select").setValue(provider);
  for (const [id, value] of Object.entries(fields)) {
    await wrapper.get(`input#${id}`).setValue(value);
  }
  await wrapper.get("form").trigger("submit");
  await flushPromises();
  return wrapper;
};

it("sends Cloudflare's account ID along with the DNS profile and token", async () => {
  const wrapper = await renderForm(AddDnsProvider, "cloudflare", {
    label: "Production DNS",
    api_token: "test-token",
    account_id: "test-account",
  });
  expect(api).toHaveBeenCalledWith("/dns-providers", {
    method: "POST",
    body: {
      provider: "cloudflare",
      profile: "Production DNS",
      token: "test-token",
      account_id: "test-account",
    },
  });
  expect(wrapper.emitted("created")).toHaveLength(1);
});

it("connects Contabo using the four API credentials", async () => {
  const wrapper = await renderForm(AddServerProvider, "contabo", {
    profile: "Contabo account",
    "contabo-client_id": "client-id",
    "contabo-client_secret": "client-secret",
    "contabo-api_user": "contabo@example.com",
    "contabo-api_password": "api-password",
  });
  expect(api).toHaveBeenCalledWith("/server-providers", {
    method: "POST",
    body: {
      provider: "contabo",
      profile: "Contabo account",
      client_id: "client-id",
      client_secret: "client-secret",
      api_user: "contabo@example.com",
      api_password: "api-password",
    },
  });
  expect(wrapper.emitted("created")).toHaveLength(1);
});

it("sends Spaces as an S3 connection with its regional endpoint", async () => {
  const wrapper = await renderForm(AddStorageProvider, "spaces", {
    label: "Backup storage",
    access_key: "test-key",
    secret_key: "test-secret",
    bucket: "test-bucket",
    region: "ams3",
  });
  expect(api).toHaveBeenCalledWith("/storage-providers", {
    method: "POST",
    body: {
      provider: "s3",
      label: "Backup storage",
      key: "test-key",
      secret: "test-secret",
      bucket: "test-bucket",
      region: "ams3",
      endpoint: "https://ams3.digitaloceanspaces.com",
    },
  });
  expect(wrapper.emitted("created")).toHaveLength(1);
});

it("sends only token credentials for Dropbox", async () => {
  const wrapper = await renderForm(AddStorageProvider, "dropbox", {
    label: "Dropbox backups",
    token: "test-token",
  });
  expect(api).toHaveBeenCalledWith("/storage-providers", {
    method: "POST",
    body: {
      provider: "dropbox",
      label: "Dropbox backups",
      token: "test-token",
    },
  });
  expect(wrapper.emitted("created")).toHaveLength(1);
});

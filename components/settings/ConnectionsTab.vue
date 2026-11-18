<script setup lang="ts">
import { reactive, toRefs } from "vue";
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import GitConnections from "~/components/settings/GitConnections.vue";
import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import { certificateService } from "~/services/certificateService";
import type { CertificateUsage, StoredCertificate } from "~/types";
import {
  dockerService,
  type DockerRegistryCredential,
} from "~/services/dockerService";

const { locale, t } = useI18n();
const dateLocale = computed(() => (locale.value === "ja" ? ja : enUS));

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

interface ServerProvider {
  id: string;
  profile: string;
  provider: string;
  connected: boolean;
  created_at: string;
}

const serverProviderLabels: Record<string, string> = {
  aws: "Amazon Web Services",
  digitalocean: "DigitalOcean",
  linode: "Linode",
  vultr: "Vultr",
  hetzner: "Hetzner",
  contabo: "Contabo",
  custom: "settings.connections.customProvider",
};

const serverProviderLabel = (provider: string) => {
  const label = serverProviderLabels[provider];
  if (!label) return provider;
  return label.startsWith("settings.") ? t(label) : label;
};
const serverProviderIcons: Record<string, string> = {
  aws: "simple-icons:amazonaws",
  digitalocean: "simple-icons:digitalocean",
  linode: "simple-icons:linode",
  vultr: "simple-icons:vultr",
  hetzner: "simple-icons:hetzner",
  custom: "lucide:server",
};

interface StorageProvider {
  id: string;
  label: string;
  provider: string;
  created_at: string;
}

const storageProviderLabels: Record<string, string> = {
  s3: "S3-compatible storage",
  dropbox: "Dropbox",
  spaces: "DigitalOcean Spaces",
  backblaze: "Backblaze B2",
  wasabi: "Wasabi",
};
const storageProviderIcons: Record<string, string> = {
  s3: "simple-icons:amazons3",
  dropbox: "simple-icons:dropbox",
  spaces: "simple-icons:digitalocean",
  backblaze: "simple-icons:backblaze",
  wasabi: "lucide:database",
};

interface DnsProvider {
  id: string;
  profile: string;
  provider: string;
  created_at: string;
}

interface ConnectionsState {
  isServerProvidersLoading: boolean;
  isStorageProvidersLoading: boolean;
  isDnsProvidersLoading: boolean;
  isStoredCertificatesLoading: boolean;
  serverProviders: ServerProvider[];
  storageProviders: StorageProvider[];
  dnsProviders: DnsProvider[];
  storedCertificates: StoredCertificate[];
  isAddCertificateOpen: boolean;
  editingCertificate: StoredCertificate | undefined;
  isEditCertificateOpen: boolean;
  registryCredentials: DockerRegistryCredential[];
  isRegistryCredentialsLoading: boolean;
  editingRegistryCredential: DockerRegistryCredential | undefined;
  isRegistryDialogOpen: boolean;
}

const state = reactive({
  isServerProvidersLoading: true,
  isStorageProvidersLoading: true,
  isDnsProvidersLoading: true,
  isStoredCertificatesLoading: true,
  serverProviders: [],
  storageProviders: [],
  dnsProviders: [],
  storedCertificates: [],
  isAddCertificateOpen: false,
  editingCertificate: undefined,
  isEditCertificateOpen: false,
  registryCredentials: [],
  isRegistryCredentialsLoading: true,
  editingRegistryCredential: undefined,
  isRegistryDialogOpen: false,
}) as ConnectionsState;

const {
  isServerProvidersLoading,
  isStorageProvidersLoading,
  isDnsProvidersLoading,
  isStoredCertificatesLoading,
  serverProviders,
  storageProviders,
  dnsProviders,
  storedCertificates,
  isAddCertificateOpen,
  editingCertificate,
  isEditCertificateOpen,
  registryCredentials,
  isRegistryCredentialsLoading,
  editingRegistryCredential,
  isRegistryDialogOpen,
} = toRefs(state);

const dnsProviderLabels: Record<string, string> = {
  cloudflare: "Cloudflare",
  route53: "Amazon Route 53",
  digitalocean: "DigitalOcean DNS",
};
const dnsProviderIcons: Record<string, string> = {
  cloudflare: "simple-icons:cloudflare",
  route53: "simple-icons:amazonaws",
  digitalocean: "simple-icons:digitalocean",
};

const fetchServerProviders = async () => {
  try {
    const response = await $api<{ data: ServerProvider[] }>(
      "/server-providers",
    );
    serverProviders.value = response.data;
  } catch {
    toast.error(t("settings.connections.server.loadFailed"));
  } finally {
    isServerProvidersLoading.value = false;
  }
};

const fetchStorageProviders = async () => {
  try {
    const response = await $api<{ data: StorageProvider[] }>(
      "/storage-providers",
    );
    storageProviders.value = response.data;
  } catch {
    toast.error(t("settings.connections.storage.loadFailed"));
  } finally {
    isStorageProvidersLoading.value = false;
  }
};

const fetchDnsProviders = async () => {
  try {
    const response = await $api<{ data: DnsProvider[] }>("/dns-providers");
    dnsProviders.value = response.data;
  } catch {
    toast.error(t("settings.connections.dns.loadFailed"));
  } finally {
    isDnsProvidersLoading.value = false;
  }
};

const deleteServerProvider = async (provider: ServerProvider) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.connections.server.deleteTitle"),
    description: t("settings.connections.server.deleteDescription", {
      name: provider.profile,
    }),
    confirmText: t("settings.connections.delete"),
    cancelText: t("settings.connections.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/server-providers/${provider.id}`, { method: "DELETE" });
      serverProviders.value = serverProviders.value.filter(
        (p) => p.id !== provider.id,
      );
      toast.success(t("settings.connections.server.deleted"));
    } catch {
      toast.error(t("settings.connections.server.deleteFailed"));
    }
  }
};

const deleteStorageProvider = async (provider: StorageProvider) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.connections.storage.deleteTitle"),
    description: t("settings.connections.storage.deleteDescription", {
      name: provider.label,
    }),
    confirmText: t("settings.connections.delete"),
    cancelText: t("settings.connections.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/storage-providers/${provider.id}`, { method: "DELETE" });
      storageProviders.value = storageProviders.value.filter(
        (p) => p.id !== provider.id,
      );
      toast.success(t("settings.connections.storage.deleted"));
    } catch {
      toast.error(t("settings.connections.storage.deleteFailed"));
    }
  }
};

const deleteDnsProvider = async (provider: DnsProvider) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.connections.dns.deleteTitle"),
    description: t("settings.connections.dns.deleteDescription", {
      name: provider.profile,
    }),
    confirmText: t("settings.connections.delete"),
    cancelText: t("settings.connections.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/dns-providers/${provider.id}`, { method: "DELETE" });
      dnsProviders.value = dnsProviders.value.filter(
        (p) => p.id !== provider.id,
      );
      toast.success(t("settings.connections.dns.deleted"));
    } catch {
      toast.error(t("settings.connections.dns.deleteFailed"));
    }
  }
};

const fetchStoredCertificates = async () => {
  isStoredCertificatesLoading.value = true;
  try {
    const res = await certificateService.list();
    storedCertificates.value = res.data;
  } catch {
    toast.error(t("settings.connections.certificates.loadFailed"));
  } finally {
    isStoredCertificatesLoading.value = false;
  }
};

const editCertificate = (cert: StoredCertificate) => {
  editingCertificate.value = cert;
  isEditCertificateOpen.value = true;
};

const viewExistingCertificate = async (id: string) => {
  const existing = storedCertificates.value.find((c) => c.id === id);
  if (existing) {
    editCertificate(existing);
    return;
  }
  try {
    const res = await certificateService.get(id);
    editCertificate(res.data);
  } catch {
    toast.error(t("settings.connections.certificates.openFailed"));
  }
};

const handleCertificateCreated = (cert: StoredCertificate) => {
  storedCertificates.value = [cert, ...storedCertificates.value];
};

const handleCertificateUpdated = (cert: StoredCertificate) => {
  storedCertificates.value = storedCertificates.value.map((c) =>
    c.id === cert.id ? cert : c,
  );
};

const certificateExpiryInfo = (cert: StoredCertificate) => {
  const notAfter = new Date(cert.not_after);
  const daysUntil = differenceInDays(notAfter, new Date());
  let label: string;
  if (daysUntil < 0) {
    label = t("settings.connections.certificates.expired", {
      time: formatDistanceToNow(notAfter, {
        addSuffix: true,
        locale: dateLocale.value,
      }),
    });
  } else if (daysUntil <= 90) {
    label = t("settings.connections.certificates.expiresRelative", {
      time: formatDistanceToNow(notAfter, {
        addSuffix: true,
        locale: dateLocale.value,
      }),
    });
  } else {
    label = t("settings.connections.certificates.expiresDate", {
      date: format(notAfter, "PP", { locale: dateLocale.value }),
    });
  }
  let className = "text-muted-foreground";
  if (daysUntil < 0) {
    className = "text-destructive";
  } else if (daysUntil <= 30) {
    className = "text-amber-600 dark:text-amber-400";
  }
  return { label, className };
};

const certificatePrimaryDomain = (cert: StoredCertificate): string => {
  if (cert.common_name && cert.common_name.trim()) return cert.common_name;
  if (cert.domains && cert.domains.length > 0) return cert.domains[0];
  return cert.name;
};

const certificateSubtitleSegments = (cert: StoredCertificate): string[] => {
  const segments: string[] = [certificatePrimaryDomain(cert)];
  if (cert.issuer && cert.issuer.trim()) segments.push(cert.issuer);
  return segments;
};

const deleteCertificate = async (
  cert: StoredCertificate,
  opts: { force?: boolean } = {},
) => {
  if (!confirmationDialog.value) return;

  if (!opts.force) {
    const result = await confirmationDialog.value.show({
      title: t("settings.connections.certificates.deleteTitle"),
      description: t("settings.connections.certificates.deleteDescription", {
        name: cert.name,
      }),
      confirmText: t("settings.connections.delete"),
      cancelText: t("settings.connections.cancel"),
      destructive: true,
    });
    if (!result.ok) return;
  }

  try {
    await certificateService.delete(cert.id, opts);
    storedCertificates.value = storedCertificates.value.filter(
      (c) => c.id !== cert.id,
    );
    toast.success(
      opts.force
        ? t("settings.connections.certificates.forceDeleted")
        : t("settings.connections.certificates.deleted"),
    );
  } catch (err: unknown) {
    const e = err as {
      response?: { status?: number };
      data?: { message?: string; usages?: CertificateUsage[] };
    };

    if (e.response?.status === 409 && e.data?.usages?.length) {
      const usages = e.data.usages;
      const siteCount = usages.filter((u) => u.kind === "site").length;
      const domainCount = usages.filter(
        (u) => u.kind === "docker_domain",
      ).length;
      const parts: string[] = [];
      if (siteCount > 0)
        parts.push(
          siteCount === 1
            ? t("settings.connections.certificates.siteCountOne", {
                count: siteCount,
              })
            : t("settings.connections.certificates.siteCountOther", {
                count: siteCount,
              }),
        );
      if (domainCount > 0)
        parts.push(
          domainCount === 1
            ? t("settings.connections.certificates.domainCountOne", {
                count: domainCount,
              })
            : t("settings.connections.certificates.domainCountOther", {
                count: domainCount,
              }),
        );
      const usedBy = parts.join(
        t("settings.connections.certificates.usageSeparator"),
      );

      if (!confirmationDialog.value) return;
      const forceResult = await confirmationDialog.value.show({
        title: t("settings.connections.certificates.inUseTitle"),
        description: t("settings.connections.certificates.inUseDescription", {
          name: cert.name,
          usedBy,
        }),
        confirmText: t("settings.connections.certificates.forceDelete"),
        cancelText: t("settings.connections.cancel"),
        destructive: true,
        warning:
          usages
            .slice(0, 5)
            .map((u) =>
              t(
                u.kind === "site"
                  ? "settings.connections.certificates.siteUsage"
                  : "settings.connections.certificates.domainUsage",
                { name: u.name },
              ),
            )
            .join(" · ") +
          (usages.length > 5
            ? t("settings.connections.certificates.moreUsages", {
                count: usages.length - 5,
              })
            : ""),
      });
      if (forceResult.ok) {
        await deleteCertificate(cert, { force: true });
      }
      return;
    }

    toast.error(
      e.data?.message || t("settings.connections.certificates.deleteFailed"),
    );
  }
};

const fetchRegistryCredentials = async () => {
  isRegistryCredentialsLoading.value = true;
  try {
    const res = await dockerService.registryCredentials.list();
    registryCredentials.value = res.data;
  } catch {
    toast.error(t("settings.connections.registry.loadFailed"));
  } finally {
    isRegistryCredentialsLoading.value = false;
  }
};

const openCreateRegistryDialog = () => {
  editingRegistryCredential.value = undefined;
  isRegistryDialogOpen.value = true;
};

const editRegistryCredential = (c: DockerRegistryCredential) => {
  editingRegistryCredential.value = c;
  isRegistryDialogOpen.value = true;
};

const handleRegistryDialogClosed = () => {
  editingRegistryCredential.value = undefined;
};

const deleteRegistryCredential = async (c: DockerRegistryCredential) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("settings.connections.registry.deleteTitle"),
    description: t("settings.connections.registry.deleteDescription", {
      name: c.name,
    }),
    confirmText: t("settings.connections.delete"),
    cancelText: t("settings.connections.cancel"),
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.registryCredentials.delete(c.id);
    registryCredentials.value = registryCredentials.value.filter(
      (x) => x.id !== c.id,
    );
    toast.success(t("settings.connections.registry.deleted"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("settings.connections.registry.deleteFailed"),
    );
  }
};

const registryDisplayHost = (c: DockerRegistryCredential): string => {
  if (c.registry_url && c.registry_url.trim()) return c.registry_url;
  return "Docker Hub";
};

onMounted(() => {
  fetchServerProviders();
  fetchStorageProviders();
  fetchDnsProviders();
  fetchStoredCertificates();
  fetchRegistryCredentials();
});
</script>

<template>
  <div class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <GitConnections />

    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">
        {{ t("settings.connections.server.title") }}
      </h3>

      <div
        v-if="isServerProvidersLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div v-if="serverProviders.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon name="lucide:server" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">
              {{ t("settings.connections.server.empty") }}
            </span>
            <SettingsAddServerProvider @created="fetchServerProviders" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="provider in serverProviders"
            :key="provider.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon
                :name="
                  serverProviderIcons[provider.provider] || 'lucide:server'
                "
                class="h-5 w-5"
              />
              <div>
                <span class="text-sm font-medium">{{ provider.profile }}</span>
                <p class="text-xs text-muted-foreground">
                  {{ serverProviderLabel(provider.provider) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <SettingsImportContaboVps
                v-if="provider.provider === 'contabo' && provider.connected"
                :account-id="provider.id"
                :profile="provider.profile"
              />
              <Button
                variant="ghost"
                size="sm"
                @click="deleteServerProvider(provider)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <SettingsAddServerProvider @created="fetchServerProviders" />
        </div>
      </template>
    </div>

    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">
        {{ t("settings.connections.storage.title") }}
      </h3>

      <div
        v-if="isStorageProvidersLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div v-if="storageProviders.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon
              name="lucide:database"
              class="h-8 w-8 text-muted-foreground"
            />
            <span class="text-sm text-muted-foreground">
              {{ t("settings.connections.storage.empty") }}
            </span>
            <SettingsAddStorageProvider @created="fetchStorageProviders" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="provider in storageProviders"
            :key="provider.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon
                :name="
                  storageProviderIcons[provider.provider] || 'lucide:database'
                "
                class="h-5 w-5"
              />
              <div>
                <span class="text-sm font-medium">{{ provider.label }}</span>
                <p class="text-xs text-muted-foreground">
                  {{
                    storageProviderLabels[provider.provider] ||
                    provider.provider
                  }}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              @click="deleteStorageProvider(provider)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <SettingsAddStorageProvider @created="fetchStorageProviders" />
        </div>
      </template>
    </div>

    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">
        {{ t("settings.connections.dns.title") }}
      </h3>

      <div
        v-if="isDnsProvidersLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div v-if="dnsProviders.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon name="lucide:globe" class="h-8 w-8 text-muted-foreground" />
            <span class="text-sm text-muted-foreground">
              {{ t("settings.connections.dns.empty") }}
            </span>
            <SettingsAddDnsProvider @created="fetchDnsProviders" />
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="provider in dnsProviders"
            :key="provider.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon
                :name="dnsProviderIcons[provider.provider] || 'lucide:globe'"
                class="h-5 w-5"
              />
              <div>
                <span class="text-sm font-medium">{{ provider.profile }}</span>
                <p class="text-xs text-muted-foreground">
                  {{
                    dnsProviderLabels[provider.provider] || provider.provider
                  }}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              @click="deleteDnsProvider(provider)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <SettingsAddDnsProvider @created="fetchDnsProviders" />
        </div>
      </template>
    </div>

    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">
        {{ t("settings.connections.certificates.title") }}
      </h3>

      <SettingsAddCertificate
        v-model:open="isAddCertificateOpen"
        @created="(cert) => handleCertificateCreated(cert)"
        @view-existing="viewExistingCertificate"
      />
      <SettingsEditCertificate
        v-if="editingCertificate"
        :key="editingCertificate.id"
        v-model:open="isEditCertificateOpen"
        :certificate="editingCertificate"
        @updated="(cert) => handleCertificateUpdated(cert)"
      />

      <div
        v-if="isStoredCertificatesLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div
          v-if="storedCertificates.length === 0"
          class="rounded-lg border p-4"
        >
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon
              name="lucide:shield-check"
              class="h-8 w-8 text-muted-foreground"
            />
            <span class="text-sm text-muted-foreground">
              {{ t("settings.connections.certificates.empty") }}
            </span>
            <Button
              variant="outline"
              size="sm"
              @click="isAddCertificateOpen = true"
            >
              <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
              {{ t("settings.connections.certificates.add") }}
            </Button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="cert in storedCertificates"
            :key="cert.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon name="lucide:shield-check" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ cert.name }}</span>
                <p class="text-xs text-muted-foreground">
                  <template
                    v-for="(segment, idx) in certificateSubtitleSegments(cert)"
                    :key="idx"
                  >
                    <span v-if="idx > 0"> · </span>
                    {{ segment }}
                  </template>
                  <span> · </span>
                  <span :class="certificateExpiryInfo(cert).className">
                    {{ certificateExpiryInfo(cert).label }}
                  </span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                :title="t('settings.connections.edit')"
                @click="editCertificate(cert)"
              >
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :title="t('settings.connections.delete')"
                @click="deleteCertificate(cert)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            @click="isAddCertificateOpen = true"
          >
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            {{ t("settings.connections.certificates.add") }}
          </Button>
        </div>
      </template>
    </div>

    <div class="px-6 pt-6">
      <h3 class="mb-4 text-base font-semibold">
        {{ t("settings.connections.registry.title") }}
      </h3>

      <SettingsRegistryCredentialDialog
        v-model:open="isRegistryDialogOpen"
        :credential="editingRegistryCredential"
        @created="fetchRegistryCredentials"
        @updated="fetchRegistryCredentials"
        @update:open="
          (v) => {
            if (!v) handleRegistryDialogClosed();
          }
        "
      />

      <div
        v-if="isRegistryCredentialsLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div
          v-if="registryCredentials.length === 0"
          class="rounded-lg border p-4"
        >
          <div class="flex flex-col items-center gap-3 py-2">
            <Icon
              name="lucide:container"
              class="h-8 w-8 text-muted-foreground"
            />
            <span class="text-sm text-muted-foreground">
              {{ t("settings.connections.registry.empty") }}
            </span>
            <Button
              variant="outline"
              size="sm"
              @click="openCreateRegistryDialog"
            >
              <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
              {{ t("settings.connections.connect") }}
            </Button>
          </div>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="c in registryCredentials"
            :key="c.id"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="flex items-center gap-3">
              <Icon name="lucide:container" class="h-5 w-5" />
              <div>
                <span class="text-sm font-medium">{{ c.name }}</span>
                <p class="text-xs text-muted-foreground">
                  {{ registryDisplayHost(c) }} · {{ c.username }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                :title="t('settings.connections.edit')"
                @click="editRegistryCredential(c)"
              >
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                :title="t('settings.connections.delete')"
                @click="deleteRegistryCredential(c)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" @click="openCreateRegistryDialog">
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            {{ t("settings.connections.connect") }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

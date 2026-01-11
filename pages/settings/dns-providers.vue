<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

definePageMeta({
  layout: "settings",
  middleware: "auth",
});

useHead({ title: "DNS Providers" });

interface DnsProvider {
  id: string;
  label: string;
  provider: string;
  created_at: string;
}

const providers = ref<DnsProvider[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const providerLabels: Record<string, string> = {
  cloudflare: "Cloudflare",
  route53: "Amazon Route 53",
  digitalocean: "DigitalOcean DNS",
};

const providerIcons: Record<string, string> = {
  cloudflare: "simple-icons:cloudflare",
  route53: "simple-icons:amazonaws",
  digitalocean: "simple-icons:digitalocean",
};

const fetchProviders = async () => {
  try {
    const response = await $api<{ data: DnsProvider[] }>("/dns-providers");
    providers.value = response.data;
  } catch {
    toast.error("Failed to load DNS providers");
  } finally {
    isLoading.value = false;
  }
};

const deleteProvider = async (provider: DnsProvider) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Delete DNS Provider",
    description: `Are you sure you want to delete "${provider.label}"? This will not affect existing domains.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/dns-providers/${provider.id}`, { method: "DELETE" });
      providers.value = providers.value.filter((p) => p.id !== provider.id);
      toast.success("DNS provider deleted");
    } catch {
      toast.error("Failed to delete DNS provider");
    }
  }
};

onMounted(fetchProviders);
</script>

<template>
  <div class="w-full">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <Card class="h-full bg-transparent">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="text-xl">DNS Providers</CardTitle>
            <CardDescription>
              Connect DNS providers to manage your domains
            </CardDescription>
          </div>
          <SettingsAddDnsProvider @created="fetchProviders" />
        </div>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon
            name="lucide:loader-2"
            class="h-6 w-6 animate-spin text-muted-foreground"
          />
        </div>

        <template v-else>
          <SharedDataTable
            :data="providers"
            :columns="[
              { key: 'label', label: 'Label', width: '30%' },
              { key: 'provider', label: 'Provider', width: '30%' },
              {
                key: 'created_at',
                label: 'Connected',
                width: '30%',
                type: 'relative-date',
              },
            ]"
            :actions="[
              {
                label: 'Delete',
                icon: 'lucide:trash-2',
                onClick: deleteProvider,
                destructive: true,
              },
            ]"
            empty-title="No DNS providers connected"
            empty-icon="lucide:globe"
            empty-description="Connect a DNS provider to manage your domains."
          >
            <template #empty>
              <SettingsAddDnsProvider @created="fetchProviders" />
            </template>

            <template #cell-provider="{ value }">
              <div class="flex items-center gap-2">
                <Icon
                  :name="providerIcons[String(value)] || 'lucide:globe'"
                  class="h-4 w-4"
                />
                <span>{{ providerLabels[String(value)] || value }}</span>
              </div>
            </template>
          </SharedDataTable>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

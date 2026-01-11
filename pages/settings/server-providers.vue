<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

definePageMeta({
  layout: "settings",
  middleware: "auth",
});

useHead({ title: "Server Providers" });

interface ServerProvider {
  id: string;
  profile: string;
  provider: string;
  connected: boolean;
  created_at: string;
}

const providers = ref<ServerProvider[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const providerLabels: Record<string, string> = {
  aws: "Amazon Web Services",
  digitalocean: "DigitalOcean",
  linode: "Linode",
  vultr: "Vultr",
  hetzner: "Hetzner",
  custom: "Custom Provider",
};

const providerIcons: Record<string, string> = {
  aws: "simple-icons:amazonaws",
  digitalocean: "simple-icons:digitalocean",
  linode: "simple-icons:linode",
  vultr: "simple-icons:vultr",
  hetzner: "simple-icons:hetzner",
  custom: "lucide:server",
};

const fetchProviders = async () => {
  try {
    const response = await $api<{ data: ServerProvider[] }>(
      "/server-providers"
    );
    providers.value = response.data;
  } catch {
    toast.error("Failed to load server providers");
  } finally {
    isLoading.value = false;
  }
};

const deleteProvider = async (provider: ServerProvider) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Delete Server Provider",
    description: `Are you sure you want to delete "${provider.profile}"? This will not affect existing servers.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/server-providers/${provider.id}`, { method: "DELETE" });
      providers.value = providers.value.filter((p) => p.id !== provider.id);
      toast.success("Server provider deleted");
    } catch {
      toast.error("Failed to delete server provider");
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
            <CardTitle class="text-xl">Server Providers</CardTitle>
            <CardDescription>
              Connect cloud providers to automatically provision servers
            </CardDescription>
          </div>
          <SettingsAddServerProvider @created="fetchProviders" />
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
              { key: 'profile', label: 'Profile', width: '30%' },
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
            empty-title="No server providers connected"
            empty-icon="lucide:server"
            empty-description="Connect a cloud provider to automatically create and manage servers."
          >
            <template #empty>
              <SettingsAddServerProvider @created="fetchProviders" />
            </template>

            <template #cell-provider="{ value }">
              <div class="flex items-center gap-2">
                <Icon
                  :name="providerIcons[String(value)] || 'lucide:server'"
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

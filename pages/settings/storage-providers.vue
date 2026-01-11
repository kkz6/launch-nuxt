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

useHead({ title: "Storage Providers" });

interface StorageProvider {
  id: string;
  label: string;
  provider: string;
  created_at: string;
}

const providers = ref<StorageProvider[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const providerLabels: Record<string, string> = {
  s3: "Amazon S3",
  spaces: "DigitalOcean Spaces",
  backblaze: "Backblaze B2",
  wasabi: "Wasabi",
};

const providerIcons: Record<string, string> = {
  s3: "simple-icons:amazons3",
  spaces: "simple-icons:digitalocean",
  backblaze: "simple-icons:backblaze",
  wasabi: "lucide:database",
};

const fetchProviders = async () => {
  try {
    const response = await $api<{ data: StorageProvider[] }>(
      "/storage-providers"
    );
    providers.value = response.data;
  } catch {
    toast.error("Failed to load storage providers");
  } finally {
    isLoading.value = false;
  }
};

const deleteProvider = async (provider: StorageProvider) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Delete Storage Provider",
    description: `Are you sure you want to delete "${provider.label}"? This will not affect existing backups.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/storage-providers/${provider.id}`, { method: "DELETE" });
      providers.value = providers.value.filter((p) => p.id !== provider.id);
      toast.success("Storage provider deleted");
    } catch {
      toast.error("Failed to delete storage provider");
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
            <CardTitle class="text-xl">Storage Providers</CardTitle>
            <CardDescription>
              Connect storage providers for backups and file storage
            </CardDescription>
          </div>
          <SettingsAddStorageProvider @created="fetchProviders" />
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
            empty-title="No storage providers connected"
            empty-icon="lucide:database"
            empty-description="Connect a storage provider for backups."
          >
            <template #empty>
              <SettingsAddStorageProvider @created="fetchProviders" />
            </template>

            <template #cell-provider="{ value }">
              <div class="flex items-center gap-2">
                <Icon
                  :name="providerIcons[String(value)] || 'lucide:database'"
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

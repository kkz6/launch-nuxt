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

definePageMeta({
  layout: "settings",
  middleware: "auth",
});

useHead({ title: "Archived Servers" });

interface ArchivedServer {
  id: string;
  name: string;
  public_ipv4: string;
  provider: string;
  archived_at: string;
}

const servers = ref<ArchivedServer[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const providerLabels: Record<string, string> = {
  aws: "AWS",
  digitalocean: "DigitalOcean",
  linode: "Linode",
  vultr: "Vultr",
  hetzner: "Hetzner",
  custom_server: "Custom Server",
};

const fetchServers = async () => {
  try {
    const response = await $api<{ data: ArchivedServer[] }>(
      "/servers/archived"
    );
    servers.value = response.data;
  } catch {
    toast.error("Failed to load archived servers");
  } finally {
    isLoading.value = false;
  }
};

const restoreServer = async (server: ArchivedServer) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Restore Server",
    description: `Are you sure you want to restore "${server.name}"?`,
    confirmText: "Restore",
    cancelText: "Cancel",
  });

  if (result.ok) {
    try {
      await $api(`/servers/${server.id}/restore`, { method: "POST" });
      servers.value = servers.value.filter((s) => s.id !== server.id);
      toast.success("Server restored");
    } catch {
      toast.error("Failed to restore server");
    }
  }
};

const deleteServer = async (server: ArchivedServer) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Delete Server Permanently",
    description: `Are you sure you want to permanently delete "${server.name}"? This action cannot be undone.`,
    confirmText: "Delete Permanently",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/servers/${server.id}`, { method: "DELETE" });
      servers.value = servers.value.filter((s) => s.id !== server.id);
      toast.success("Server deleted permanently");
    } catch {
      toast.error("Failed to delete server");
    }
  }
};

onMounted(fetchServers);
</script>

<template>
  <div class="w-full">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <Card class="h-full bg-transparent">
      <CardHeader>
        <CardTitle class="text-xl">Archived Servers</CardTitle>
        <CardDescription>
          View and manage your archived servers
        </CardDescription>
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
            :data="servers"
            :columns="[
              { key: 'name', label: 'Name', width: '25%' },
              { key: 'public_ipv4', label: 'IP Address', width: '20%' },
              { key: 'provider', label: 'Provider', width: '20%' },
              {
                key: 'archived_at',
                label: 'Archived',
                width: '25%',
                type: 'relative-date',
              },
            ]"
            :actions="[
              {
                label: 'Restore',
                icon: 'lucide:rotate-ccw',
                onClick: restoreServer,
              },
              {
                label: 'Delete',
                icon: 'lucide:trash-2',
                onClick: deleteServer,
                destructive: true,
              },
            ]"
            empty-title="No archived servers"
            empty-icon="lucide:archive"
            empty-description="Archived servers will appear here."
          >
            <template #cell-provider="{ value }">
              {{ providerLabels[String(value)] || value }}
            </template>
          </SharedDataTable>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

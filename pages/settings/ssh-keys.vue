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

useHead({ title: "SSH Keys" });

interface SSHKey {
  id: string;
  user_id: string;
  public_key: string;
  description: string;
  name: string;
  fingerprint: string;
  remove_url: string;
  created_at: string;
  updated_at: string;
}

const sshKeys = ref<SSHKey[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchSSHKeys = async () => {
  try {
    const response = await $api<{ data: SSHKey[] }>("/ssh-keys");
    sshKeys.value = response.data;
  } catch {
    toast.error("Failed to load SSH keys");
  } finally {
    isLoading.value = false;
  }
};

const deleteSSHKey = async (sshKey: SSHKey) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: "Delete SSH Key",
    description: `Are you sure you want to delete the SSH key "${sshKey.name}"? This action cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/ssh-keys/${sshKey.id}`, { method: "DELETE" });
      sshKeys.value = sshKeys.value.filter((k) => k.id !== sshKey.id);
      toast.success("SSH key deleted successfully");
    } catch {
      toast.error("Failed to delete SSH key");
    }
  }
};

onMounted(fetchSSHKeys);
</script>

<template>
  <div class="w-full">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <Card class="h-full bg-transparent">
      <CardHeader>
        <CardTitle class="text-xl">SSH Keys</CardTitle>
        <CardDescription>
          Manage your SSH keys for secure server access
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
            :data="sshKeys"
            :columns="[
              {
                key: 'name',
                label: 'Key',
                width: '20%',
                type: 'two-line',
                secondaryKey: 'description',
              },
              {
                key: 'fingerprint',
                label: 'Fingerprint',
                width: '50%',
                className: 'text-wrap font-mono text-xs',
              },
              {
                key: 'updated_at',
                label: 'Updated',
                width: '25%',
                type: 'relative-date',
              },
            ]"
            :actions="[
              {
                label: 'Delete',
                icon: 'lucide:trash-2',
                onClick: deleteSSHKey,
                destructive: true,
              },
            ]"
            empty-title="No SSH keys found"
            empty-icon="lucide:key-round"
            empty-description="Add an SSH key to securely connect to your servers."
          >
            <template #empty>
              <SettingsAddSSHKey @created="fetchSSHKeys" />
            </template>
          </SharedDataTable>

          <div v-if="sshKeys.length > 0" class="pt-4">
            <SettingsAddSSHKey @created="fetchSSHKeys" />
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>

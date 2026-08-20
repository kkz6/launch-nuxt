<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import type { SSHKey } from "~/types";

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const sshKeys = ref<SSHKey[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchKeys = async () => {
  try {
    const data = await $api<{ data: SSHKey[] }>(
      `/servers/${props.serverId}/ssh-keys`,
    );
    sshKeys.value = data.data;
  } catch {
    toast.error(t("server.sshKeys.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const deleteKey = async (key: SSHKey) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.sshKeys.deleteTitle"),
    description: t("server.sshKeys.deleteDescription", { name: key.name }),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/ssh-keys/${key.id}`, {
        method: "DELETE",
      });
      sshKeys.value = sshKeys.value.filter((k) => k.id !== key.id);
      toast.success(t("server.sshKeys.removeSuccess"));
    } catch {
      toast.error(t("server.sshKeys.removeFailed"));
    }
  }
};

onMounted(fetchKeys);
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div>
      <h3 class="text-lg font-medium">{{ t("server.sshKeys.title") }}</h3>
      <p class="text-sm text-muted-foreground">
        {{ t("server.sshKeys.description") }}
      </p>
    </div>

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
          { key: 'name', label: t('server.common.name'), width: '30%' },
          {
            key: 'fingerprint',
            label: t('server.sshKeys.fingerprint'),
            width: '40%',
          },
          { key: 'created_at', label: t('server.sshKeys.added'), width: '20%' },
        ]"
        :actions="[
          {
            label: t('server.common.remove'),
            icon: 'lucide:trash-2',
            onClick: deleteKey,
            destructive: true,
          },
        ]"
        :empty-title="t('server.sshKeys.empty')"
        empty-icon="lucide:key"
      >
        <template #empty>
          <ServerAddSshKey :server-id="serverId" @created="fetchKeys" />
        </template>
      </SharedDataTable>

      <div v-if="sshKeys.length > 0" class="mt-6">
        <ServerAddSshKey :server-id="serverId" @created="fetchKeys" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import type { FirewallRule } from "~/types";

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const firewallRules = ref<FirewallRule[]>([]);
const isLoading = ref(true);
const editingRule = ref<FirewallRule | null>(null);
const editDialogRef = ref<{ open: () => void } | null>(null);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchData = async () => {
  try {
    const data = await $api<{ data: FirewallRule[] }>(
      `/servers/${props.serverId}/firewall-rules`,
    );
    firewallRules.value = data.data;
  } catch {
    toast.error(t("server.network.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const isSSHRule = (rule: FirewallRule) => {
  return rule.name.toLowerCase() === "ssh" || rule.port === "22";
};

const editRule = (rule: FirewallRule) => {
  editingRule.value = { ...rule };
  nextTick(() => editDialogRef.value?.open());
};

const deleteRule = async (rule: FirewallRule) => {
  if (!confirmationDialog.value) return;

  const sshRule = isSSHRule(rule);

  const result = await confirmationDialog.value.show({
    title: t("server.network.deleteTitle"),
    description: t("server.network.deleteDescription", { name: rule.name }),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
    inputVerificationText: rule.name,
    helpText: t("server.network.deleteHelp"),
    ...(sshRule ? { warning: t("server.network.sshDeleteWarning") } : {}),
  });

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/firewall-rules/${rule.id}`, {
        method: "DELETE",
      });
      firewallRules.value = firewallRules.value.filter((r) => r.id !== rule.id);
      toast.success(t("server.network.deleteSuccess"));
    } catch {
      toast.error(t("server.network.deleteFailed"));
    }
  }
};

const onRuleUpdated = () => {
  editingRule.value = null;
  fetchData();
};

onMounted(fetchData);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Hidden edit dialog -->
    <ServerCreateNetwork
      ref="editDialogRef"
      :server-id="serverId"
      :firewall-rule="editingRule"
      @updated="onRuleUpdated"
    >
      <span class="hidden" />
    </ServerCreateNetwork>

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("server.network.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("server.network.description") }}
        </p>
      </div>
      <ServerCreateNetwork
        v-if="firewallRules.length > 0"
        :server-id="serverId"
        @created="fetchData"
      />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <SharedDataTable
        :data="firewallRules"
        :columns="[
          { key: 'name', label: t('server.common.name'), width: '25%' },
          { key: 'port', label: t('server.network.port'), width: '20%' },
          { key: 'action', label: t('server.common.action'), width: '20%' },
          {
            key: 'from_ipv4',
            label: t('server.network.fromIp'),
            width: '25%',
            hideOnMobile: true,
          },
        ]"
        :actions="[
          {
            label: t('server.common.edit'),
            icon: 'lucide:pencil',
            onClick: editRule,
          },
          {
            label: t('server.common.delete'),
            icon: 'lucide:trash-2',
            onClick: deleteRule,
            destructive: true,
          },
        ]"
        :empty-title="t('server.network.empty')"
        empty-icon="lucide:network"
      >
        <template #cell-action="{ value }">
          {{
            value === "allow"
              ? t("server.networkRule.allow")
              : value === "deny"
                ? t("server.networkRule.deny")
                : value
          }}
        </template>
        <template #empty>
          <ServerCreateNetwork :server-id="serverId" @created="fetchData" />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>

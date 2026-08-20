<script setup lang="ts">
import { toast } from "vue-sonner";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

interface NotificationChannel {
  id: string;
  provider: string;
  label: string;
  data?: {
    email?: string;
    webhook_url?: string;
  };
  connected: boolean;
  is_default: boolean;
  created_at: string;
}

interface NotificationSettings {
  email_server_created: boolean;
  email_server_deleted: boolean;
  email_deployment_success: boolean;
  email_deployment_failed: boolean;
  email_backup_success: boolean;
  email_backup_failed: boolean;
}

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);
const { t } = useI18n();

// Notification channels
const channels = ref<NotificationChannel[]>([]);
const isChannelsLoading = ref(true);
const editingChannel = ref<NotificationChannel | null>(null);
const isEditOpen = ref(false);

const openEditDialog = (channel: NotificationChannel) => {
  editingChannel.value = channel;
  isEditOpen.value = true;
};

const channelLabel = (provider: string) => {
  const key = `settings.notifications.providers.${provider}`;
  const translated = t(key);
  return translated === key ? provider : translated;
};

const channelIcons: Record<string, string> = {
  slack: "simple-icons:slack",
  discord: "simple-icons:discord",
  telegram: "simple-icons:telegram",
  email: "lucide:mail",
};

const channelIconColors: Record<string, string> = {
  slack: "text-[#4A154B] dark:text-[#E01E5A]",
  discord: "text-[#5865F2]",
  telegram: "text-[#26A5E4]",
  email: "text-rose-600 dark:text-rose-400",
};

const channelBgColors: Record<string, string> = {
  slack: "bg-[#4A154B]/10 dark:bg-[#4A154B]/30",
  discord: "bg-[#5865F2]/10 dark:bg-[#5865F2]/20",
  telegram: "bg-[#26A5E4]/10 dark:bg-[#26A5E4]/20",
  email: "bg-rose-500/10 dark:bg-rose-500/20",
};

// Notification settings
const settings = ref<NotificationSettings>({
  email_server_created: true,
  email_server_deleted: true,
  email_deployment_success: false,
  email_deployment_failed: true,
  email_backup_success: false,
  email_backup_failed: true,
});
const isSettingsLoading = ref(true);

const getChannelDetail = (channel: NotificationChannel): string => {
  if (channel.provider === "email" && channel.data?.email) {
    return channel.data.email;
  }
  if (
    ["slack", "discord"].includes(channel.provider) &&
    channel.data?.webhook_url
  ) {
    return t("settings.notifications.webhookConnected");
  }
  return channelLabel(channel.provider);
};

interface NotificationChannelsResponse {
  data: {
    channels: NotificationChannel[];
  };
}

const fetchChannels = async () => {
  try {
    const response = await $api<NotificationChannelsResponse>(
      "/settings/notifications",
    );
    channels.value = response.data.channels || [];
  } catch {
    channels.value = [];
  } finally {
    isChannelsLoading.value = false;
  }
};

const fetchSettings = async () => {
  try {
    const response = await $api<{ data: NotificationSettings }>(
      "/settings/notification-preferences",
    );
    settings.value = response.data;
  } catch {
    // Use defaults
  } finally {
    isSettingsLoading.value = false;
  }
};

const saveSettings = async () => {
  try {
    await $api("/settings/notification-preferences", {
      method: "PUT",
      body: settings.value,
    });
    toast.success(t("settings.notifications.settingsSaved"));
  } catch {
    toast.error(t("settings.notifications.settingsSaveFailed"));
  }
};

const testingChannelId = ref<string | null>(null);

const testChannel = async (channel: NotificationChannel) => {
  testingChannelId.value = channel.id;
  try {
    await $api(`/settings/notifications/${channel.id}/test`, {
      method: "POST",
    });
    toast.success(t("settings.notifications.testSent"));
  } catch {
    toast.error(t("settings.notifications.testFailed"));
  } finally {
    testingChannelId.value = null;
  }
};

const deleteChannel = async (channel: NotificationChannel) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.notifications.deleteTitle"),
    description: t("settings.notifications.deleteDescription", {
      label: channel.label,
    }),
    confirmText: t("settings.notifications.delete"),
    cancelText: t("settings.notifications.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/settings/notifications/${channel.id}`, { method: "DELETE" });
      channels.value = channels.value.filter((c) => c.id !== channel.id);
      toast.success(t("settings.notifications.deleted"));
    } catch {
      toast.error(t("settings.notifications.deleteFailed"));
    }
  }
};

const notificationOptions = computed(() => [
  {
    key: "email_server_created",
    label: t("settings.notifications.options.serverCreated"),
    description: t("settings.notifications.options.serverCreatedDescription"),
  },
  {
    key: "email_server_deleted",
    label: t("settings.notifications.options.serverDeleted"),
    description: t("settings.notifications.options.serverDeletedDescription"),
  },
  {
    key: "email_deployment_success",
    label: t("settings.notifications.options.deploymentSuccess"),
    description: t(
      "settings.notifications.options.deploymentSuccessDescription",
    ),
  },
  {
    key: "email_deployment_failed",
    label: t("settings.notifications.options.deploymentFailed"),
    description: t(
      "settings.notifications.options.deploymentFailedDescription",
    ),
  },
  {
    key: "email_backup_success",
    label: t("settings.notifications.options.backupSuccess"),
    description: t("settings.notifications.options.backupSuccessDescription"),
  },
  {
    key: "email_backup_failed",
    label: t("settings.notifications.options.backupFailed"),
    description: t("settings.notifications.options.backupFailedDescription"),
  },
]);

onMounted(() => {
  fetchChannels();
  fetchSettings();
});
</script>

<template>
  <div class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Notification Channels Section -->
    <div class="px-6 pb-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold">
            {{ t("settings.notifications.channelsTitle") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("settings.notifications.channelsDescription") }}
          </p>
        </div>
        <SettingsAddNotificationChannel
          v-if="channels.length > 0"
          @created="fetchChannels"
        />
      </div>

      <div
        v-if="isChannelsLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <div v-if="channels.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-4">
            <Icon name="lucide:bell" class="h-10 w-10 text-muted-foreground" />
            <div class="text-center">
              <p class="font-medium">{{ t("settings.notifications.none") }}</p>
              <p class="text-sm text-muted-foreground">
                {{ t("settings.notifications.noneDescription") }}
              </p>
            </div>
            <SettingsAddNotificationChannel @created="fetchChannels" />
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="channel in channels"
            :key="channel.id"
            class="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              :class="channelBgColors[channel.provider] || 'bg-muted'"
            >
              <Icon
                :name="channelIcons[channel.provider] || 'lucide:bell'"
                class="h-4 w-4"
                :class="
                  channelIconColors[channel.provider] || 'text-muted-foreground'
                "
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ channel.label }}</span>
                <span
                  v-if="channel.connected"
                  class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                >
                  <span class="h-1 w-1 rounded-full bg-emerald-500" />
                  {{ t("settings.notifications.connected") }}
                </span>
              </div>
              <p class="truncate text-xs text-muted-foreground">
                {{ getChannelDetail(channel) }}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                :disabled="testingChannelId === channel.id"
                @click="testChannel(channel)"
              >
                <Icon
                  v-if="testingChannelId === channel.id"
                  name="lucide:loader-2"
                  class="h-3.5 w-3.5 animate-spin text-muted-foreground"
                />
                <Icon
                  v-else
                  name="lucide:send"
                  class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                @click="openEditDialog(channel)"
              >
                <Icon
                  name="lucide:pencil"
                  class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                @click="deleteChannel(channel)"
              >
                <Icon
                  name="lucide:trash-2"
                  class="h-3.5 w-3.5 text-muted-foreground hover:text-destructive"
                />
              </Button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Email Notifications Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.notifications.emailTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.notifications.emailDescription") }}
      </p>

      <div
        v-if="isSettingsLoading"
        class="flex items-center justify-center py-4"
      >
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="option in notificationOptions"
          :key="option.key"
          class="flex items-center justify-between rounded-lg border p-4"
        >
          <div class="space-y-0.5">
            <Label :for="option.key" class="text-sm font-medium">
              {{ option.label }}
            </Label>
            <p class="text-xs text-muted-foreground">
              {{ option.description }}
            </p>
          </div>
          <Switch
            :id="option.key"
            v-model="settings[option.key as keyof NotificationSettings]"
            @update:model-value="saveSettings"
          />
        </div>
      </div>
    </div>

    <!-- Edit Notification Channel Dialog -->
    <SettingsEditNotificationChannel
      v-model:open="isEditOpen"
      :channel="editingChannel"
      @updated="fetchChannels"
    />
  </div>
</template>

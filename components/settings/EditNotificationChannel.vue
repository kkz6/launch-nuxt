<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface NotificationChannel {
  id: string;
  provider: string;
  label: string;
  data?: {
    email?: string;
    webhook_url?: string;
    bot_token?: string;
    chat_id?: string;
  };
  connected: boolean;
}

interface Props {
  channel: NotificationChannel | null;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  updated: [];
}>();

const open = defineModel<boolean>("open", { required: true });
const isLoading = ref(false);
const isTesting = ref(false);
const label = ref("");
const credentials = ref({
  webhook_url: "",
  bot_token: "",
  chat_id: "",
  email: "",
});
const errors = ref<Record<string, string>>({});

const providers = computed<Record<string, { label: string; icon: string }>>(
  () => ({
    slack: {
      label: t("settings.notifications.providers.slack"),
      icon: "logos:slack-icon",
    },
    discord: {
      label: t("settings.notifications.providers.discord"),
      icon: "logos:discord-icon",
    },
    telegram: {
      label: t("settings.notifications.providers.telegram"),
      icon: "logos:telegram",
    },
    email: {
      label: t("settings.notifications.providers.email"),
      icon: "lucide:mail",
    },
  }),
);

const currentProvider = computed(() =>
  props.channel ? providers.value[props.channel.provider] : null,
);
const needsWebhook = computed(
  () => props.channel && ["slack", "discord"].includes(props.channel.provider),
);
const needsTelegram = computed(() => props.channel?.provider === "telegram");
const needsEmail = computed(() => props.channel?.provider === "email");

const initForm = () => {
  if (!props.channel) return;
  label.value = props.channel.label;
  credentials.value = {
    webhook_url: props.channel.data?.webhook_url || "",
    bot_token: props.channel.data?.bot_token || "",
    chat_id: props.channel.data?.chat_id || "",
    email: props.channel.data?.email || "",
  };
  errors.value = {};
};

const validate = () => {
  errors.value = {};

  if (!label.value.trim()) {
    errors.value.label = t("settings.notifications.labelRequired");
  }

  if (needsWebhook.value && !credentials.value.webhook_url.trim()) {
    errors.value.webhook_url = t("settings.notifications.webhookRequired");
  }

  if (needsTelegram.value) {
    if (!credentials.value.bot_token.trim()) {
      errors.value.bot_token = t("settings.notifications.botTokenRequired");
    }
    if (!credentials.value.chat_id.trim()) {
      errors.value.chat_id = t("settings.notifications.chatIdRequired");
    }
  }

  if (needsEmail.value && !credentials.value.email.trim()) {
    errors.value.email = t("settings.notifications.emailRequired");
  }

  return Object.keys(errors.value).length === 0;
};

const onSubmit = async () => {
  if (!props.channel || !validate()) return;

  isLoading.value = true;

  try {
    const body: Record<string, string> = {
      label: label.value,
    };

    if (needsWebhook.value) {
      body.webhook_url = credentials.value.webhook_url;
    }

    if (needsTelegram.value) {
      body.bot_token = credentials.value.bot_token;
      body.chat_id = credentials.value.chat_id;
    }

    if (needsEmail.value) {
      body.email = credentials.value.email;
    }

    await $api(`/settings/notifications/${props.channel.id}`, {
      method: "PUT",
      body,
    });

    toast.success(t("settings.notifications.channelUpdated"));
    emit("updated");
    open.value = false;
  } catch (error: unknown) {
    const err = error as {
      data?: { message?: string; errors?: Record<string, string[]> };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0];
      }
    } else {
      toast.error(
        err.data?.message || t("settings.notifications.updateFailed"),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

const testConnection = async () => {
  if (!props.channel) return;

  isTesting.value = true;
  try {
    await $api(`/settings/notifications/${props.channel.id}/test`, {
      method: "POST",
    });
    toast.success(t("settings.notifications.testSent"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.notifications.testFailed"));
  } finally {
    isTesting.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) initForm();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            v-if="currentProvider"
            :name="currentProvider.icon"
            class="h-5 w-5"
          />
          {{
            t("settings.notifications.editTitle", {
              provider: currentProvider?.label,
            })
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("settings.notifications.editDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form v-if="channel" class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="edit-label">{{
            t("settings.notifications.label")
          }}</Label>
          <Input
            id="edit-label"
            v-model="label"
            :placeholder="t('settings.notifications.channelName')"
          />
          <p v-if="errors.label" class="text-sm text-destructive">
            {{ errors.label }}
          </p>
        </div>

        <!-- Webhook URL (for Slack, Discord) -->
        <div v-if="needsWebhook" class="space-y-2">
          <Label for="edit-webhook_url">{{
            t("settings.notifications.webhookUrl")
          }}</Label>
          <Input
            id="edit-webhook_url"
            v-model="credentials.webhook_url"
            type="url"
            :placeholder="
              channel.provider === 'slack'
                ? 'https://hooks.slack.com/services/...'
                : 'https://discord.com/api/webhooks/...'
            "
          />
          <p v-if="errors.webhook_url" class="text-sm text-destructive">
            {{ errors.webhook_url }}
          </p>
        </div>

        <!-- Telegram Credentials -->
        <template v-if="needsTelegram">
          <div class="space-y-2">
            <Label for="edit-bot_token">{{
              t("settings.notifications.botToken")
            }}</Label>
            <Input
              id="edit-bot_token"
              v-model="credentials.bot_token"
              type="password"
              :placeholder="t('settings.notifications.newBotTokenPlaceholder')"
            />
            <p v-if="errors.bot_token" class="text-sm text-destructive">
              {{ errors.bot_token }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="edit-chat_id">{{
              t("settings.notifications.chatId")
            }}</Label>
            <Input
              id="edit-chat_id"
              v-model="credentials.chat_id"
              placeholder="-1001234567890"
            />
            <p v-if="errors.chat_id" class="text-sm text-destructive">
              {{ errors.chat_id }}
            </p>
          </div>
        </template>

        <!-- Email -->
        <div v-if="needsEmail" class="space-y-2">
          <Label for="edit-email">{{
            t("settings.notifications.emailAddress")
          }}</Label>
          <Input
            id="edit-email"
            v-model="credentials.email"
            type="email"
            placeholder="alerts@example.com"
          />
          <p v-if="errors.email" class="text-sm text-destructive">
            {{ errors.email }}
          </p>
        </div>

        <DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            :disabled="isTesting"
            @click="testConnection"
          >
            <Icon
              v-if="isTesting"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:send" class="mr-2 h-4 w-4" />
            {{ t("settings.notifications.sendTest") }}
          </Button>
          <div class="flex gap-2">
            <Button type="button" variant="outline" @click="open = false">
              {{ t("settings.notifications.cancel") }}
            </Button>
            <Button type="submit" :disabled="isLoading">
              <Icon
                v-if="isLoading"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              {{ t("settings.notifications.saveChanges") }}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

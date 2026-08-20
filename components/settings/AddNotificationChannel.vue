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
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const emit = defineEmits<{
  created: [];
}>();
const { t } = useI18n();

const open = ref(false);
const isLoading = ref(false);
const provider = ref("");
const label = ref("");
const credentials = ref({
  webhook_url: "",
  bot_token: "",
  chat_id: "",
  email: "",
});
const errors = ref<Record<string, string>>({});

const providers = computed(() => [
  {
    value: "slack",
    label: t("settings.notifications.providers.slack"),
    icon: "logos:slack-icon",
  },
  {
    value: "discord",
    label: t("settings.notifications.providers.discord"),
    icon: "logos:discord-icon",
  },
  {
    value: "telegram",
    label: t("settings.notifications.providers.telegram"),
    icon: "logos:telegram",
  },
  {
    value: "email",
    label: t("settings.notifications.providers.email"),
    icon: "lucide:mail",
  },
]);

const selectedProvider = computed(() =>
  providers.value.find((p) => p.value === provider.value),
);

const needsWebhook = computed(() =>
  ["slack", "discord"].includes(provider.value),
);
const needsTelegram = computed(() => provider.value === "telegram");
const needsEmail = computed(() => provider.value === "email");

const resetForm = () => {
  provider.value = "";
  label.value = "";
  credentials.value = {
    webhook_url: "",
    bot_token: "",
    chat_id: "",
    email: "",
  };
  errors.value = {};
};

const validate = () => {
  errors.value = {};

  if (!provider.value) {
    errors.value.provider = t("settings.notifications.providerRequired");
  }
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
  if (!validate()) return;

  isLoading.value = true;

  try {
    const body: Record<string, string> = {
      provider: provider.value,
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

    await $api("/settings/notifications", {
      method: "POST",
      body,
    });

    toast.success(t("settings.notifications.channelConnected"));
    emit("created");
    open.value = false;
    resetForm();
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
        err.data?.message || t("settings.notifications.connectFailed"),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (!isOpen) resetForm();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
        {{ t("settings.notifications.connect") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{
          t("settings.notifications.connectTitle")
        }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.notifications.connectDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <!-- Channel Type Selection -->
        <div class="space-y-3">
          <Label>{{ t("settings.notifications.channelType") }}</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in providers"
              :key="p.value"
              type="button"
              class="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              :class="
                provider === p.value
                  ? 'border-primary bg-muted/50'
                  : 'border-border'
              "
              @click="provider = p.value"
            >
              <Icon :name="p.icon" class="h-5 w-5" />
              <span class="text-sm font-medium">{{ p.label }}</span>
            </button>
          </div>
          <p v-if="errors.provider" class="text-sm text-destructive">
            {{ errors.provider }}
          </p>
        </div>

        <template v-if="provider">
          <div class="space-y-2">
            <Label for="label">{{ t("settings.notifications.label") }}</Label>
            <Input
              id="label"
              v-model="label"
              :placeholder="
                selectedProvider
                  ? t('settings.notifications.channelNameWithProvider', {
                      provider: selectedProvider.label,
                    })
                  : t('settings.notifications.channelName')
              "
            />
            <p v-if="errors.label" class="text-sm text-destructive">
              {{ errors.label }}
            </p>
          </div>

          <!-- Webhook URL (for Slack, Discord) -->
          <div v-if="needsWebhook" class="space-y-2">
            <Label for="webhook_url">{{
              t("settings.notifications.webhookUrl")
            }}</Label>
            <Input
              id="webhook_url"
              v-model="credentials.webhook_url"
              type="url"
              :placeholder="
                provider === 'slack'
                  ? 'https://hooks.slack.com/services/...'
                  : 'https://discord.com/api/webhooks/...'
              "
            />
            <p class="text-xs text-muted-foreground">
              <template v-if="provider === 'slack'">
                {{ t("settings.notifications.slackWebhookHelp") }}
              </template>
              <template v-else>
                {{ t("settings.notifications.discordWebhookHelp") }}
              </template>
            </p>
            <p v-if="errors.webhook_url" class="text-sm text-destructive">
              {{ errors.webhook_url }}
            </p>
          </div>

          <!-- Telegram Credentials -->
          <template v-if="needsTelegram">
            <div class="space-y-2">
              <Label for="bot_token">{{
                t("settings.notifications.botToken")
              }}</Label>
              <Input
                id="bot_token"
                v-model="credentials.bot_token"
                type="password"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
              <p class="text-xs text-muted-foreground">
                {{ t("settings.notifications.botTokenHelp") }}
              </p>
              <p v-if="errors.bot_token" class="text-sm text-destructive">
                {{ errors.bot_token }}
              </p>
            </div>

            <div class="space-y-2">
              <Label for="chat_id">{{
                t("settings.notifications.chatId")
              }}</Label>
              <Input
                id="chat_id"
                v-model="credentials.chat_id"
                placeholder="-1001234567890"
              />
              <p class="text-xs text-muted-foreground">
                {{ t("settings.notifications.chatIdHelp") }}
              </p>
              <p v-if="errors.chat_id" class="text-sm text-destructive">
                {{ errors.chat_id }}
              </p>
            </div>
          </template>

          <!-- Email -->
          <div v-if="needsEmail" class="space-y-2">
            <Label for="email">{{
              t("settings.notifications.emailAddress")
            }}</Label>
            <Input
              id="email"
              v-model="credentials.email"
              type="email"
              placeholder="alerts@example.com"
            />
            <p class="text-xs text-muted-foreground">
              {{ t("settings.notifications.emailHelp") }}
            </p>
            <p v-if="errors.email" class="text-sm text-destructive">
              {{ errors.email }}
            </p>
          </div>
        </template>

        <DialogFooter v-if="provider">
          <Button type="button" variant="outline" @click="open = false">
            {{ t("settings.notifications.cancel") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              t("settings.notifications.connectProvider", {
                provider: selectedProvider?.label,
              })
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

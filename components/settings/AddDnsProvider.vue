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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const emit = defineEmits<{
  created: [];
}>();

const { t } = useI18n();

const open = ref(false);
const isLoading = ref(false);
const provider = ref("");
const label = ref("");
const credentials = ref({
  api_token: "",
  account_id: "",
});
const errors = ref<Record<string, string>>({});

const providers = [
  { value: "cloudflare", label: "Cloudflare", icon: "simple-icons:cloudflare" },
  {
    value: "digitalocean",
    label: "DigitalOcean DNS",
    icon: "simple-icons:digitalocean",
  },
];

const needsAccountId = computed(() => provider.value === "cloudflare");

const resetForm = () => {
  provider.value = "";
  label.value = "";
  credentials.value = { api_token: "", account_id: "" };
  errors.value = {};
};

const validate = () => {
  errors.value = {};

  if (!provider.value) {
    errors.value.provider = t(
      "settings.connectionDialogs.validation.selectProvider",
    );
  }
  if (!label.value.trim()) {
    errors.value.label = t(
      "settings.connectionDialogs.validation.labelRequired",
    );
  }

  if (!credentials.value.api_token.trim()) {
    errors.value.api_token = t(
      "settings.connectionDialogs.validation.apiTokenRequired",
    );
  }
  if (needsAccountId.value && !credentials.value.account_id.trim()) {
    errors.value.account_id = t(
      "settings.connectionDialogs.validation.accountIdRequired",
    );
  }

  return Object.keys(errors.value).length === 0;
};

const onSubmit = async () => {
  if (!validate()) return;

  isLoading.value = true;

  try {
    await $api("/dns-providers", {
      method: "POST",
      body: {
        provider: provider.value,
        profile: label.value.trim(),
        token: credentials.value.api_token.trim(),
        account_id: needsAccountId.value
          ? credentials.value.account_id.trim()
          : undefined,
      },
    });

    toast.success(t("settings.connectionDialogs.dns.connected"));
    emit("created");
    open.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as {
      data?: { message?: string; errors?: Record<string, string[]> };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        const input = { profile: "label", token: "api_token" }[field] || field;
        errors.value[input] = messages[0];
      }
    } else {
      toast.error(
        err.data?.message || t("settings.connectionDialogs.connectFailed"),
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
        {{ t("settings.connectionDialogs.connect") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{
          t("settings.connectionDialogs.dns.title")
        }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.connectionDialogs.dns.description") }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label>{{ t("settings.connectionDialogs.provider") }}</Label>
          <Select v-model="provider">
            <SelectTrigger>
              <SelectValue
                :placeholder="t('settings.connectionDialogs.selectProvider')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="p in providers"
                :key="p.value"
                :value="p.value"
              >
                <div class="flex items-center gap-2">
                  <Icon :name="p.icon" class="h-4 w-4" />
                  {{ p.label }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.provider" class="text-sm text-destructive">
            {{ errors.provider }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="label">{{ t("settings.connectionDialogs.label") }}</Label>
          <Input
            id="label"
            v-model="label"
            :placeholder="t('settings.connectionDialogs.dns.labelPlaceholder')"
          />
          <p v-if="errors.label" class="text-sm text-destructive">
            {{ errors.label }}
          </p>
        </div>

        <!-- API Token (for Cloudflare, DigitalOcean) -->
        <div class="space-y-2">
          <Label for="api_token">{{
            t("settings.connectionDialogs.apiToken")
          }}</Label>
          <Input
            id="api_token"
            v-model="credentials.api_token"
            type="password"
            :placeholder="t('settings.connectionDialogs.apiTokenPlaceholder')"
          />
          <p v-if="errors.api_token" class="text-sm text-destructive">
            {{ errors.api_token }}
          </p>
        </div>

        <div v-if="needsAccountId" class="space-y-2">
          <Label for="account_id">{{
            t("settings.connectionDialogs.dns.accountId")
          }}</Label>
          <Input id="account_id" v-model="credentials.account_id" />
          <p v-if="errors.account_id" class="text-sm text-destructive">
            {{ errors.account_id }}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t("settings.connectionDialogs.cancel") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("settings.connectionDialogs.connect") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

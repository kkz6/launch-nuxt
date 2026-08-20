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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface KeyOption {
  value: string;
  label: string;
}

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  created: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);
const isFetchingKeys = ref(false);
const availableKeys = ref<KeyOption[]>([]);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const selectedKeyId = ref("");
const name = ref("");
const publicKey = ref("");
const errors = ref<{ ssh_key_id?: string; name?: string; public_key?: string }>(
  {},
);

const isCustomKey = computed(() => selectedKeyId.value === "custom");

const fetchAvailableKeys = async () => {
  isFetchingKeys.value = true;
  try {
    const data = await $api<{ data: { keys_available: KeyOption[] } }>(
      `/servers/${props.serverId}/ssh-keys/create`,
    );
    availableKeys.value = data.data?.keys_available || [];
  } catch {
    availableKeys.value = [];
  } finally {
    isFetchingKeys.value = false;
  }
};

const validate = (): boolean => {
  errors.value = {};

  if (!selectedKeyId.value) {
    errors.value.ssh_key_id = t("server.addSshKey.selectRequired");
    return false;
  }

  if (isCustomKey.value) {
    if (!name.value.trim()) {
      errors.value.name = t("server.addSshKey.nameRequired");
    }
    if (!publicKey.value.trim()) {
      errors.value.public_key = t("server.addSshKey.publicKeyRequired");
    } else if (
      !publicKey.value.startsWith("ssh-rsa") &&
      !publicKey.value.startsWith("ssh-ed25519") &&
      !publicKey.value.startsWith("ecdsa-")
    ) {
      errors.value.public_key = t("server.addSshKey.publicKeyInvalid");
    }
  }

  return Object.keys(errors.value).length === 0;
};

const resetForm = () => {
  selectedKeyId.value = "";
  name.value = "";
  publicKey.value = "";
  errors.value = {};
};

const onSubmit = async () => {
  if (!validate()) return;

  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.addSshKey.confirmTitle"),
    description: t("server.addSshKey.confirmDescription"),
    confirmText: t("server.common.attach"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) return;

  isLoading.value = true;
  try {
    const body = isCustomKey.value
      ? { ssh_key_id: "custom", name: name.value, public_key: publicKey.value }
      : { ssh_key_id: selectedKeyId.value };

    await $api(`/servers/${props.serverId}/ssh-keys`, {
      method: "POST",
      body,
    });
    toast.success(t("server.addSshKey.success"));
    emit("created");
    isOpen.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field as keyof typeof errors.value] = messages[0];
      }
    } else {
      toast.error(err.data?.message || t("server.addSshKey.failed"));
    }
  } finally {
    isLoading.value = false;
  }
};

watch(isOpen, (open) => {
  if (open) {
    fetchAvailableKeys();
  } else {
    resetForm();
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus-circle" class="mr-2 block size-4" />
          {{ t("server.addSshKey.button") }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("server.addSshKey.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("server.addSshKey.description") }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="isFetchingKeys" class="flex items-center justify-center py-8">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>

      <form v-else class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="ssh_key_id">{{ t("server.addSshKey.select") }}</Label>
          <Select v-model="selectedKeyId">
            <SelectTrigger :class="{ 'border-destructive': errors.ssh_key_id }">
              <SelectValue
                :placeholder="t('server.addSshKey.selectPlaceholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="key in availableKeys"
                :key="key.value"
                :value="key.value"
              >
                {{ key.label }}
              </SelectItem>
              <SelectItem value="custom">{{
                t("server.addSshKey.custom")
              }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.ssh_key_id" class="text-sm text-destructive">
            {{ errors.ssh_key_id }}
          </p>
        </div>

        <template v-if="isCustomKey">
          <div class="space-y-2">
            <Label for="name">{{ t("server.common.name") }}</Label>
            <Input
              id="name"
              v-model="name"
              :placeholder="t('server.addSshKey.namePlaceholder')"
              :class="{ 'border-destructive': errors.name }"
            />
            <p v-if="errors.name" class="text-sm text-destructive">
              {{ errors.name }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="public_key">{{
              t("server.addSshKey.publicKey")
            }}</Label>
            <Textarea
              id="public_key"
              v-model="publicKey"
              placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
              rows="4"
              :class="{ 'border-destructive': errors.public_key }"
            />
            <p v-if="errors.public_key" class="text-sm text-destructive">
              {{ errors.public_key }}
            </p>
          </div>
        </template>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 block size-4 animate-spin"
            />
            {{ t("server.common.attach") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

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
import { Textarea } from "~/components/ui/textarea";

const props = defineProps<{
  open?: boolean;
}>();
const { t } = useI18n();

const emit = defineEmits<{
  created: [];
  "update:open": [value: boolean];
}>();

const isOpen = computed({
  get: () => props.open ?? internalOpen.value,
  set: (value) => {
    internalOpen.value = value;
    emit("update:open", value);
  },
});
const internalOpen = ref(false);
const isLoading = ref(false);
const isGenerating = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const name = ref("");
const description = ref("");
const privateKey = ref("");
const publicKey = ref("");
const errors = ref<{ name?: string; public_key?: string }>({});

const validate = (): boolean => {
  errors.value = {};

  if (!name.value.trim()) {
    errors.value.name = t("settings.addSshKey.nameRequired");
  }

  if (!publicKey.value.trim()) {
    errors.value.public_key = t("settings.addSshKey.publicKeyRequired");
  } else if (
    !publicKey.value.startsWith("ssh-rsa") &&
    !publicKey.value.startsWith("ssh-ed25519") &&
    !publicKey.value.startsWith("ecdsa-")
  ) {
    errors.value.public_key = t("settings.addSshKey.publicKeyInvalid");
  }

  return Object.keys(errors.value).length === 0;
};

const resetForm = () => {
  name.value = "";
  description.value = "";
  privateKey.value = "";
  publicKey.value = "";
  errors.value = {};
};

const generateSSHKey = async (type: "rsa" | "ed25519") => {
  isGenerating.value = true;
  try {
    const response = await $api<{
      data: { privateKey: string; publicKey: string };
    }>("/ssh-keys/generate", {
      method: "POST",
      body: { type },
    });
    privateKey.value = response.data.privateKey;
    publicKey.value = response.data.publicKey;
    toast.success(t("settings.addSshKey.generated"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.addSshKey.generateFailed"));
  } finally {
    isGenerating.value = false;
  }
};

const downloadKey = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success(t("settings.addSshKey.downloaded", { filename }));
};

const downloadPrivateKey = () => {
  if (privateKey.value) {
    const filename = name.value ? `${name.value}.key` : "private_key.key";
    downloadKey(privateKey.value, filename);
  }
};

const downloadPublicKey = () => {
  if (publicKey.value) {
    const filename = name.value ? `${name.value}.pub` : "public_key.pub";
    downloadKey(publicKey.value, filename);
  }
};

const onSubmit = async () => {
  if (!validate()) return;

  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.addSshKey.confirmTitle"),
    description: t("settings.addSshKey.confirmDescription"),
    confirmText: t("settings.addSshKey.add"),
    cancelText: t("settings.addSshKey.cancel"),
  });

  if (!result.ok) return;

  isLoading.value = true;
  try {
    await $api("/ssh-keys", {
      method: "POST",
      body: {
        name: name.value,
        description: description.value,
        public_key: publicKey.value,
        is_global: true,
      },
    });
    toast.success(t("settings.addSshKey.added"));
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
      toast.error(err.data?.message || t("settings.addSshKey.addFailed"));
    }
  } finally {
    isLoading.value = false;
  }
};

watch(isOpen, (open) => {
  if (!open) {
    resetForm();
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <DialogTrigger v-if="$slots.default" as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="max-h-screen overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("settings.addSshKey.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.addSshKey.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-wrap gap-4">
        <Button
          variant="secondary"
          :disabled="isGenerating"
          class="max-sm:w-full"
          type="button"
          @click="generateSSHKey('rsa')"
        >
          <Icon
            v-if="isGenerating"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          {{ t("settings.addSshKey.generateRsa") }}
        </Button>
        <Button
          variant="secondary"
          :disabled="isGenerating"
          class="max-sm:w-full"
          type="button"
          @click="generateSSHKey('ed25519')"
        >
          <Icon
            v-if="isGenerating"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          {{ t("settings.addSshKey.generateEd25519") }}
        </Button>
      </div>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">{{ t("settings.addSshKey.name") }}</Label>
          <Input
            id="name"
            v-model="name"
            :placeholder="t('settings.addSshKey.namePlaceholder')"
            :class="{ 'border-destructive': errors.name }"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="description">{{
            t("settings.addSshKey.descriptionOptional")
          }}</Label>
          <Input
            id="description"
            v-model="description"
            :placeholder="t('settings.addSshKey.descriptionPlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="privateKey">{{
              t("settings.addSshKey.privateKey")
            }}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-auto p-1 text-xs"
              :disabled="!privateKey"
              @click="downloadPrivateKey"
            >
              <Icon name="lucide:download" class="mr-1 block size-3" />
              {{ t("settings.addSshKey.download") }}
            </Button>
          </div>
          <Textarea
            id="privateKey"
            v-model="privateKey"
            placeholder="-----BEGIN RSA PRIVATE KEY-----"
            :rows="5"
            class="font-mono text-sm"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="public_key">{{
              t("settings.addSshKey.publicKey")
            }}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-auto p-1 text-xs"
              :disabled="!publicKey"
              @click="downloadPublicKey"
            >
              <Icon name="lucide:download" class="mr-1 block size-3" />
              {{ t("settings.addSshKey.download") }}
            </Button>
          </div>
          <Textarea
            id="public_key"
            v-model="publicKey"
            placeholder="ssh-rsa AAAAB3NzaC1..."
            :rows="5"
            class="font-mono text-sm"
            :class="{ 'border-destructive': errors.public_key }"
          />
          <p v-if="errors.public_key" class="text-sm text-destructive">
            {{ errors.public_key }}
          </p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 block size-4 animate-spin"
            />
            {{ t("settings.addSshKey.title") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface Provider {
  key: string;
  name: string;
  icon: string;
  className: string;
  enabled: boolean;
}

interface Props {
  providers: Provider[];
}

defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  install: [provider: string];
}>();

const isOpen = ref(false);

const handleInstall = (provider: string) => {
  emit("install", provider);
  isOpen.value = false;
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("shared.gitProvider.add") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("shared.gitProvider.select") }}</DialogTitle>
        <DialogDescription>
          {{ t("shared.gitProvider.description") }}
        </DialogDescription>
      </DialogHeader>
      <div class="mt-6 space-y-3">
        <Button
          v-for="provider in providers"
          :key="provider.key"
          :class="[
            'flex h-10 w-full items-center justify-center gap-3 text-base font-medium',
            provider.className,
          ]"
          :disabled="!provider.enabled"
          @click="handleInstall(provider.key)"
        >
          <Icon :name="provider.icon" class="h-5 w-5" />
          {{
            t("shared.gitProvider.continueWith", { provider: provider.name })
          }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

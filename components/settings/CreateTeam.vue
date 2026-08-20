<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
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

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const name = ref("");
const errors = ref<{ name?: string }>({});

const schema = computed(() =>
  z.object({
    name: z.string().min(1, t("settings.teamDialogs.nameRequired")),
  }),
);

const canSubmit = computed(() => {
  return name.value.trim().length > 0 && !isLoading.value;
});

const resetForm = () => {
  name.value = "";
  errors.value = {};
};

const handleClose = (isOpen: boolean) => {
  if (!isOpen) {
    resetForm();
  }
};

const validate = () => {
  const result = schema.value.safeParse({ name: name.value.trim() });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0],
    };
    return false;
  }
  errors.value = {};
  return true;
};

const onSubmit = async () => {
  if (!validate()) return;

  isLoading.value = true;
  try {
    await $api("/teams", {
      method: "POST",
      body: { name: name.value.trim() },
    });
    toast.success(t("settings.teamDialogs.created"));
    open.value = false;
    resetForm();
    emit("created");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(
        fetchError.data?.message || t("settings.teamDialogs.createFailed"),
      );
    } else {
      toast.error(t("settings.teamDialogs.createFailed"));
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open" @update:open="handleClose">
    <DialogTrigger v-if="$slots.default" as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("settings.teamDialogs.createTitle") }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.teamDialogs.createDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="team-name">{{
            t("settings.teamDialogs.teamName")
          }}</Label>
          <Input
            id="team-name"
            v-model="name"
            :placeholder="t('settings.teamDialogs.teamNamePlaceholder')"
            autocomplete="off"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("settings.teamDialogs.create") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

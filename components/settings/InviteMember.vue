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

interface Props {
  teamId?: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  invited: [];
}>();

const open = defineModel<boolean>("open", { required: true });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});

// Form values
const email = ref("");
const role = ref("member");

const roles = computed(() => [
  { value: "admin", label: t("settings.teamDialogs.roles.admin") },
  { value: "editor", label: t("settings.teamDialogs.roles.editor") },
  { value: "member", label: t("settings.teamDialogs.roles.member") },
]);

const schema = computed(() =>
  z.object({
    email: z.string().email(t("settings.teamDialogs.emailInvalid")),
    role: z.string().min(1, t("settings.teamDialogs.roleRequired")),
  }),
);

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (email.value.trim().length === 0) return false;
  if (role.value.length === 0) return false;
  return true;
});

const resetForm = () => {
  email.value = "";
  role.value = "member";
  errors.value = {};
};

const handleClose = (isOpen: boolean) => {
  if (!isOpen) {
    resetForm();
  }
};

const validate = () => {
  const result = schema.value.safeParse({
    email: email.value.trim(),
    role: role.value,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      email: fieldErrors.email?.[0] || "",
      role: fieldErrors.role?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  if (!props.teamId) return;

  isLoading.value = true;
  try {
    await $api(`/teams/${props.teamId}/invitations`, {
      method: "POST",
      body: data,
    });
    toast.success(t("settings.teamDialogs.invitationSent"));
    open.value = false;
    resetForm();
    emit("invited");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(
        fetchError.data?.message || t("settings.teamDialogs.invitationFailed"),
      );
    } else {
      toast.error(t("settings.teamDialogs.invitationFailed"));
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open" @update:open="handleClose">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("settings.teamDialogs.inviteTitle") }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.teamDialogs.inviteDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="email">{{ t("settings.teamDialogs.email") }}</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            placeholder="colleague@example.com"
          />
          <p v-if="errors.email" class="text-sm text-destructive">
            {{ errors.email }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="role">{{ t("settings.teamDialogs.role") }}</Label>
          <Select v-model="role">
            <SelectTrigger>
              <SelectValue
                :placeholder="t('settings.teamDialogs.selectRole')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in roles" :key="r.value" :value="r.value">
                {{ r.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.role" class="text-sm text-destructive">
            {{ errors.role }}
          </p>
        </div>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            {{ t("settings.teamDialogs.cancel") }}
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("settings.teamDialogs.sendInvitation") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

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
import { Switch } from "~/components/ui/switch";

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
const showPassword = ref(false);
const errors = ref<Record<string, string>>({});
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Form values
const name = ref("");
const createUser = ref(false);
const userName = ref("");
const userPassword = ref("");

const generatePassword = () => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(32)))
    .map((x) => charset[x % charset.length])
    .join("");
};

const getSchema = () =>
  z
    .object({
      name: z
        .string()
        .min(1, t("server.databaseForm.nameRequired"))
        .max(64)
        .refine((value) => !/\s/.test(value), {
          message: t("server.databaseForm.nameNoSpaces"),
        })
        .refine((value) => /^[a-zA-Z0-9_]+$/.test(value), {
          message: t("server.databaseForm.nameInvalid"),
        }),
      create_user: z.boolean(),
      user_name: z.string().optional(),
      user_password: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.create_user) {
          return data.user_name && data.user_name.length > 0;
        }
        return true;
      },
      {
        message: t("server.databaseForm.usernameRequired"),
        path: ["user_name"],
      },
    )
    .refine(
      (data) => {
        if (data.create_user && data.user_name) {
          return !/\s/.test(data.user_name);
        }
        return true;
      },
      {
        message: t("server.databaseForm.usernameNoSpaces"),
        path: ["user_name"],
      },
    )
    .refine(
      (data) => {
        if (data.create_user && data.user_name) {
          return /^[a-zA-Z0-9_]+$/.test(data.user_name);
        }
        return true;
      },
      {
        message: t("server.databaseForm.usernameInvalid"),
        path: ["user_name"],
      },
    )
    .refine(
      (data) => {
        if (data.create_user) {
          return data.user_password && data.user_password.length > 0;
        }
        return true;
      },
      {
        message: t("server.databaseForm.passwordRequired"),
        path: ["user_password"],
      },
    );

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (name.value.trim().length === 0) return false;
  if (createUser.value) {
    if (userName.value.trim().length === 0) return false;
    if (userPassword.value.length === 0) return false;
  }
  return true;
});

const resetForm = () => {
  name.value = "";
  createUser.value = false;
  userName.value = "";
  userPassword.value = "";
  showPassword.value = false;
  errors.value = {};
};

const validate = () => {
  const result = getSchema().safeParse({
    name: name.value.trim(),
    create_user: createUser.value,
    user_name: userName.value.trim() || undefined,
    user_password: userPassword.value || undefined,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0] || "",
      user_name: fieldErrors.user_name?.[0] || "",
      user_password: fieldErrors.user_password?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.databaseForm.title"),
    description: t("server.databaseForm.confirmDescription", {
      name: data.name,
    }),
    confirmText: t("server.common.create"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) {
    toast.info(t("server.common.cancelled"));
    return;
  }

  isLoading.value = true;
  try {
    await $api(`/servers/${props.serverId}/databases`, {
      method: "POST",
      body: data,
    });
    toast.success(t("server.databaseForm.success"));
    emit("created");
    isOpen.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.common.errorOccurred"));
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
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          {{ t("server.databaseForm.title") }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ t("server.databaseForm.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("server.databaseForm.description") }}
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">{{ t("server.databaseForm.name") }}</Label>
          <Input id="name" v-model="name" placeholder="my_database" />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>{{ t("server.databaseForm.createUser") }}</Label>
            <p class="text-sm text-muted-foreground">
              {{ t("server.databaseForm.createUserDescription") }}
            </p>
          </div>
          <Switch v-model="createUser" />
        </div>

        <div v-if="createUser" class="space-y-4">
          <div class="space-y-2">
            <Label for="user_name">{{ t("server.common.username") }}</Label>
            <Input
              id="user_name"
              v-model="userName"
              placeholder="my_user"
              autocomplete="off"
            />
            <p v-if="errors.user_name" class="text-sm text-destructive">
              {{ errors.user_name }}
            </p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="user_password">{{
                t("server.common.password")
              }}</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="userPassword = generatePassword()"
              >
                <Icon name="lucide:braces" class="mr-1 h-3 w-3" />
                {{ t("server.common.generatePassword") }}
              </Button>
            </div>
            <div class="relative">
              <Input
                id="user_password"
                v-model="userPassword"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('server.databaseForm.enterPassword')"
                autocomplete="new-password"
                class="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                @click="showPassword = !showPassword"
              >
                <Icon
                  v-if="showPassword"
                  name="lucide:eye-off"
                  class="h-4 w-4"
                />
                <Icon v-else name="lucide:eye" class="h-4 w-4" />
              </Button>
            </div>
            <p v-if="errors.user_password" class="text-sm text-destructive">
              {{ errors.user_password }}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("server.databaseForm.title") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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

interface DatabaseUser {
  id: string;
  name: string;
  password?: string | null;
  database_ids?: string[];
}

interface Props {
  serverId: string;
  databases: Record<string, string>;
  user?: DatabaseUser;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const isOpen = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const showPassword = ref(false);
const errors = ref<Record<string, string>>({});
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Form values
const name = ref(props.user?.name ?? "");
const password = ref(props.user?.password ?? "");
const selectedDatabases = ref<string[]>(props.user?.database_ids ?? []);

const generatePassword = () => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(32)))
    .map((x) => charset[x % charset.length])
    .join("");
};

const getNameSchema = () =>
  z
    .string()
    .min(1, t("server.databaseUser.usernameRequired"))
    .max(32)
    .refine((value) => !/\s/.test(value), {
      message: t("server.databaseUser.usernameNoSpaces"),
    })
    .refine((value) => /^[a-zA-Z0-9_]+$/.test(value), {
      message: t("server.databaseUser.usernameInvalid"),
    });

const getDatabasesSchema = () =>
  z.array(z.string()).refine((value) => value.length > 0, {
    message: t("server.databaseUser.databaseRequired"),
  });

const getCreateSchema = () =>
  z.object({
    name: getNameSchema(),
    password: z.string().min(1, t("server.databaseUser.passwordRequired")),
    databases: getDatabasesSchema(),
  });

const getUpdateSchema = () =>
  z.object({
    name: getNameSchema(),
    password: z.string().refine((val) => val === "" || val.length >= 8, {
      message: t("server.databaseUser.passwordMin"),
    }),
    databases: getDatabasesSchema(),
  });

const isUpdate = computed(() => Boolean(props.user));
const isRootUser = computed(() => props.user?.name === "root");

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (name.value.trim().length === 0) return false;
  if (!isUpdate.value && password.value.length === 0) return false;
  if (selectedDatabases.value.length === 0 && !isRootUser.value) return false;
  return true;
});

const resetForm = () => {
  name.value = props.user?.name ?? "";
  password.value = props.user?.password ?? "";
  selectedDatabases.value = props.user?.database_ids ?? [];
  showPassword.value = false;
  errors.value = {};
};

const toggleDatabase = (databaseId: string, checked: boolean) => {
  if (checked) {
    selectedDatabases.value = [...selectedDatabases.value, databaseId];
  } else {
    selectedDatabases.value = selectedDatabases.value.filter(
      (id) => id !== databaseId,
    );
  }
};

const validate = () => {
  const schema = isUpdate.value ? getUpdateSchema() : getCreateSchema();
  const result = schema.safeParse({
    name: name.value.trim(),
    password: password.value,
    databases: selectedDatabases.value,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0] || "",
      password: fieldErrors.password?.[0] || "",
      databases: fieldErrors.databases?.[0] || "",
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
    title: isUpdate.value
      ? t("server.databaseUser.updateTitle")
      : t("server.databaseUser.createTitle"),
    description: isUpdate.value
      ? t("server.databaseUser.updateConfirm", { name: data.name })
      : t("server.databaseUser.createConfirm", { name: data.name }),
    confirmText: isUpdate.value
      ? t("server.common.update")
      : t("server.common.create"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) {
    toast.info(t("server.common.cancelled"));
    return;
  }

  isLoading.value = true;
  try {
    if (isUpdate.value && props.user) {
      const body: Record<string, unknown> = { databases: data.databases };
      if (data.password) {
        body.password = data.password;
      }
      await $api(`/servers/${props.serverId}/database-users/${props.user.id}`, {
        method: "PUT",
        body,
      });
      toast.success(t("server.databaseUser.updated"));
      emit("updated");
    } else {
      await $api(`/servers/${props.serverId}/database-users`, {
        method: "POST",
        body: data,
      });
      toast.success(t("server.databaseUser.created"));
      emit("created");
    }
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
  if (open) {
    resetForm();
  } else {
    resetForm();
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger v-if="!user" as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          {{ t("server.databaseUser.create") }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{
          isUpdate
            ? t("server.databaseUser.updateTitle")
            : t("server.databaseUser.createTitle")
        }}</DialogTitle>
        <DialogDescription>
          {{
            isUpdate
              ? t("server.databaseUser.updateDescription")
              : t("server.databaseUser.createDescription")
          }}
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">{{ t("server.common.username") }}</Label>
          <Input
            id="name"
            v-model="name"
            placeholder="my_user"
            autocomplete="off"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label for="password">{{
              isUpdate
                ? t("server.databaseUser.newPassword")
                : t("server.common.password")
            }}</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              class="h-auto p-0 text-xs"
              @click="password = generatePassword()"
            >
              <Icon name="lucide:braces" class="mr-1 h-3 w-3" />
              {{ t("server.common.generatePassword") }}
            </Button>
          </div>
          <div class="relative">
            <Input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="
                isUpdate
                  ? t('server.databaseUser.keepPasswordPlaceholder')
                  : t('server.databaseForm.enterPassword')
              "
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
              <Icon v-if="showPassword" name="lucide:eye-off" class="h-4 w-4" />
              <Icon v-else name="lucide:eye" class="h-4 w-4" />
            </Button>
          </div>
          <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <div class="space-y-4">
          <div class="space-y-1">
            <Label>{{ t("server.databaseUser.allowedDatabases") }}</Label>
            <p class="text-sm text-muted-foreground">
              {{
                isRootUser
                  ? t("server.databaseUser.rootAccess")
                  : t("server.databaseUser.selectAccess")
              }}
            </p>
          </div>
          <div
            v-if="Object.keys(databases).length === 0"
            class="text-sm text-muted-foreground"
          >
            {{ t("server.databaseUser.noDatabases") }}
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="(dbName, id) in databases"
              :key="id"
              class="flex items-center space-x-3"
            >
              <Checkbox
                :id="`db-${id}`"
                :model-value="
                  isRootUser ? true : selectedDatabases.includes(String(id))
                "
                :disabled="isRootUser"
                @update:model-value="
                  (val: boolean | 'indeterminate') => {
                    if (!isRootUser && typeof val === 'boolean')
                      toggleDatabase(String(id), val);
                  }
                "
              />
              <Label :for="`db-${id}`" class="font-normal cursor-pointer">
                {{ dbName }}
              </Label>
            </div>
          </div>
          <p v-if="errors.databases" class="text-sm text-destructive">
            {{ errors.databases }}
          </p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              isUpdate
                ? t("server.databaseUser.update")
                : t("server.databaseUser.create")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

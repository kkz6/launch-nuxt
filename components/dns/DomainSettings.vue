<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";

interface Domain {
  id: string;
  label: string;
  address: string;
  provider?: {
    provider: string;
    provider_label: string;
  };
}

interface Props {
  domain: Domain;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const { t } = useI18n();

const isLoading = ref(false);
const syncLoading = ref(false);
const deleteLoading = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const domainSchema = computed(() =>
  toTypedSchema(
    z.object({
      label: z
        .string()
        .min(1, t("operations.dns.settings.validation.labelRequired")),
    }),
  ),
);

const { handleSubmit, setFieldError } = useForm({
  validationSchema: domainSchema,
  validateOnMount: false,
  initialValues: {
    label: props.domain.label,
  },
});

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("operations.dns.settings.updateTitle"),
    description: t("operations.dns.settings.updateDescription"),
    confirmText: t("operations.dns.common.update"),
    cancelText: t("operations.dns.common.cancel"),
  });

  if (!result.ok) return;

  isLoading.value = true;

  try {
    await $api(`/dns/domains/${props.domain.id}`, {
      method: "PATCH",
      body: values,
    });
    toast.success(t("operations.dns.settings.updateSuccess"));
    emit("updated");
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0]);
      }
    } else {
      toast.error(
        err.data?.message || t("operations.dns.settings.updateError"),
      );
    }
  } finally {
    isLoading.value = false;
  }
});

const syncRecords = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("operations.dns.settings.syncTitle"),
    description: t("operations.dns.settings.syncConfirmationDescription"),
    confirmText: t("operations.dns.settings.syncButton"),
    cancelText: t("operations.dns.common.cancel"),
  });

  if (!result.ok) return;

  syncLoading.value = true;

  try {
    await $api(`/dns/domains/${props.domain.id}/sync`, {
      method: "POST",
    });
    toast.success(t("operations.dns.settings.syncSuccess"));
    emit("updated");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("operations.dns.settings.syncError"));
  } finally {
    syncLoading.value = false;
  }
};

const deleteDomain = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("operations.dns.settings.deleteTitle"),
    description: t("operations.dns.settings.deleteDescription", {
      domain: props.domain.address,
    }),
    confirmText: t("operations.dns.settings.deleteButton"),
    cancelText: t("operations.dns.common.cancel"),
    destructive: true,
    helpText: t("operations.dns.settings.deleteHelp"),
    inputVerificationText: props.domain.address,
  });

  if (!result.ok) return;

  deleteLoading.value = true;

  try {
    await $api(`/dns/domains/${props.domain.id}`, {
      method: "DELETE",
    });
    toast.success(t("operations.dns.settings.deleteSuccess"));
    emit("deleted");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("operations.dns.settings.deleteError"));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="space-y-6">
      <form class="space-y-4" @submit.prevent="onSubmit">
        <FormField v-slot="{ componentField }" name="label">
          <FormItem>
            <FormLabel>{{
              t("operations.dns.settings.domainLabel")
            }}</FormLabel>
            <FormControl>
              <Input v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" :disabled="isLoading">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("operations.dns.settings.updateSettings") }}
        </Button>
      </form>

      <Separator />

      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium">
            {{ t("operations.dns.settings.syncTitle") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("operations.dns.settings.syncDescription") }}
          </p>
        </div>
        <Button variant="outline" :disabled="syncLoading" @click="syncRecords">
          <Icon
            v-if="syncLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
          {{
            syncLoading
              ? t("operations.dns.settings.syncing")
              : t("operations.dns.settings.syncButton")
          }}
        </Button>
      </div>

      <Separator />

      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium text-destructive">
            {{ t("operations.dns.settings.dangerZone") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("operations.dns.settings.dangerDescription") }}
          </p>
        </div>
        <Button
          variant="destructive"
          :disabled="deleteLoading"
          @click="deleteDomain"
        >
          <Icon
            v-if="deleteLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
          {{ t("operations.dns.settings.deleteButton") }}
        </Button>
      </div>
    </div>
  </div>
</template>

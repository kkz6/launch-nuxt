<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import type { Site } from "~/types";

interface Props {
  serverId: string;
  site: Site;
  tlsOptions: Record<string, string>;
}

interface ActiveCertificate {
  stored_certificate_id?: string | null;
  private_key?: string;
  certificate?: string;
}

interface SiteWithActiveCertificate extends Site {
  activeCertificate?: ActiveCertificate;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  updated: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// `stored` is a client-only label; the backend treats it as `custom`
// with a stored_certificate_id. We submit `stored` and let the SSL
// service coerce, so the UI can distinguish on round-trip if needed.
const sslSchema = computed(() =>
  toTypedSchema(
    z
      .object({
        tls_setting: z.string(),
        private_key: z.string().optional(),
        certificate: z.string().optional(),
        stored_certificate_id: z.string().optional().nullable(),
      })
      .refine(
        (data) => {
          if (data.tls_setting === "custom") {
            return !!data.private_key || !!data.certificate;
          }
          if (data.tls_setting === "stored") {
            return !!data.stored_certificate_id;
          }
          return true;
        },
        {
          message: t("site.ssl.storedRequired"),
          path: ["stored_certificate_id"],
        },
      ),
  ),
);

// Pre-pick the stored cert if the site's active certificate was
// sourced from one — the FK rides on activeCertificate.stored_certificate_id.
const activeCertificate = (props.site as SiteWithActiveCertificate)
  .activeCertificate;
const initialStoredCertId = activeCertificate?.stored_certificate_id || null;

const initialTlsSetting = initialStoredCertId
  ? "stored"
  : props.site.tls_setting || "auto";

const { handleSubmit, values, setFieldError, resetForm, setFieldValue } =
  useForm({
    validationSchema: sslSchema,
    validateOnMount: false,
    initialValues: {
      tls_setting: initialTlsSetting,
      private_key: activeCertificate?.private_key || "",
      certificate: activeCertificate?.certificate || "",
      stored_certificate_id: initialStoredCertId,
    },
  });

const tlsLabels = computed<
  Record<string, { label: string; description: string }>
>(() => ({
  auto: {
    label: t("site.ssl.automatic"),
    description: t("site.ssl.automaticDescription"),
  },
  off: {
    label: t("site.ssl.disabled"),
    description: t("site.ssl.disabledDescription"),
  },
  stored: {
    label: t("site.ssl.stored"),
    description: t("site.ssl.storedDescription"),
  },
  custom: {
    label: t("site.ssl.custom"),
    description: t("site.ssl.customDescription"),
  },
}));

const handleClose = (open = false) => {
  isOpen.value = open;
  if (!open) {
    resetForm();
  }
};

const onSubmit = handleSubmit(async (formValues) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.ssl.confirmTitle"),
    description: t("site.ssl.confirmDescription"),
    confirmText: t("site.common.update"),
    cancelText: t("site.common.cancel"),
  });

  if (!result.ok) {
    toast.info(t("site.common.cancelled"));
    return;
  }

  isLoading.value = true;

  try {
    await $api(`/servers/${props.serverId}/sites/${props.site.id}/ssl`, {
      method: "PATCH",
      body: formValues,
    });
    toast.success(t("site.ssl.updated"));
    handleClose(false);
    emit("updated");
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof formValues, messages[0]);
      }
    } else {
      toast.error(err.data?.message || t("site.ssl.updateFailed"));
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>{{ t("site.ssl.update") }}</Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ t("site.ssl.title") }}</DialogTitle>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <FormField v-slot="{ componentField }" name="tls_setting">
          <FormItem class="space-y-3">
            <FormLabel>{{ t("site.ssl.certificateSettings") }}</FormLabel>
            <FormControl>
              <RadioGroup
                v-bind="componentField"
                class="flex flex-col space-y-2"
              >
                <FormItem
                  v-for="(option, key) in tlsLabels"
                  :key="key"
                  class="flex flex-col space-y-0"
                >
                  <div class="flex items-center space-x-3">
                    <FormControl>
                      <RadioGroupItem :value="key" />
                    </FormControl>
                    <FormLabel class="font-normal">
                      {{ option.label }}
                    </FormLabel>
                  </div>
                  <FormDescription class="ml-7">
                    {{ option.description }}
                  </FormDescription>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <template v-if="values.tls_setting === 'stored'">
          <FormField name="stored_certificate_id">
            <FormItem>
              <FormLabel>{{ t("site.ssl.storedCertificate") }}</FormLabel>
              <FormControl>
                <SharedCertificatePicker
                  :model-value="values.stored_certificate_id"
                  @update:model-value="
                    (v) => setFieldValue('stored_certificate_id', v)
                  "
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <template v-if="values.tls_setting === 'custom'">
          <FormField v-slot="{ componentField }" name="private_key">
            <FormItem>
              <FormLabel>{{ t("site.ssl.privateKey") }}</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="certificate">
            <FormItem>
              <FormLabel>{{ t("site.ssl.certificate") }}</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder="-----BEGIN CERTIFICATE-----"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <Button type="submit" :disabled="isLoading">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("site.ssl.update") }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

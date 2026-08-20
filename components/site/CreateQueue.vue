<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
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
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import type { Site } from "~/types";

interface QueueValues {
  queue_connection: string;
  queue: string;
  max_seconds_per_job: number;
  rest_seconds_on_empty: number;
  failed_job_delay_seconds: number;
  directory?: string;
  run_on_maintenance: boolean;
  run_with_listen: boolean;
  environment?: string;
  max_tries?: number;
  max_memory?: number;
  numprocs?: number;
  stop_wait_seconds?: number;
}

interface Queue extends QueueValues {
  id: string;
  user?: string;
}

interface Props {
  serverId: string;
  siteId: string;
  site: Site;
  queue?: Queue;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const isAdvancedOpen = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const queueSchema = computed(() =>
  toTypedSchema(
    z.object({
      queue_connection: z
        .string()
        .min(
          1,
          t("site.validation.required", {
            field: t("site.queueForm.connection"),
          }),
        )
        .max(
          50,
          t("site.validation.maxCharacters", {
            field: t("site.queueForm.connection"),
            max: 50,
          }),
        ),
      queue: z
        .string()
        .min(
          1,
          t("site.validation.required", {
            field: t("site.queueForm.queue"),
          }),
        )
        .max(
          50,
          t("site.validation.maxCharacters", {
            field: t("site.queueForm.queue"),
            max: 50,
          }),
        ),
      max_seconds_per_job: z.coerce.number().min(
        1,
        t("site.validation.minimum", {
          field: t("site.queueAdvanced.maxSecondsPerJob"),
          min: 1,
        }),
      ),
      rest_seconds_on_empty: z.coerce.number().min(
        0,
        t("site.validation.minimum", {
          field: t("site.queueAdvanced.restSecondsOnEmpty"),
          min: 0,
        }),
      ),
      failed_job_delay_seconds: z.coerce.number().min(
        0,
        t("site.validation.minimum", {
          field: t("site.queueAdvanced.failedJobDelaySeconds"),
          min: 0,
        }),
      ),
      directory: z.string().optional(),
      run_on_maintenance: z.boolean(),
      run_with_listen: z.boolean(),
      environment: z
        .string()
        .max(
          255,
          t("site.validation.maxCharacters", {
            field: t("site.queueAdvanced.environment"),
            max: 255,
          }),
        )
        .optional(),
      max_tries: z.coerce.number().optional(),
      max_memory: z.coerce
        .number()
        .min(
          128,
          t("site.validation.minimum", {
            field: t("site.queueAdvanced.maxMemory"),
            min: 128,
          }),
        )
        .optional(),
      numprocs: z.coerce.number().optional(),
      stop_wait_seconds: z.coerce.number().optional(),
    }),
  ),
);

const getInitialValues = () => {
  const sitePath = props.site.path;

  if (props.queue) {
    return {
      queue_connection: props.queue.queue_connection,
      queue: props.queue.queue,
      max_seconds_per_job: props.queue.max_seconds_per_job,
      rest_seconds_on_empty: props.queue.rest_seconds_on_empty,
      failed_job_delay_seconds: props.queue.failed_job_delay_seconds,
      directory: props.queue.directory || sitePath,
      run_on_maintenance: props.queue.run_on_maintenance,
      run_with_listen: props.queue.run_with_listen,
      environment: props.queue.environment,
      max_tries: props.queue.max_tries,
      max_memory: props.queue.max_memory,
      numprocs: props.queue.numprocs || 1,
      stop_wait_seconds: props.queue.stop_wait_seconds || 10,
    };
  }
  return {
    queue_connection: "database",
    queue: "default",
    max_seconds_per_job: 60,
    rest_seconds_on_empty: 10,
    failed_job_delay_seconds: 3,
    directory: sitePath,
    run_on_maintenance: false,
    run_with_listen: false,
    numprocs: 1,
    stop_wait_seconds: 10,
  };
};

const { handleSubmit, resetForm, setFieldError, values, setValues } = useForm({
  validationSchema: queueSchema,
  validateOnMount: false,
  initialValues: getInitialValues(),
});

const handleClose = (isOpen = false) => {
  open.value = isOpen;
  if (!isOpen) {
    resetForm({ values: getInitialValues() });
  }
};

watch(open, (isOpen) => {
  if (isOpen) {
    // Reset form with initial values when opening
    setValues(getInitialValues());
  }
});

const onSubmit = handleSubmit(async (formValues) => {
  if (!confirmationDialog.value) return;

  const isEdit = !!props.queue;
  const result = await confirmationDialog.value.show({
    title: isEdit
      ? t("site.queueForm.updateTitle")
      : t("site.queueForm.createTitle"),
    description: isEdit
      ? t("site.queueForm.updateConfirm")
      : t("site.queueForm.createConfirm"),
    confirmText: isEdit ? t("site.common.update") : t("site.common.create"),
    cancelText: t("site.common.cancel"),
  });

  if (!result.ok) {
    toast.info(t("site.common.cancelled"));
    return;
  }

  isLoading.value = true;

  try {
    const url = isEdit
      ? `/servers/${props.serverId}/sites/${props.siteId}/queues/${props.queue!.id}`
      : `/servers/${props.serverId}/sites/${props.siteId}/queues`;

    await $api(url, {
      method: isEdit ? "PATCH" : "POST",
      body: formValues,
    });
    toast.success(
      isEdit ? t("site.queueForm.updated") : t("site.queueForm.created"),
    );
    handleClose(false);
    if (isEdit) {
      emit("updated");
    } else {
      emit("created");
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof formValues, messages[0]);
      }
    } else {
      toast.error(
        err.data?.message ||
          t(
            isEdit
              ? "site.queueForm.updateFailed"
              : "site.queueForm.createFailed",
          ),
      );
    }
  } finally {
    isLoading.value = false;
  }
});

const advancedValues = computed({
  get: () => values as QueueValues,
  set: (newValues: QueueValues) => setValues(newValues),
});
</script>

<template>
  <Dialog v-model:open="open" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("site.queueForm.add") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>
          {{
            queue
              ? t("site.queueForm.updateTitle")
              : t("site.queueForm.createTitle")
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            queue
              ? t("site.queueForm.updateDescription")
              : t("site.queueForm.createDescription")
          }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="{ componentField }" name="queue_connection">
            <FormItem>
              <FormLabel>{{ t("site.queueForm.connection") }}</FormLabel>
              <FormControl>
                <Input placeholder="redis" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="queue">
            <FormItem>
              <FormLabel>{{ t("site.queueForm.queue") }}</FormLabel>
              <FormControl>
                <Input placeholder="default" v-bind="componentField" />
              </FormControl>
              <FormDescription>{{
                t("site.queueForm.queueDescription")
              }}</FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <DialogFooter class="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            @click="isAdvancedOpen = true"
          >
            <Settings class="mr-2 h-4 w-4" />
            {{ t("site.queueForm.advanced") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ queue ? t("site.common.update") : t("site.common.create") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <SiteQueueAdvancedOptions
    v-model:open="isAdvancedOpen"
    :values="advancedValues"
    @update:values="setValues($event)"
  />
</template>

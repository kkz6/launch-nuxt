<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import type { Site } from "~/types";

interface Props {
  serverId: string;
  site: Site;
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

interface SiteDeploymentFields {
  shared_directories?: string[];
  shared_files?: string[];
  writeable_directories?: string[];
  hook_before_updating_repository?: string;
  hook_after_updating_repository?: string;
  hook_before_making_current?: string;
  hook_after_making_current?: string;
  deployment_releases_retention?: number;
  queue_deployments?: boolean;
}

const deploymentSchema = computed(() =>
  toTypedSchema(
    z.object({
      deployment_releases_retention: z.coerce
        .number()
        .min(
          1,
          t("site.validation.minimum", {
            field: t("site.deploymentSettings.releasesRetention"),
            min: 1,
          }),
        )
        .max(
          50,
          t("site.validation.maximum", {
            field: t("site.deploymentSettings.releasesRetention"),
            max: 50,
          }),
        )
        .optional(),
      shared_directories: z.string().optional(),
      writeable_directories: z.string().optional(),
      shared_files: z.string().optional(),
      hook_before_updating_repository: z.string().optional(),
      hook_after_updating_repository: z.string().optional(),
      hook_before_making_current: z.string().optional(),
      hook_after_making_current: z.string().optional(),
      queue_deployments: z.boolean().optional(),
    }),
  ),
);

const getInitialValues = () => {
  const site = props.site as Site & SiteDeploymentFields;
  return {
    shared_directories: site.shared_directories?.join("\n") || "",
    shared_files: site.shared_files?.join("\n") || "",
    writeable_directories: site.writeable_directories?.join("\n") || "",
    deployment_releases_retention: site.deployment_releases_retention || 5,
    hook_before_updating_repository: site.hook_before_updating_repository || "",
    hook_before_making_current: site.hook_before_making_current || "",
    hook_after_making_current: site.hook_after_making_current || "",
    hook_after_updating_repository: site.hook_after_updating_repository || "",
    queue_deployments: site.queue_deployments || false,
  };
};

const { handleSubmit, setFieldError, resetForm, setValues, values } = useForm({
  validationSchema: deploymentSchema,
  validateOnMount: false,
  initialValues: getInitialValues(),
});

const queueDeployments = computed({
  get: () => values.queue_deployments ?? false,
  set: (val: boolean) => setValues({ queue_deployments: val }),
});

const handleClose = (open = false) => {
  isOpen.value = open;
  if (!open) {
    resetForm();
  }
};

// Reset form with current site values when dialog opens
watch(isOpen, (open) => {
  if (open) {
    setValues(getInitialValues());
  }
});

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.deploymentSettings.confirmTitle"),
    description: t("site.deploymentSettings.confirmDescription"),
    confirmText: t("site.common.update"),
    cancelText: t("site.common.cancel"),
  });

  if (!result.ok) {
    toast.info(t("site.common.cancelled"));
    return;
  }

  isLoading.value = true;

  try {
    await $api(
      `/servers/${props.serverId}/sites/${props.site.id}/deployment-settings`,
      {
        method: "PATCH",
        body: values,
      },
    );
    toast.success(t("site.deploymentSettings.updated"));
    handleClose(false);
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
        err.data?.message || t("site.deploymentSettings.updateFailed"),
      );
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>{{ t("site.deploymentSettings.title") }}</Button>
    </DialogTrigger>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ t("site.deploymentSettings.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("site.deploymentSettings.description") }}
        </DialogDescription>
      </DialogHeader>

      <form class="w-full space-y-4" @submit.prevent="onSubmit">
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>{{ t("site.deploymentSettings.queueDeployments") }}</Label>
            <p class="text-sm text-muted-foreground">
              {{ t("site.deploymentSettings.queueDeploymentsDescription") }}
            </p>
          </div>
          <Switch v-model="queueDeployments" />
        </div>

        <template v-if="(site as any).zero_downtime_deployment">
          <FormField
            v-slot="{ componentField }"
            name="deployment_releases_retention"
          >
            <FormItem>
              <FormLabel>{{
                t("site.deploymentSettings.releasesRetention")
              }}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  :min="1"
                  :max="50"
                  v-bind="componentField"
                />
              </FormControl>
              <FormDescription>
                {{ t("site.deploymentSettings.releasesRetentionDescription") }}
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="space-y-2">
            <Label>{{ t("site.deploymentSettings.sharedDirectories") }}</Label>
            <SharedCodeEditor
              :model-value="values.shared_directories || ''"
              class="h-36"
              placeholder="storage"
              :line-numbers="false"
              :fold-gutter="false"
              @update:model-value="
                (val: string) => setValues({ shared_directories: val })
              "
            />
            <p class="text-sm text-muted-foreground">
              {{ t("site.deploymentSettings.sharedDirectoriesDescription") }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>{{ t("site.deploymentSettings.sharedFiles") }}</Label>
            <SharedCodeEditor
              :model-value="values.shared_files || ''"
              class="h-36"
              placeholder=".env"
              :line-numbers="false"
              :fold-gutter="false"
              @update:model-value="
                (val: string) => setValues({ shared_files: val })
              "
            />
            <p class="text-sm text-muted-foreground">
              {{ t("site.deploymentSettings.sharedFilesDescription") }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>{{
              t("site.deploymentSettings.writeableDirectories")
            }}</Label>
            <SharedCodeEditor
              :model-value="values.writeable_directories || ''"
              class="h-36"
              placeholder="storage"
              :line-numbers="false"
              :fold-gutter="false"
              @update:model-value="
                (val: string) => setValues({ writeable_directories: val })
              "
            />
            <p class="text-sm text-muted-foreground">
              {{ t("site.deploymentSettings.writeableDirectoriesDescription") }}
            </p>
          </div>
        </template>

        <div class="space-y-2">
          <Label>{{
            t("site.deploymentSettings.beforeUpdatingRepository")
          }}</Label>
          <SharedCodeEditor
            :model-value="values.hook_before_updating_repository || ''"
            class="h-36"
            :placeholder="
              t('site.deploymentSettings.beforeUpdatingRepositoryPlaceholder')
            "
            @update:model-value="
              (val: string) =>
                setValues({ hook_before_updating_repository: val })
            "
          />
          <p class="text-sm text-muted-foreground">
            {{
              t("site.deploymentSettings.beforeUpdatingRepositoryDescription")
            }}
          </p>
        </div>

        <div class="space-y-2">
          <Label>{{
            t("site.deploymentSettings.afterUpdatingRepository")
          }}</Label>
          <SharedCodeEditor
            :model-value="values.hook_after_updating_repository || ''"
            class="h-36"
            placeholder="composer install --no-dev"
            @update:model-value="
              (val: string) =>
                setValues({ hook_after_updating_repository: val })
            "
          />
          <p class="text-sm text-muted-foreground">
            {{
              t("site.deploymentSettings.afterUpdatingRepositoryDescription")
            }}
          </p>
        </div>

        <div class="space-y-2">
          <Label>{{ t("site.deploymentSettings.beforeMakingCurrent") }}</Label>
          <SharedCodeEditor
            :model-value="values.hook_before_making_current || ''"
            class="h-36"
            placeholder="php artisan migrate --force"
            @update:model-value="
              (val: string) => setValues({ hook_before_making_current: val })
            "
          />
          <p class="text-sm text-muted-foreground">
            {{ t("site.deploymentSettings.beforeMakingCurrentDescription") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label>{{ t("site.deploymentSettings.afterMakingCurrent") }}</Label>
          <SharedCodeEditor
            :model-value="values.hook_after_making_current || ''"
            class="h-36"
            placeholder="php artisan cache:clear"
            @update:model-value="
              (val: string) => setValues({ hook_after_making_current: val })
            "
          />
          <p class="text-sm text-muted-foreground">
            {{ t("site.deploymentSettings.afterMakingCurrentDescription") }}
          </p>
        </div>

        <Button type="submit" :disabled="isLoading">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("site.deploymentSettings.submit") }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

interface Props {
  open: boolean;
  featureId: string;
  featureName: string;
  action: "enable" | "disable";
  queueCount: number;
}

const props = defineProps<Props>();
const { locale, t } = useI18n();

const emit = defineEmits<{
  "update:open": [value: boolean];
  confirm: [
    options: {
      delete_queues?: boolean;
      configure_env?: boolean;
      update_caddyfile?: boolean;
    },
  ];
}>();

const deleteQueues = ref(true);
const configureEnv = ref(true);
const updateCaddyfile = ref(true);

const dialogTitle = computed(() => {
  return t(
    props.action === "enable"
      ? "site.featureDialog.enableTitle"
      : "site.featureDialog.disableTitle",
    { feature: props.featureName },
  );
});

const dialogDescription = computed(() => {
  if (props.action === "enable") {
    switch (props.featureId) {
      case "horizon":
        return t("site.featureDialog.horizonDescription");
      case "reverb":
        return t("site.featureDialog.reverbDescription");
      case "inertia":
        return t("site.featureDialog.inertiaDescription");
      default:
        return t("site.featureDialog.enableDescription", {
          feature: props.featureName,
        });
    }
  }

  return t("site.featureDialog.disableDescription", {
    feature: props.featureName,
  });
});

const formattedQueueCount = computed(() =>
  new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "en-US").format(
    props.queueCount,
  ),
);

const showDeleteQueuesOption = computed(() => {
  return (
    props.featureId === "horizon" &&
    props.action === "enable" &&
    props.queueCount > 0
  );
});

const showConfigureEnvOption = computed(() => {
  return props.featureId === "reverb" && props.action === "enable";
});

const showUpdateCaddyfileOption = computed(() => {
  return props.featureId === "reverb" && props.action === "enable";
});

function handleConfirm() {
  const options: {
    delete_queues?: boolean;
    configure_env?: boolean;
    update_caddyfile?: boolean;
  } = {};

  if (showDeleteQueuesOption.value) {
    options.delete_queues = deleteQueues.value;
  }

  if (showConfigureEnvOption.value) {
    options.configure_env = configureEnv.value;
  }

  if (showUpdateCaddyfileOption.value) {
    options.update_caddyfile = updateCaddyfile.value;
  }

  emit("confirm", options);
  emit("update:open", false);
}

function handleClose(open: boolean) {
  emit("update:open", open);
}
</script>

<template>
  <AlertDialog :open="open" @update:open="handleClose">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ dialogTitle }}</AlertDialogTitle>
        <AlertDialogDescription>{{ dialogDescription }}</AlertDialogDescription>
      </AlertDialogHeader>

      <div
        v-if="
          showDeleteQueuesOption ||
          showConfigureEnvOption ||
          showUpdateCaddyfileOption
        "
        class="space-y-3 py-2"
      >
        <div v-if="showDeleteQueuesOption" class="flex items-center gap-2">
          <Checkbox
            id="delete-queues"
            :checked="deleteQueues"
            @update:checked="deleteQueues = !!$event"
          />
          <Label for="delete-queues" class="text-sm font-normal">
            {{
              t(
                queueCount === 1
                  ? "site.featureDialog.deleteQueuesOne"
                  : "site.featureDialog.deleteQueuesOther",
                { count: formattedQueueCount },
              )
            }}
          </Label>
        </div>

        <div v-if="showConfigureEnvOption" class="flex items-center gap-2">
          <Checkbox
            id="configure-env"
            :checked="configureEnv"
            @update:checked="configureEnv = !!$event"
          />
          <Label for="configure-env" class="text-sm font-normal">
            {{ t("site.featureDialog.configureEnv") }}
          </Label>
        </div>

        <div v-if="showUpdateCaddyfileOption" class="flex items-center gap-2">
          <Checkbox
            id="update-caddyfile"
            :checked="updateCaddyfile"
            @update:checked="updateCaddyfile = !!$event"
          />
          <Label for="update-caddyfile" class="text-sm font-normal">
            {{ t("site.featureDialog.updateCaddyfile") }}
          </Label>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("site.common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction @click="handleConfirm">
          {{
            action === "enable"
              ? t("site.featureDialog.enable")
              : t("site.featureDialog.disable")
          }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

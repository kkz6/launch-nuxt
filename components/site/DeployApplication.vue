<script setup lang="ts">
import { toast } from "vue-sonner";
import { CloudUpload } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { Deployment } from "~/types";

interface Props {
  serverId: string;
  siteId: string;
  isDeploying?: boolean;
  asIcon?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  asIcon: false,
  isDeploying: false,
});
const { t } = useI18n();

// `deployed` carries the freshly-created deployment so parents can update
// site.latest_deployment optimistically rather than waiting for the
// WebSocket broadcast → debounced refetch (≈500ms of stale UI otherwise).
const emit = defineEmits<{
  deployed: [deployment: Deployment];
}>();

const isOpen = ref(false);
const isLoading = ref(props.isDeploying);

// Watch for external isDeploying changes
watch(
  () => props.isDeploying,
  (val) => {
    isLoading.value = val;
  },
);

const deploy = async () => {
  isLoading.value = true;
  try {
    const res = await $api<{ data: Deployment }>(
      `/servers/${props.serverId}/sites/${props.siteId}/deploy`,
      { method: "POST" },
    );
    toast.info(t("site.deploy.started"));
    emit("deployed", res.data);
    isOpen.value = false;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("site.deploy.failed"));
    isLoading.value = false;
  }
};

const modifierKey = computed(() => {
  if (import.meta.client) {
    return navigator.platform.includes("Mac") ? "Cmd" : "Ctrl";
  }
  return "Ctrl";
});
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <template v-if="asIcon">
      <TooltipProvider :delay-duration="0">
        <Tooltip>
          <TooltipTrigger as-child>
            <AlertDialogTrigger as-child>
              <Button
                class="mb-3"
                :disabled="isLoading"
                variant="ghost"
                size="icon"
                :aria-label="t('site.deploy.applicationAria')"
              >
                <Icon
                  v-if="isLoading"
                  name="lucide:loader-2"
                  class="h-4 w-4 animate-spin"
                />
                <CloudUpload v-else class="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <div class="flex items-center gap-2">
              <span>{{ t("site.common.deploy") }}</span>
              <kbd
                class="rounded border border-border bg-muted px-1.5 py-0.5 text-xs"
              >
                {{ modifierKey }}+Shift+D
              </kbd>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
    <template v-else>
      <AlertDialogTrigger as-child>
        <Button
          :disabled="isLoading"
          :aria-label="t('site.deploy.applicationAria')"
        >
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ isLoading ? t("site.deploy.deploying") : t("site.common.deploy") }}
        </Button>
      </AlertDialogTrigger>
    </template>

    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t("site.deploy.confirmTitle") }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t("site.deploy.confirmDescription") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t("site.common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction @click="deploy">
          {{ t("site.common.confirm") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

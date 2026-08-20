<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import type { Server } from "~/types";

interface Props {
  server: Server;
}

const props = defineProps<Props>();
const { t } = useI18n();

const name = ref(props.server.name);
const description = ref(props.server.description || "");
const autoUpdate = ref(
  props.server.auto_update === "true" || props.server.auto_update === "1",
);
const isLoading = ref(false);
const deleteLoading = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);
const siteCount = ref(0);

// Projects only exist on docker servers — backend returns
// `projects_count` on the server response, defaulting to 0 for the
// PHP / database / loadbalancer types. We read it off the prop so the
// guard works on first render without an extra HTTP roundtrip.
const projectsCount = computed(() => Number(props.server.projects_count ?? 0));
const isDockerServer = computed(() => props.server.type === "docker");

const canDelete = computed(() => {
  if (siteCount.value > 0) return false;
  if (isDockerServer.value && projectsCount.value > 0) return false;
  return true;
});

onMounted(async () => {
  try {
    const data = await $api<{ data: { count: number } }>(
      `/servers/${props.server.id}/site-count`,
    );
    siteCount.value = data.data?.count || 0;
  } catch {
    siteCount.value = 0;
  }
});

const updateServer = async () => {
  isLoading.value = true;
  try {
    await $api(`/servers/${props.server.id}`, {
      method: "PATCH",
      body: {
        name: name.value,
        description: description.value,
        auto_update: autoUpdate.value,
      },
    });
    toast.success(t("server.settings.general.updated"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.settings.general.updateFailed"));
  } finally {
    isLoading.value = false;
  }
};

const deleteServer = async () => {
  if (siteCount.value > 0) {
    toast.error(t("server.settings.general.activeSitesError"));
    return;
  }
  // Docker servers carry projects (which carry apps / compose / db
  // workloads). Refuse the delete here so the user gets immediate
  // feedback — the backend re-validates the same condition and would
  // 422 otherwise, but a toast on click is friendlier than a roundtrip.
  if (isDockerServer.value && projectsCount.value > 0) {
    toast.error(
      t("server.settings.general.activeProjectsError", {
        count: projectsCount.value,
      }),
    );
    return;
  }

  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.settings.general.deleteTitle"),
    description: t("server.settings.general.deleteDescription", {
      name: props.server.name,
    }),
    confirmText: t("server.settings.general.deleteTitle"),
    cancelText: t("server.common.cancel"),
    destructive: true,
    helpText: t("server.settings.general.deleteHelp"),
    inputVerificationText: props.server.name,
  });

  if (!result.ok) return;

  deleteLoading.value = true;
  try {
    await $api(`/servers/${props.server.id}`, {
      method: "DELETE",
    });
    toast.success(t("server.pending.deleted"));
    navigateTo("/servers");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.pending.deleteFailed"));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Server Information -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">
          {{ t("server.settings.general.information") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("server.settings.general.informationDescription") }}
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="name">{{
            t("server.settings.general.serverName")
          }}</Label>
          <Input
            id="name"
            v-model="name"
            :placeholder="t('server.settings.general.serverNamePlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <Label for="description">{{
            t("server.settings.general.description")
          }}</Label>
          <Textarea
            id="description"
            v-model="description"
            :placeholder="t('server.settings.general.descriptionPlaceholder')"
            :rows="3"
          />
        </div>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>{{ t("server.settings.general.autoUpdates") }}</Label>
            <p class="text-sm text-muted-foreground">
              {{ t("server.settings.general.autoUpdatesDescription") }}
            </p>
          </div>
          <Switch v-model="autoUpdate" />
        </div>

        <Button :disabled="isLoading" @click="updateServer">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("server.settings.general.saveChanges") }}
        </Button>
      </div>
    </div>

    <Separator />

    <!-- Danger Zone -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">
          {{ t("server.settings.general.dangerZone") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("server.settings.general.dangerDescription") }}
        </p>
      </div>

      <!-- Reason copy depends on what's blocking the delete. We check
           sites first (PHP servers can't have projects), then docker
           projects (which only apply when isDockerServer is true). The
           backend re-validates both — this banner is the proactive UX. -->
      <div
        v-if="!canDelete"
        class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50"
      >
        <div class="space-y-1">
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {{ t("server.settings.general.cannotDelete") }}
          </p>
          <p
            v-if="siteCount > 0"
            class="text-sm text-yellow-700 dark:text-yellow-300"
          >
            {{ t("server.settings.general.activeSites", { count: siteCount }) }}
          </p>
          <p v-else class="text-sm text-yellow-700 dark:text-yellow-300">
            {{
              t("server.settings.general.activeProjects", {
                count: projectsCount,
              })
            }}
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        :disabled="!canDelete || deleteLoading"
        @click="deleteServer"
      >
        <Icon
          v-if="deleteLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        {{ t("server.settings.general.deleteTitle") }}
      </Button>
    </div>
  </div>
</template>

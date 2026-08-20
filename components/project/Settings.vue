<script setup lang="ts">
import { toast } from "vue-sonner";
import { Separator } from "~/components/ui/separator";
import { dockerService, type DockerProject } from "~/services/dockerService";

interface Props {
  serverId: string;
  project: DockerProject;
}
const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

const name = ref(props.project.name);
const description = ref(props.project.description ?? "");
const isLoading = ref(false);
const deleteLoading = ref(false);

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Keep refs in sync if the parent refetches.
watch(
  () => props.project,
  (p) => {
    name.value = p.name;
    description.value = p.description ?? "";
  },
);

const totalWorkloads = computed(
  () =>
    props.project.applications_count +
    props.project.composes_count +
    props.project.databases_count,
);
const canDelete = computed(() => totalWorkloads.value === 0);

// Role gating — only admins/owners see the Danger Zone at all (aliased
// to avoid colliding with the workload-based canDelete above).
const { canDelete: canDeleteByRole } = useCan();

// Per-kind breakdown for the yellow "cannot delete" callout — gives
// the user a precise list of what still has to go before they can
// remove the project.
const workloadSummary = computed(() => {
  const parts: string[] = [];
  const p = props.project;
  if (p.applications_count > 0)
    parts.push(
      t("workload.project.settings.applicationCount", {
        count: p.applications_count,
      }),
    );
  if (p.composes_count > 0)
    parts.push(
      t("workload.project.settings.composeCount", { count: p.composes_count }),
    );
  if (p.databases_count > 0)
    parts.push(
      t("workload.project.settings.databaseCount", {
        count: p.databases_count,
      }),
    );
  return parts.join(", ");
});

const updateProject = async () => {
  const trimmed = name.value.trim();
  if (!trimmed) {
    toast.error(t("workload.project.settings.nameRequired"));
    return;
  }
  isLoading.value = true;
  try {
    await dockerService.projects.update(props.serverId, props.project.id, {
      name: trimmed,
      description: description.value.trim(),
    });
    toast.success(t("workload.project.settings.updated"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.project.settings.updateFailed"));
  } finally {
    isLoading.value = false;
  }
};

const deleteProject = async () => {
  if (!canDelete.value) {
    toast.error(
      t("workload.project.settings.deleteBlockedToast", {
        workloads: workloadSummary.value,
      }),
    );
    return;
  }
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("workload.project.settings.deleteTitle"),
    description: t("workload.project.settings.deleteDescription", {
      name: props.project.name,
    }),
    confirmText: t("workload.project.settings.deleteTitle"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    helpText: t("workload.project.settings.deleteHelp"),
    inputVerificationText: props.project.name,
  });
  if (!result.ok) return;

  deleteLoading.value = true;
  try {
    await dockerService.projects.delete(props.serverId, props.project.id);
    toast.success(t("workload.project.settings.deleted"));
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.project.settings.deleteFailed"));
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <!--
    Mirrors components/server/settings/General.vue: top-level space-y-6,
    each section is a heading block + a space-y-4 form column, a single
    Separator before Danger Zone, and the yellow callout for "cannot
    delete" uses the exact same colour ramp. Keep it pixel-close so the
    docker workload pages feel native next to the server settings.
  -->
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Project Information -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">
          {{ t("workload.project.settings.information") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("workload.project.settings.informationDescription") }}
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="project-name">
            {{ t("workload.project.settings.projectName") }}
          </Label>
          <Input
            id="project-name"
            v-model="name"
            :placeholder="t('workload.project.settings.namePlaceholder')"
          />
        </div>

        <div class="space-y-2">
          <Label for="project-description">{{
            t("workload.fields.description")
          }}</Label>
          <Textarea
            id="project-description"
            v-model="description"
            :placeholder="t('workload.project.settings.descriptionPlaceholder')"
            :rows="3"
          />
        </div>

        <Button :disabled="isLoading" @click="updateProject">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("workload.actions.saveChanges") }}
        </Button>
      </div>
    </div>

    <Separator />

    <!-- Danger Zone -->
    <div v-if="canDeleteByRole" class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">
          {{ t("workload.danger.title") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("workload.project.settings.dangerDescription") }}
        </p>
      </div>

      <!--
        Yellow callout reuses the exact tone components/server/settings/
        General.vue uses for "cannot delete server" — so the blocked
        state feels consistent across servers + docker workloads.
      -->
      <div
        v-if="!canDelete"
        class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50"
      >
        <div class="space-y-1">
          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {{ t("workload.project.settings.cannotDelete") }}
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            {{
              t("workload.project.settings.cannotDeleteDescription", {
                workloads: workloadSummary,
              })
            }}
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        :disabled="!canDelete || deleteLoading"
        @click="deleteProject"
      >
        <Icon
          v-if="deleteLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        {{ t("workload.project.settings.deleteTitle") }}
      </Button>
    </div>
  </div>
</template>

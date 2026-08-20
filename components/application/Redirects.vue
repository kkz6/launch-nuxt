<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  dockerService,
  type DockerApplication,
  type DockerApplicationRedirect,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const { t } = useI18n();

// Per-app redirect list. The CreateRedirect dialog handles both
// create AND edit (same shape the PHP site uses) — selectedRedirect
// drives which mode the dialog opens in.
const redirects = ref<DockerApplicationRedirect[]>([]);
const isLoading = ref(true);
const selectedRedirect = ref<DockerApplicationRedirect | null>(null);
const isEditDialogOpen = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const redirectTypeLabels = computed<Record<number, string>>(() => ({
  301: t("workload.redirects.permanent", { code: 301 }),
  302: t("workload.redirects.temporary", { code: 302 }),
  307: t("workload.redirects.temporary", { code: 307 }),
  308: t("workload.redirects.permanent", { code: 308 }),
}));

const columns = computed(() => [
  { key: "from", label: t("workload.redirects.from"), width: "30%" },
  { key: "to", label: t("workload.redirects.to"), width: "35%" },
  { key: "type", label: t("workload.fields.type"), width: "15%" },
  { key: "created_at", label: t("workload.fields.created"), width: "20%" },
]);

const redirectTypeVariants: Record<
  number,
  "default" | "secondary" | "success" | "warning"
> = {
  301: "success",
  302: "warning",
  307: "warning",
  308: "success",
};

const fetchRedirects = async () => {
  try {
    const res = await dockerService.applications.listRedirects(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    redirects.value = res.data;
  } catch {
    toast.error(t("workload.redirects.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const editRedirect = (redirect: DockerApplicationRedirect) => {
  selectedRedirect.value = redirect;
  isEditDialogOpen.value = true;
};

const handleRedirectUpdated = () => {
  isEditDialogOpen.value = false;
  selectedRedirect.value = null;
  fetchRedirects();
};

watch(isEditDialogOpen, (open) => {
  if (!open) selectedRedirect.value = null;
});

const deleteRedirect = async (redirect: DockerApplicationRedirect) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("workload.redirects.deleteTitle"),
    description: t("workload.redirects.deleteDescription", {
      from: redirect.from,
    }),
    confirmText: t("workload.actions.delete"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
  });

  if (!result.ok) return;
  try {
    await dockerService.applications.deleteRedirect(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      redirect.id,
    );
    redirects.value = redirects.value.filter((r) => r.id !== redirect.id);
    toast.success(t("workload.redirects.deleted"));
  } catch {
    toast.error(t("workload.redirects.deleteFailed"));
  }
};

onMounted(fetchRedirects);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Edit dialog — same component is reused for create from the
         header + empty-state slots below. Mounting it only when
         selectedRedirect is set keeps form state out of the DOM when
         the user isn't editing. -->
    <ApplicationCreateRedirect
      v-if="selectedRedirect"
      v-model:open="isEditDialogOpen"
      :application="application"
      :redirect="selectedRedirect"
      @updated="handleRedirectUpdated"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">
          {{ t("workload.redirects.title") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("workload.redirects.description") }}
        </p>
      </div>
      <ApplicationCreateRedirect
        v-if="redirects.length > 0"
        :application="application"
        @created="fetchRedirects"
      />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <SharedDataTable
        :data="redirects"
        :columns="columns"
        :empty-title="t('workload.redirects.emptyTitle')"
        :empty-description="t('workload.redirects.emptyDescription')"
        empty-icon="lucide:corner-up-right"
      >
        <template #cell-from="{ row }">
          <code class="rounded bg-muted px-2 py-1 text-sm">{{ row.from }}</code>
        </template>

        <template #cell-to="{ row }">
          <code class="max-w-xs truncate rounded bg-muted px-2 py-1 text-sm">
            {{ row.to }}
          </code>
        </template>

        <template #cell-type="{ row }">
          <Badge :variant="redirectTypeVariants[row.type] || 'secondary'">
            {{ redirectTypeLabels[row.type] || row.type }}
          </Badge>
        </template>

        <template #cell-created_at="{ row }">
          <SharedDateTooltip v-if="row.created_at" :date="row.created_at" />
          <span v-else class="text-muted-foreground">—</span>
        </template>

        <template #actions="{ item }">
          <Button
            variant="ghost"
            size="icon"
            :title="t('workload.actions.edit')"
            @click="editRedirect(item)"
          >
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="t('workload.actions.delete')"
            class="hover:bg-destructive/90 hover:text-white"
            @click="deleteRedirect(item)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </template>

        <template #empty>
          <ApplicationCreateRedirect
            :application="application"
            @created="fetchRedirects"
          />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>

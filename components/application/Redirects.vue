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

// Per-app redirect list. The CreateRedirect dialog handles both
// create AND edit (same shape the PHP site uses) — selectedRedirect
// drives which mode the dialog opens in.
const redirects = ref<DockerApplicationRedirect[]>([]);
const isLoading = ref(true);
const selectedRedirect = ref<DockerApplicationRedirect | null>(null);
const isEditDialogOpen = ref(false);
const confirmationDialog = ref<
  InstanceType<
    typeof import("~/components/shared/ConfirmationDialog.vue").default
  > | null
>(null);

const redirectTypeLabels: Record<number, string> = {
  301: "Permanent (301)",
  302: "Temporary (302)",
  307: "Temporary (307)",
  308: "Permanent (308)",
};

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
    toast.error("Failed to load redirects");
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
    title: "Delete Redirect",
    description: `Are you sure you want to delete the redirect from "${redirect.from}"?`,
    confirmText: "Delete",
    cancelText: "Cancel",
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
    toast.success("Redirect deleted");
  } catch {
    toast.error("Failed to delete redirect");
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
        <h3 class="text-lg font-semibold">Redirects</h3>
        <p class="text-sm text-muted-foreground">
          Manage URL redirects for this application
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
        :columns="[
          { key: 'from', label: 'From', width: '30%' },
          { key: 'to', label: 'To', width: '35%' },
          { key: 'type', label: 'Type', width: '15%' },
          { key: 'created_at', label: 'Created', width: '20%' },
        ]"
        empty-title="No redirects found"
        empty-description="Create a redirect to forward URLs to a new location"
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
            title="Edit"
            @click="editRedirect(item)"
          >
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
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

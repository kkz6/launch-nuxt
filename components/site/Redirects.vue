<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

interface Redirect {
  id: string;
  from: string;
  to: string;
  type: number;
  created_at: string;
}

interface Props {
  serverId: string;
  siteId: string;
  siteAddress?: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const redirects = ref<Redirect[]>([]);
const isLoading = ref(true);
const selectedRedirect = ref<Redirect | null>(null);
const isEditDialogOpen = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const redirectTypeLabels = computed<Record<number, string>>(() => ({
  301: t("site.redirects.permanent301"),
  302: t("site.redirects.temporary302"),
  307: t("site.redirects.temporary307"),
  308: t("site.redirects.permanent308"),
}));

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
    const data = await $api<{ data: Redirect[] }>(
      `/servers/${props.serverId}/sites/${props.siteId}/redirects`,
    );
    redirects.value = data.data;
  } catch {
    toast.error(t("site.redirects.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const editRedirect = (redirect: Redirect) => {
  selectedRedirect.value = redirect;
  isEditDialogOpen.value = true;
};

const handleRedirectUpdated = () => {
  isEditDialogOpen.value = false;
  selectedRedirect.value = null;
  fetchRedirects();
};

watch(isEditDialogOpen, (open) => {
  if (!open) {
    selectedRedirect.value = null;
  }
});

const deleteRedirect = async (redirect: Redirect) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("site.redirects.deleteTitle"),
    description: t("site.redirects.deleteDescription", {
      path: redirect.from,
    }),
    confirmText: t("site.common.delete"),
    cancelText: t("site.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(
        `/servers/${props.serverId}/sites/${props.siteId}/redirects/${redirect.id}`,
        {
          method: "DELETE",
        },
      );
      redirects.value = redirects.value.filter((r) => r.id !== redirect.id);
      toast.success(t("site.redirects.deleted"));
    } catch {
      toast.error(t("site.redirects.deleteFailed"));
    }
  }
};

onMounted(fetchRedirects);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Edit Redirect Dialog -->
    <SiteCreateRedirect
      v-if="selectedRedirect"
      v-model:open="isEditDialogOpen"
      :server-id="serverId"
      :site-id="siteId"
      :site-address="siteAddress"
      :redirect="selectedRedirect"
      @updated="handleRedirectUpdated"
    />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("site.redirects.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("site.redirects.description") }}
        </p>
      </div>
      <SiteCreateRedirect
        v-if="redirects.length > 0"
        :server-id="serverId"
        :site-id="siteId"
        :site-address="siteAddress"
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
          { key: 'from', label: t('site.common.from'), width: '30%' },
          { key: 'to', label: t('site.common.to'), width: '35%' },
          { key: 'type', label: t('site.common.type'), width: '15%' },
          { key: 'created_at', label: t('site.common.created'), width: '20%' },
        ]"
        :empty-title="t('site.redirects.empty')"
        :empty-description="t('site.redirects.emptyDescription')"
        empty-icon="lucide:corner-up-right"
      >
        <template #cell-from="{ row }">
          <code class="rounded bg-muted px-2 py-1 text-sm">{{ row.from }}</code>
        </template>

        <template #cell-to="{ row }">
          <code class="max-w-xs truncate rounded bg-muted px-2 py-1 text-sm">{{
            row.to
          }}</code>
        </template>

        <template #cell-type="{ row }">
          <Badge :variant="redirectTypeVariants[row.type] || 'secondary'">
            {{ redirectTypeLabels[row.type] || row.type }}
          </Badge>
        </template>

        <template #cell-created_at="{ row }">
          <SharedDateTooltip :date="row.created_at" />
        </template>

        <template #actions="{ item }">
          <Button
            variant="ghost"
            size="icon"
            :title="t('site.common.edit')"
            @click="editRedirect(item)"
          >
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="t('site.common.delete')"
            class="hover:bg-destructive/90 hover:text-white"
            @click="deleteRedirect(item)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </template>

        <template #empty>
          <SiteCreateRedirect
            :server-id="serverId"
            :site-id="siteId"
            :site-address="siteAddress"
            @created="fetchRedirects"
          />
        </template>
      </SharedDataTable>
    </template>
  </div>
</template>

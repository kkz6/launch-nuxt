<script setup lang="ts">
import { useAdminLiveUpdates } from "~/composables/useAdminLiveUpdates";
import { ref } from "vue";
import DataTable from "~/components/data-table/DataTable.vue";
import AdminPageHeader from "~/components/admin/PageHeader.vue";
import FailureLogSheet from "~/components/admin/FailureLogSheet.vue";
import { Button } from "~/components/ui/button";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const { locale, t } = useI18n();
const table = ref<{ refresh: () => Promise<void> } | null>(null);

useHead({
  title: () => t("admin.failures.pageTitle"),
});

const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.failures") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);

// The caveat isn't part of the table meta, so keep it as static copy below
// the table.
const caveat = computed(() => t("admin.failures.caveat"));

interface FailureRow {
  id?: string;
  kind?: unknown;
  kind_raw?: string;
  title?: string;
  when?: string;
  error?: string;
  detail?: string;
}

const activeFailure = ref<FailureRow | null>(null);
const logOpen = ref(false);

function openLog(row: FailureRow): void {
  activeFailure.value = row;
  logOpen.value = true;
}
useAdminLiveUpdates(() => table.value?.refresh(), {
  resources: ["task", "deployment", "server", "site", "docker"],
});
</script>

<template>
  <div class="space-y-7">
    <AdminPageHeader
      :title="t('admin.common.failures')"
      :description="t('admin.failures.description')"
    />

    <section aria-labelledby="failure-history-title" class="space-y-4">
      <div class="sr-only">
        <h2 id="failure-history-title" class="text-base font-semibold">
          {{ t("adminResources.failures.history") }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t("adminResources.failures.inspectHint") }}
        </p>
      </div>
      <div class="admin-directory">
        <DataTable
          ref="table"
          endpoint="/admin/failures/table"
          @row-click="openLog"
        >
          <!-- Replace the raw inline log dump with a compact affordance that opens
           the full output in the log viewer sheet. -->
          <template #cell-detail="{ value, row }">
            <Button
              v-if="value"
              variant="outline"
              size="sm"
              class="h-7 gap-1.5 px-2 text-xs"
              @click.stop="openLog(row as FailureRow)"
            >
              <Icon name="lucide:scroll-text" class="h-3.5 w-3.5" />
              {{ t("admin.failures.viewLog") }}
            </Button>
            <span v-else class="text-xs text-muted-foreground">—</span>
          </template>
        </DataTable>
      </div>
      <div
        class="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
      >
        <Icon name="lucide:info" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{{ caveat }}</p>
      </div>
    </section>

    <FailureLogSheet v-model:open="logOpen" :failure="activeFailure" />
  </div>
</template>

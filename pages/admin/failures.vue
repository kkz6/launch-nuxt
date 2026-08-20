<script setup lang="ts">
import { ref } from "vue";
import DataTable from "~/components/data-table/DataTable.vue";
import FailureLogSheet from "~/components/admin/FailureLogSheet.vue";
import { Button } from "~/components/ui/button";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const { locale, t } = useI18n();

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
</script>

<template>
  <div class="space-y-6 pb-10">
    <p class="text-sm text-muted-foreground">
      {{ t("admin.failures.description") }}
    </p>

    <DataTable endpoint="/admin/failures/table" @row-click="openLog">
      <!-- Replace the raw inline log dump with a compact affordance that opens
           the full output in the log viewer sheet. -->
      <template #cell-detail="{ value, row }">
        <Button
          v-if="value"
          variant="ghost"
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

    <p class="text-xs text-muted-foreground">
      {{ caveat }}
    </p>

    <FailureLogSheet v-model:open="logOpen" :failure="activeFailure" />
  </div>
</template>

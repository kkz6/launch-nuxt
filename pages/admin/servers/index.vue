<script setup lang="ts">
import DataTable from "~/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const { locale, t } = useI18n();

useHead({
  title: () => t("admin.serversList.pageTitle"),
});

const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.servers") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);

const openServer = (row: { id: string }): void => {
  navigateTo(`/admin/servers/${row.id}`);
};
</script>

<template>
  <div class="space-y-6 pb-10">
    <p class="text-sm text-muted-foreground">
      {{ t("admin.serversList.description") }}
    </p>

    <DataTable endpoint="/admin/servers/table" @row-click="openServer" />
  </div>
</template>

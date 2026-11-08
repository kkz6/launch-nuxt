<script setup lang="ts">
import DataTable from "~/components/data-table/DataTable.vue";
import AdminPageHeader from "~/components/admin/PageHeader.vue";

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
  <div class="space-y-7">
    <AdminPageHeader
      :title="t('admin.common.servers')"
      :description="t('admin.serversList.description')"
    />

    <section aria-labelledby="server-directory-title" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="sr-only">
          <h2 id="server-directory-title" class="text-base font-semibold">
            {{ t("adminResources.servers.directory") }}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ t("adminResources.servers.searchHint") }}
          </p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Icon name="lucide:layers" class="h-3.5 w-3.5" />
          {{ t("adminResources.servers.allTeams") }}
        </span>
      </div>
      <div class="admin-directory">
        <DataTable
          borderless
          endpoint="/admin/servers/table"
          @row-click="openServer"
        >
          <template #cell-name="{ value, row }">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-sm text-left font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click.stop="openServer(row)"
            >
              {{ value }}
              <Icon
                name="lucide:arrow-up-right"
                class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
            </button>
          </template>
        </DataTable>
      </div>
    </section>
  </div>
</template>

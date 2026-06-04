<script setup lang="ts">
import type { AdminUserRow } from "~/types";
import DataTable from "~/components/data-table/DataTable.vue";
import { TeamsCell } from "~/components/data-table/columns";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Users",
});

setBreadcrumbs([{ label: "Admin", to: "/admin/overview" }, { label: "Users" }]);

// The table is now pure data: actions (suspend/delete/spectate) live on the
// per-user detail page. Clicking a row opens it.
const openUser = (row: AdminUserRow): void => {
  navigateTo(`/admin/users/${row.id}`);
};
</script>

<template>
  <div class="space-y-6 pb-10">
    <p class="text-sm text-muted-foreground">
      Browse customer accounts. Select a user to manage their account.
    </p>

    <DataTable
      endpoint="/admin/users/table"
      :row-actions-filter="() => []"
      @row-click="openUser"
    >
      <!-- Custom cell for the nested teams[] array. -->
      <template #cell-teams="{ value }">
        <TeamsCell :value="value" />
      </template>
    </DataTable>
  </div>
</template>

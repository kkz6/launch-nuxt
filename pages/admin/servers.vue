<script setup lang="ts">
import DataTable from "~/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Servers",
});

setBreadcrumbs([
  { label: "Admin", to: "/admin/overview" },
  { label: "Servers" },
]);
</script>

<template>
  <div class="space-y-6 pb-10">
    <p class="text-sm text-muted-foreground">All servers across teams.</p>

    <DataTable endpoint="/admin/servers/table" />
  </div>
</template>

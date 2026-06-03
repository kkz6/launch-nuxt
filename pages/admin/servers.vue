<script setup lang="ts">
import DataTable from "~/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Servers",
});
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <p class="text-sm text-muted-foreground">All servers across teams.</p>

    <DataTable endpoint="/admin/servers/table" />
  </div>
</template>

<script setup lang="ts">
import DataTable from "~/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Failures",
});

// The caveat isn't part of the table meta, so keep it as static copy below
// the table.
const caveat =
  "Showing the most recent failures across the platform. Older records may have been pruned.";
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <p class="text-sm text-muted-foreground">
      Recent provisioning, task, and deployment failures across the platform.
    </p>

    <DataTable endpoint="/admin/failures/table" />

    <p class="text-xs text-muted-foreground">
      {{ caveat }}
    </p>
  </div>
</template>

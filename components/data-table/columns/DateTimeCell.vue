<script setup lang="ts">
import type { ColumnDef } from "~/types/data-table";
defineProps<{ value: any; column: ColumnDef }>();
</script>
<template>
  <SharedDateTooltip
    v-if="value"
    :date="value"
    :class-name="column.cellClass ?? undefined"
  />
  <span v-else :class="column.cellClass">—</span>
</template>

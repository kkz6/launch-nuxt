<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import type { ColumnDef } from "~/types/data-table";

defineProps<{
  columns: ColumnDef[];
  visibleColumns: string[];
}>();

const emit = defineEmits<{
  toggle: [key: string];
}>();

function isVisible(col: ColumnDef, visibleColumns: string[]): boolean {
  return visibleColumns.includes(col.key);
}
</script>
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="bg-card shadow-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mr-1"
        >
          <path d="M12 3v18" />
          <rect width="6" height="6" x="15" y="3" rx="1" />
          <rect width="6" height="6" x="3" y="15" rx="1" />
          <rect width="6" height="6" x="15" y="15" rx="1" />
          <rect width="6" height="6" x="3" y="3" rx="1" />
        </svg>
        Columns
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuCheckboxItem
        v-for="col in columns.filter((c) => c.toggleable)"
        :key="col.key"
        :model-value="isVisible(col, visibleColumns)"
        @update:model-value="emit('toggle', col.key)"
        @select.prevent
      >
        {{ col.header }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

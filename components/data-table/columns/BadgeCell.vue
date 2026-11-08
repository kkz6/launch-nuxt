<script setup lang="ts">
import { computed } from "vue";
import { Badge, type BadgeVariants } from "~/components/ui/badge";
import type { ColumnDef } from "~/types/data-table";

const props = defineProps<{ value: any; column: ColumnDef }>();

// API table variants use semantic names; the customer app uses these compact
// Badge variants for resource status. Preserve the server-localized label.
const variants: Record<string, BadgeVariants["variant"]> = {
  default: "default",
  success: "green",
  info: "blue",
  warning: "orange",
  destructive: "red",
  secondary: "blank",
  outline: "outline",
  red: "red",
  yellow: "yellow",
  orange: "orange",
  green: "green",
  blue: "blue",
  blank: "blank",
};
const variant = computed(() => variants[props.value?.variant] || "secondary");
</script>
<template>
  <Badge v-if="value && typeof value === 'object'" :variant="variant">
    {{ value.value }}
  </Badge>
  <span v-else>{{ value ?? "" }}</span>
</template>

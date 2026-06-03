<script setup lang="ts">
// Renders per-row actions. Two presentations driven by the backend
// ActionColumn.AsDropdown() flag:
//   - inline icon-buttons (asDropdown=false): compact, label-less,
//     destructive ones tint red on hover
//   - kebab dropdown (asDropdown=true): traditional 3-dot menu
// Either way, hidden actions are filtered first; if NOTHING is visible
// we render nothing at all (no dead kebab, no spacer button).

import { computed } from "vue";
import {
  Check,
  Eye,
  MoreVertical,
  Pencil,
  Power,
  RotateCcw,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ActionDef } from "~/types/data-table";

// Map backend icon hints to Lucide components. Falls back to a label-only
// pill when unknown — better than a blank icon box.
const ICONS: Record<string, any> = {
  eye: Eye,
  pencil: Pencil,
  trash: Trash2,
  "rotate-ccw": RotateCcw,
  "user-x": UserX,
  "user-check": UserCheck,
  ban: Power,
  check: Check,
};

const props = defineProps<{
  actions: ActionDef[];
  row: Record<string, any>;
  asDropdown?: boolean;
}>();

const emit = defineEmits<{
  action: [action: ActionDef, row: Record<string, any>];
}>();

const router = useRouter();
const visibleActions = computed(() => props.actions.filter((a) => !a.hidden));

function handleAction(action: ActionDef, row: Record<string, any>): void {
  if (action.type === "link" && action.url) {
    router.push(action.url);
  } else {
    emit("action", action, row);
  }
}

// Tinted hover state per variant. Inline buttons stay neutral until
// hover so the row reads as data first, controls second.
function variantHoverClass(variant: string): string {
  switch (variant) {
    case "destructive":
      return "hover:bg-destructive/10 hover:text-destructive";
    case "success":
      return "hover:bg-success/10 hover:text-success";
    case "warning":
      return "hover:bg-warning/10 hover:text-warning";
    default:
      return "hover:bg-muted hover:text-foreground";
  }
}

function dropdownVariantClass(variant: string): string {
  const map: Record<string, string> = {
    destructive: "text-destructive",
    success: "text-success",
    warning: "text-warning",
  };
  return map[variant] ?? "";
}
</script>

<template>
  <!-- No visible actions → render absolutely nothing so the column reads
       as a blank cell instead of a dead-end kebab. -->
  <template v-if="visibleActions.length === 0" />

  <TooltipProvider v-else-if="!asDropdown" :delay-duration="200">
    <div class="flex items-center justify-end gap-0.5">
      <Tooltip v-for="action in visibleActions" :key="action.name">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="action.label"
            :disabled="action.disabled"
            :class="[
              'h-8 w-8 text-muted-foreground transition-colors',
              variantHoverClass(action.variant),
            ]"
            @click.stop="handleAction(action, row)"
          >
            <component
              :is="ICONS[action.icon || ''] || Eye"
              v-if="ICONS[action.icon || '']"
              class="h-4 w-4"
            />
            <span v-else class="text-xs font-medium">{{ action.label }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ action.tooltip || action.label }}
        </TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>

  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Row actions"
        @click.stop
      >
        <MoreVertical class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="action in visibleActions"
        :key="action.name"
        :disabled="action.disabled"
        @click="handleAction(action, row)"
      >
        <component
          :is="ICONS[action.icon || '']"
          v-if="ICONS[action.icon || '']"
          class="mr-2 h-4 w-4"
        />
        <span :class="dropdownVariantClass(action.variant)">{{
          action.label
        }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { describeCronExpression } from "~/utils/cron";

interface Props {
  expression?: string | null;
  timeZone?: string;
  className?: string;
}

const props = defineProps<Props>();
const normalizedExpression = computed(() => props.expression?.trim() || "");
const description = computed(() =>
  describeCronExpression(normalizedExpression.value),
);
const accessibleLabel = computed(() => {
  const timeZone = props.timeZone ? ` Times use ${props.timeZone}.` : "";
  return `${normalizedExpression.value}: ${description.value}.${timeZone}`;
});
</script>

<template>
  <TooltipProvider v-if="normalizedExpression" :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <code
          tabindex="0"
          :aria-label="accessibleLabel"
          :class="[
            'cursor-help rounded bg-muted px-1.5 py-0.5 font-mono text-xs',
            className,
          ]"
        >
          {{ normalizedExpression }}
        </code>
      </TooltipTrigger>
      <TooltipContent side="top" class="max-w-xs">
        <p>{{ description }}</p>
        <p v-if="timeZone" class="text-xs text-muted-foreground">
          Times use {{ timeZone }}.
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <span v-else class="text-muted-foreground">—</span>
</template>

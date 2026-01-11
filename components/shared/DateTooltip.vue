<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface Props {
  date: string | Date;
  className?: string;
}

const props = defineProps<Props>();
const slots = useSlots();

const relativeDate = computed(() => {
  const d = new Date(props.date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffDays < 30)
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  if (diffMonths < 12) {
    if (diffMonths === 0) return "about 1 month ago";
    if (diffDays < 45) return "about 1 month ago";
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
});

const fullDate = computed(() => {
  const d = new Date(props.date);
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const hasSlotContent = computed(() => !!slots.default);
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <Tooltip>
      <TooltipTrigger>
        <span
          :class="[
            'flex items-center text-left text-muted-foreground',
            className,
          ]"
        >
          <slot />
          <template v-if="hasSlotContent">&nbsp;</template>
          {{ relativeDate }}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{{ fullDate }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

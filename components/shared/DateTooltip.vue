<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface Props {
  date: string | Date | null | undefined;
  className?: string;
}

const props = defineProps<Props>();
const slots = useSlots();

function tolerantParse(raw: string | Date): Date | null {
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;
  const match = raw.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*([+-]\d{2}:?\d{2}|Z)/,
  );
  if (match) {
    const iso = `${match[1]}T${match[2]}${match[3]}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

const parsed = computed<Date | null>(() => {
  if (!props.date) return null;
  return tolerantParse(props.date);
});

const coarse = useNow();
const fast = useNow(1000);

const now = computed<Date>(() => {
  const d = parsed.value;
  if (!d) return coarse.value;
  const ageMs = Math.abs(coarse.value.getTime() - d.getTime());
  return ageMs < 120_000 ? fast.value : coarse.value;
});

const relativeDate = computed<string>(() => {
  const d = parsed.value;
  if (!d) return "—";
  const diffMs = now.value.getTime() - d.getTime();
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const secs = Math.floor(absMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const fmt = (n: number, unit: string) => {
    const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
    return future ? `in ${label}` : `${label} ago`;
  };

  if (secs < 5) return future ? "in a moment" : "just now";
  if (secs < 60) return fmt(secs, "second");
  if (mins < 60) return fmt(mins, "minute");
  if (hours < 24) return fmt(hours, "hour");
  if (days < 7) return fmt(days, "day");
  if (days < 30) return fmt(weeks, "week");
  if (months < 12) {
    if (days < 45) return future ? "in about 1 month" : "about 1 month ago";
    return fmt(months, "month");
  }
  return fmt(years, "year");
});

const fullDate = computed<string>(() => {
  const d = parsed.value;
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
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

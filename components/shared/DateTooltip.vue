<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

/**
 * SharedDateTooltip renders an ISO timestamp as live "X minutes ago"
 * text with a tooltip showing the absolute time in the browser's
 * timezone. One ticking instance per process (see useNow) keeps the
 * cost flat no matter how many rows are on screen.
 *
 * Backend hands every timestamp as ISO 8601 with offset (e.g.
 * "2026-05-30T11:11:15+02:00"). `new Date(string)` parses both Z and
 * offset forms reliably across browsers, so we hand it the string
 * directly without manual parsing.
 *
 * The tooltip uses `toLocaleString(undefined, …)` — the `undefined`
 * locale + no `timeZone` option asks the browser to render in the
 * user's own timezone, which is what every operator expects for
 * "when did this happen on my watch". Explicitly passing `undefined`
 * (rather than omitting) signals the intent so a later refactor
 * doesn't accidentally hard-code a TZ.
 */
interface Props {
  date: string | Date | null | undefined;
  /** Inline classes for the visible span (relative-time text). */
  className?: string;
}

const props = defineProps<Props>();
const slots = useSlots();

/**
 * Tolerant date parser. We get timestamps in three shapes:
 *
 *   1. ISO 8601 (the normal case): "2026-05-30T11:11:15+02:00"
 *   2. ISO with Z: "2026-05-30T11:11:15.123Z"
 *   3. `docker ps` output: "2026-05-30 11:11:15 +0200 CEST"
 *
 * Native `new Date(s)` parses (1) and (2) reliably, but on (3) V8
 * returns Invalid Date because of the trailing zone name and the
 * space between date and time. We normalise to ISO before parsing:
 * replace the first space with 'T' and strip anything after the
 * numeric offset.
 */
function tolerantParse(raw: string | Date): Date | null {
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  // First try the native parser — handles every well-formed ISO.
  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;
  // Fallback for docker-ps style. "2026-05-30 11:11:15 +0200 CEST"
  //   → "2026-05-30T11:11:15+0200"
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

// Ticking "now" — one shared timer for the whole app, see useNow.
const now = useNow();

const relativeDate = computed<string>(() => {
  const d = parsed.value;
  if (!d) return "—";
  const diffMs = now.value.getTime() - d.getTime();
  // Negative → date is in the future (clock drift, scheduled job).
  // Surface as "in N minutes" so the operator can spot it.
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
    // Smooth over the day=30 boundary so a 28-day gap doesn't say
    // "4 weeks ago" while a 31-day gap says "1 month ago" with the
    // same on-screen badge width.
    if (days < 45) return future ? "in about 1 month" : "about 1 month ago";
    return fmt(months, "month");
  }
  return fmt(years, "year");
});

const fullDate = computed<string>(() => {
  const d = parsed.value;
  if (!d) return "—";
  // `undefined` locale → browser's locale. No `timeZone` option →
  // browser's timezone. Both are explicit-by-omission; see the
  // header comment.
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

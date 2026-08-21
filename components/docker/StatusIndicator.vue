<script setup lang="ts">
interface Props {
  status?: string | null;
  label?: string;
  pulse?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  status: "unknown",
  label: "",
  pulse: true,
});

const normalized = computed(() => (props.status || "unknown").toLowerCase());

const meta = computed(() => {
  switch (normalized.value) {
    case "running":
    case "success":
    case "healthy":
    case "completed":
      return {
        dot: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
      };
    case "building":
    case "deploying":
    case "pending":
    case "starting":
    case "restarting":
    case "deleting":
    case "queued":
    case "in_progress":
      return {
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
      };
    case "failed":
    case "error":
    case "errored":
    case "dead":
    case "unhealthy":
      return { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" };
    case "stopped":
    case "exited":
    case "cancelled":
    case "idle":
      return { dot: "bg-muted-foreground/55", text: "text-muted-foreground" };
    default:
      return { dot: "bg-muted-foreground/40", text: "text-muted-foreground" };
  }
});

const isActive = computed(() =>
  [
    "building",
    "deploying",
    "pending",
    "starting",
    "restarting",
    "deleting",
    "queued",
    "in_progress",
  ].includes(normalized.value),
);

const displayLabel = computed(
  () => props.label || normalized.value.replaceAll("_", " "),
);
</script>

<template>
  <span
    class="inline-flex items-center gap-2 text-xs font-medium capitalize"
    :class="meta.text"
    :aria-label="`Status: ${displayLabel}`"
  >
    <span
      aria-hidden="true"
      class="h-1.5 w-1.5 shrink-0 rounded-full"
      :class="[meta.dot, pulse && isActive && 'animate-pulse']"
    />
    {{ displayLabel }}
  </span>
</template>

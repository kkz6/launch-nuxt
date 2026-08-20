<script setup lang="ts">
import type { MetricsData } from "~/composables/useMetricsStream";

interface Props {
  metrics: MetricsData | null;
  history: MetricsData[];
}

const props = defineProps<Props>();
const { t } = useI18n();

const cpuHistory = computed(() => {
  return props.history.map((m) => m.cpu);
});

const cpuColor = computed(() => {
  const cpu = props.metrics?.cpu || 0;
  if (cpu >= 90) return "rgb(239, 68, 68)";
  if (cpu >= 70) return "rgb(234, 179, 8)";
  return "rgb(34, 197, 94)";
});

const cpuTextColor = computed(() => {
  const cpu = props.metrics?.cpu || 0;
  if (cpu >= 90) return "text-red-500";
  if (cpu >= 70) return "text-yellow-500";
  return "text-green-500";
});
</script>

<template>
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="flex items-center justify-between">
      <div
        class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        <Icon name="lucide:cpu" class="h-3.5 w-3.5" />
        {{ t("server.metrics.cpu") }}
      </div>
      <span :class="['text-lg font-semibold tabular-nums', cpuTextColor]">
        {{ metrics?.cpu?.toFixed(1) || "0.0" }}%
      </span>
    </div>
    <div v-if="cpuHistory.length > 0" class="mt-2">
      <ServerMetricsSparkline
        :data="cpuHistory"
        :color="cpuColor"
        :max="100"
        :height="40"
      />
    </div>
  </div>
</template>

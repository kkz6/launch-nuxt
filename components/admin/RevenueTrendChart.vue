<script setup lang="ts">
import { computed } from "vue";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { Bar } from "vue-chartjs";
import type { RevenueMonth } from "~/types";

ChartJS.register(Title, Tooltip, BarElement, CategoryScale, LinearScale);

const props = defineProps<{
  trend: RevenueMonth[];
  currency: string;
}>();

const colorMode = useColorMode();

// Resolve a shadcn HSL design token (e.g. "240 5.9% 10%") into a usable
// colour string. Reading from CSS keeps the chart in sync with light/dark.
function token(name: string, alpha = 1): string {
  if (typeof window === "undefined") return `hsl(0 0% 50% / ${alpha})`;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw} / ${alpha})` : `hsl(0 0% 50% / ${alpha})`;
}

// colorMode.value is referenced so the colours recompute on theme switch.
const palette = computed(() => {
  void colorMode.value;
  return {
    bar: token("--primary", 0.85),
    barHover: token("--primary", 1),
    grid: token("--border", 0.6),
    text: token("--muted-foreground", 1),
  };
});

function formatMoney(cents: number, compact = false): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: props.currency || "USD",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  });
}

const chartData = computed<ChartData<"bar">>(() => ({
  labels: props.trend.map((m) => m.month),
  datasets: [
    {
      label: "Revenue",
      data: props.trend.map((m) => m.total),
      backgroundColor: palette.value.bar,
      hoverBackgroundColor: palette.value.barHover,
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 56,
    },
  ],
}));

const chartOptions = computed<ChartOptions<"bar">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: TooltipItem<"bar">) => formatMoney(ctx.parsed.y ?? 0),
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: palette.value.text, font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.value.grid, drawTicks: false },
      border: { display: false },
      ticks: {
        color: palette.value.text,
        font: { size: 11 },
        maxTicksLimit: 5,
        callback: (value: number | string) => formatMoney(Number(value), true),
      },
    },
  },
}));
</script>

<template>
  <div class="h-[220px]">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
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

const { locale, t } = useI18n();

const colorMode = useColorMode();
const chartContainer = ref<HTMLElement | null>(null);

// Resolve a shadcn HSL design token (e.g. "240 5.9% 10%") into a usable
// colour string. Reading from CSS keeps the chart in sync with light/dark.
function token(name: string, alpha = 1): string {
  if (typeof window === "undefined") return `hsl(0 0% 50% / ${alpha})`;
  const raw = getComputedStyle(chartContainer.value ?? document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw} / ${alpha})` : `hsl(0 0% 50% / ${alpha})`;
}

// colorMode.value is referenced so the colours recompute on theme switch.
const palette = computed(() => {
  void colorMode.value;
  return {
    bar: token("--primary", 0.28),
    latest: token("--primary", 0.9),
    barHover: token("--primary", 1),
    grid: token("--border", 0.6),
    text: token("--muted-foreground", 1),
  };
});

function formatMoney(cents: number, compact = false): string {
  return (cents / 100).toLocaleString(locale.value, {
    style: "currency",
    currency: props.currency || "USD",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  });
}

function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(locale.value, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const chartData = computed<ChartData<"bar">>(() => ({
  labels: props.trend.map((m) => formatMonth(m.month)),
  datasets: [
    {
      label: t("admin.revenueTrend.revenue"),
      data: props.trend.map((m) => m.total),
      backgroundColor: props.trend.map((_, index) =>
        index === props.trend.length - 1
          ? palette.value.latest
          : palette.value.bar,
      ),
      hoverBackgroundColor: palette.value.barHover,
      borderRadius: 4,
      borderSkipped: false,
      maxBarThickness: 38,
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
      ticks: { color: palette.value.text, font: { size: 10 }, padding: 10 },
    },
    y: {
      beginAtZero: true,
      grid: { color: palette.value.grid, drawTicks: false },
      border: { display: false },
      ticks: {
        color: palette.value.text,
        font: { size: 10 },
        padding: 8,
        maxTicksLimit: 5,
        callback: (value: number | string) => formatMoney(Number(value), true),
      },
    },
  },
}));
</script>

<template>
  <div ref="chartContainer" class="h-[240px]">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

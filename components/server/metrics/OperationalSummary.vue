<script setup lang="ts">
import type { MetricsData, SystemInfo } from "~/composables/useMetricsStream";
import type { DockerHostContainer } from "~/services/dockerService";
import {
  getContainerHealthSummary,
  getOverallSeverity,
  getResourcePressure,
} from "~/utils/operationalInsights";

interface Props {
  metrics: MetricsData | null;
  history: MetricsData[];
  systemInfo: SystemInfo | null;
  serverCpuCores?: number;
  isDocker?: boolean;
  containers?: DockerHostContainer[] | null;
  containersLoading?: boolean;
  containersError?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isDocker: false,
  serverCpuCores: 0,
  containers: null,
  containersLoading: false,
  containersError: false,
});
const { t } = useI18n();

const cpuCores = computed(
  () => props.systemInfo?.cpu_cores || props.serverCpuCores || 0,
);
const pressures = computed(() =>
  getResourcePressure(props.metrics, cpuCores.value),
);
const sortedPressures = computed(() =>
  [...pressures.value].sort((a, b) => b.percent - a.percent),
);
const highestPressure = computed(() => sortedPressures.value[0] ?? null);
const resourceSeverity = computed(() => getOverallSeverity(pressures.value));
const containerHealth = computed(() =>
  getContainerHealthSummary(props.containers ?? []),
);
const severity = computed(() => {
  if (resourceSeverity.value === "critical") return "critical";
  if (
    resourceSeverity.value === "warning" ||
    (props.isDocker &&
      props.containers !== null &&
      containerHealth.value.workloadAttention > 0)
  ) {
    return "warning";
  }
  return "healthy";
});

const severityMeta = computed(() => {
  if (!props.metrics) {
    return {
      label: t("server.metrics.operational.collecting"),
      dot: "bg-amber-500 animate-pulse",
      text: "text-amber-700 dark:text-amber-400",
      message: t("server.metrics.operational.collectingMessage"),
    };
  }
  switch (severity.value) {
    case "critical":
      return {
        label: t("server.metrics.operational.critical"),
        dot: "bg-rose-500",
        text: "text-rose-700 dark:text-rose-400",
        message: t("server.metrics.operational.criticalMessage"),
      };
    case "warning":
      if (
        resourceSeverity.value === "healthy" &&
        containerHealth.value.workloadAttention > 0
      ) {
        return {
          label: t("server.metrics.operational.attention"),
          dot: "bg-amber-500",
          text: "text-amber-700 dark:text-amber-400",
          message: t("server.metrics.operational.containerAttentionMessage", {
            count: containerHealth.value.workloadAttention,
          }),
        };
      }
      return {
        label: t("server.metrics.operational.attention"),
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
        message: t("server.metrics.operational.attentionMessage"),
      };
    default:
      return {
        label: t("server.metrics.operational.normal"),
        dot: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
        message: props.isDocker
          ? t("server.metrics.operational.normalDockerMessage")
          : t("server.metrics.operational.normalHostMessage"),
      };
  }
});

const formatBytes = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "—";
  }
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index >= 3 ? 1 : 0)} ${units[index]}`;
};

const networkRate = computed(
  () =>
    (props.metrics?.network.rx_rate || 0) +
    (props.metrics?.network.tx_rate || 0),
);
const topProcess = computed(
  () => [...(props.metrics?.processes ?? [])].sort((a, b) => b.cpu - a.cpu)[0],
);
const normalizedLoad = computed(() => {
  if (!props.metrics || cpuCores.value <= 0) return null;
  return props.metrics.load[0] / cpuCores.value;
});
const observationWindow = computed(() => {
  if (props.history.length < 2)
    return t("server.metrics.operational.collectingSamples");
  const start = new Date(props.history[0]!.timestamp).getTime();
  const end = new Date(props.history.at(-1)!.timestamp).getTime();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60)
    return t("server.metrics.operational.secondsWindow", { count: seconds });
  return t("server.metrics.operational.minutesWindow", {
    minutes: Math.floor(seconds / 60),
    seconds: seconds % 60,
  });
});
const pressureLabel = (label?: string) =>
  label ? t(`server.metrics.${label.toLowerCase()}`, label) : "—";
const containerStatusLabel = (status: string) =>
  t(`workload.status.${status.toLowerCase()}`, status);
</script>

<template>
  <section class="border-y">
    <div class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <span
          class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          :class="severityMeta.dot"
        />
        <div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h4 class="text-sm font-semibold">
              {{ t("server.metrics.operational.title") }}
            </h4>
            <span class="text-xs font-medium" :class="severityMeta.text">
              {{ severityMeta.label }}
            </span>
          </div>
          <p class="mt-1 text-[13px] text-muted-foreground">
            {{ severityMeta.message }}
          </p>
        </div>
      </div>
      <p class="shrink-0 text-xs text-muted-foreground">
        {{ observationWindow }}
      </p>
    </div>

    <div class="grid border-t sm:grid-cols-2 lg:grid-cols-4">
      <div class="px-4 py-3 sm:border-r">
        <p class="text-xs font-medium text-muted-foreground">
          {{ t("server.metrics.operational.highestPressure") }}
        </p>
        <p class="mt-2 text-sm font-semibold tabular-nums">
          {{ pressureLabel(highestPressure?.label) }}
          <span v-if="highestPressure">
            {{ highestPressure.percent.toFixed(1) }}%
          </span>
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ t("server.metrics.operational.pressureScope") }}
        </p>
      </div>

      <div class="border-t px-4 py-3 sm:border-t-0 lg:border-r">
        <p class="text-xs font-medium text-muted-foreground">
          {{ t("server.metrics.operational.capacityRemaining") }}
        </p>
        <p class="mt-2 text-sm font-semibold tabular-nums">
          {{
            t("server.metrics.operational.memoryFree", {
              value: formatBytes(metrics?.memory.free),
            })
          }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{
            t("server.metrics.operational.diskFree", {
              value: formatBytes(metrics?.disk.free),
            })
          }}
        </p>
      </div>

      <div class="border-t px-4 py-3 sm:border-r lg:border-t-0">
        <p class="text-xs font-medium text-muted-foreground">
          {{ t("server.metrics.operational.systemDemand") }}
        </p>
        <p class="mt-2 text-sm font-semibold tabular-nums">
          {{
            t("server.metrics.operational.loadValue", {
              value: metrics?.load[0].toFixed(2) || "0.00",
            })
          }}
          <span class="font-normal text-muted-foreground">
            {{
              t("server.metrics.operational.coreCount", {
                count: cpuCores || "?",
              })
            }}
          </span>
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{
            normalizedLoad === null
              ? t("server.metrics.operational.waitingForCpu")
              : t("server.metrics.operational.loadPerCore", {
                  value: normalizedLoad.toFixed(2),
                })
          }}
        </p>
      </div>

      <div class="border-t px-4 py-3 lg:border-t-0">
        <p class="text-xs font-medium text-muted-foreground">
          {{ t("server.metrics.operational.currentActivity") }}
        </p>
        <p
          class="mt-2 truncate text-sm font-semibold"
          :title="topProcess?.command"
        >
          {{
            topProcess?.command ||
            t("server.metrics.operational.noProcessSample")
          }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{
            topProcess
              ? t("server.metrics.operational.cpuNetwork", {
                  cpu: topProcess.cpu.toFixed(1),
                  network: formatBytes(networkRate),
                })
              : t("server.metrics.operational.networkOnly", {
                  network: formatBytes(networkRate),
                })
          }}
        </p>
      </div>
    </div>

    <div v-if="isDocker" class="border-t">
      <div class="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <h5 class="text-sm font-semibold">
            {{ t("server.metrics.operational.dockerTitle") }}
          </h5>
          <p class="text-xs text-muted-foreground">
            {{ t("server.metrics.operational.dockerDescription") }}
          </p>
        </div>
        <NuxtLink
          :to="{ query: { tab: 'containers' } }"
          class="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          {{ t("server.metrics.operational.viewContainers") }}
        </NuxtLink>
      </div>

      <div
        v-if="containersLoading && containers === null"
        class="flex items-center gap-2 border-t px-4 py-4 text-xs text-muted-foreground"
      >
        <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
        {{ t("server.metrics.operational.readingContainers") }}
      </div>
      <div
        v-else-if="containersError || containers === null"
        class="border-t px-4 py-4 text-xs text-muted-foreground"
      >
        {{ t("server.metrics.operational.containersUnavailable") }}
      </div>
      <div v-else class="grid border-t lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div
          class="grid grid-cols-3 divide-x border-b lg:border-b-0 lg:border-r"
        >
          <div class="px-3 py-3 text-center">
            <p class="text-lg font-semibold tabular-nums">
              {{ containerHealth.workloadRunning }}
            </p>
            <p class="text-[11px] text-muted-foreground">
              {{ t("server.metrics.operational.running") }}
            </p>
          </div>
          <div class="px-3 py-3 text-center">
            <p
              class="text-lg font-semibold tabular-nums"
              :class="
                containerHealth.workloadAttention > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : ''
              "
            >
              {{ containerHealth.workloadAttention }}
            </p>
            <p class="text-[11px] text-muted-foreground">
              {{ t("server.metrics.operational.attentionCount") }}
            </p>
          </div>
          <div class="px-3 py-3 text-center">
            <p class="text-lg font-semibold tabular-nums">
              {{ containerHealth.systemTotal }}
            </p>
            <p class="text-[11px] text-muted-foreground">
              {{ t("server.metrics.operational.system") }}
            </p>
          </div>
        </div>

        <div class="min-w-0">
          <div
            v-if="containerHealth.attention.length === 0"
            class="flex h-full items-center px-4 py-4 text-xs text-muted-foreground"
          >
            {{
              t("server.metrics.operational.allRunning", {
                count: containerHealth.workloadTotal,
              })
            }}
          </div>
          <div v-else class="divide-y">
            <div
              v-for="container in containerHealth.attention.slice(0, 4)"
              :key="container.ID"
              class="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <div class="min-w-0">
                <p class="truncate font-mono text-xs font-medium">
                  {{ container.Names }}
                </p>
                <p class="truncate text-[11px] text-muted-foreground">
                  {{ container.Image }}
                </p>
              </div>
              <DockerStatusIndicator
                :status="container.State"
                :label="containerStatusLabel(container.State)"
                class="shrink-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

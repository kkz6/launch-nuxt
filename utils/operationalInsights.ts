import type { MetricsData } from "~/composables/useMetricsStream";
import type {
  DockerDeployment,
  DockerHostContainer,
} from "~/services/dockerService";

export type OperationalSeverity = "healthy" | "warning" | "critical";

export interface DeploymentReliability {
  successful: number;
  attempted: number;
  failed: number;
  percent: number | null;
}

export const getDeploymentReliability = (
  deployments: DockerDeployment[],
  limit = 10,
): DeploymentReliability => {
  const completed = deployments
    .filter((deployment) =>
      ["success", "failed", "cancelled"].includes(deployment.status),
    )
    .slice(0, limit);
  const successful = completed.filter(
    (deployment) => deployment.status === "success",
  ).length;
  const failed = completed.filter(
    (deployment) => deployment.status === "failed",
  ).length;

  return {
    successful,
    attempted: completed.length,
    failed,
    percent:
      completed.length > 0
        ? Math.round((successful / completed.length) * 100)
        : null,
  };
};

export interface ResourcePressure {
  label: "CPU" | "Memory" | "Disk" | "Load";
  percent: number;
  severity: OperationalSeverity;
}

const severityForPercent = (
  percent: number,
  warning = 75,
  critical = 90,
): OperationalSeverity => {
  if (percent >= critical) return "critical";
  if (percent >= warning) return "warning";
  return "healthy";
};

export const getResourcePressure = (
  metrics: MetricsData | null,
  cpuCores = 0,
): ResourcePressure[] => {
  if (!metrics) return [];

  const loadPercent =
    cpuCores > 0 ? Math.max(0, (metrics.load[0] / cpuCores) * 100) : 0;

  return [
    {
      label: "CPU",
      percent: metrics.cpu,
      severity: severityForPercent(metrics.cpu),
    },
    {
      label: "Memory",
      percent: metrics.memory.percent,
      severity: severityForPercent(metrics.memory.percent),
    },
    {
      label: "Disk",
      percent: metrics.disk.percent,
      severity: severityForPercent(metrics.disk.percent, 80, 90),
    },
    {
      label: "Load",
      percent: loadPercent,
      severity: severityForPercent(loadPercent, 100, 150),
    },
  ];
};

export const getOverallSeverity = (
  pressures: ResourcePressure[],
): OperationalSeverity => {
  if (pressures.some((pressure) => pressure.severity === "critical")) {
    return "critical";
  }
  if (pressures.some((pressure) => pressure.severity === "warning")) {
    return "warning";
  }
  return "healthy";
};

export interface ContainerHealthSummary {
  workloadTotal: number;
  workloadRunning: number;
  workloadAttention: number;
  systemTotal: number;
  attention: DockerHostContainer[];
}

export const getContainerHealthSummary = (
  containers: DockerHostContainer[],
): ContainerHealthSummary => {
  const workloads = containers.filter((container) => !container.system);
  const attention = workloads.filter(
    (container) => container.State.toLowerCase() !== "running",
  );

  return {
    workloadTotal: workloads.length,
    workloadRunning: workloads.length - attention.length,
    workloadAttention: attention.length,
    systemTotal: containers.length - workloads.length,
    attention,
  };
};

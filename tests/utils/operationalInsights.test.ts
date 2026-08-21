import { describe, expect, it } from "vitest";
import type { MetricsData } from "../../composables/useMetricsStream";
import type {
  DockerDeployment,
  DockerHostContainer,
} from "../../services/dockerService";
import {
  getContainerHealthSummary,
  getDeploymentReliability,
  getOverallSeverity,
  getResourcePressure,
} from "../../utils/operationalInsights";

const deployment = (status: DockerDeployment["status"]): DockerDeployment =>
  ({
    id: crypto.randomUUID(),
    status,
  }) as DockerDeployment;

const metrics = (overrides: Partial<MetricsData> = {}): MetricsData => ({
  timestamp: "2026-08-21T00:00:00Z",
  cpu: 20,
  load: [1, 0.8, 0.5],
  memory: { total: 100, used: 30, free: 70, percent: 30 },
  disk: { total: 100, used: 40, free: 60, percent: 40 },
  processes: [],
  network: { rx_bytes: 0, tx_bytes: 0, rx_rate: 0, tx_rate: 0 },
  ...overrides,
});

const container = (State: string, system = false): DockerHostContainer =>
  ({
    ID: crypto.randomUUID(),
    Names: "workload",
    Image: "example:latest",
    State,
    system,
  }) as DockerHostContainer;

describe("operational insights", () => {
  it("describes deployment reliability from completed attempts only", () => {
    const result = getDeploymentReliability([
      deployment("pending"),
      deployment("success"),
      deployment("failed"),
      deployment("cancelled"),
      deployment("success"),
    ]);

    expect(result).toEqual({
      successful: 2,
      attempted: 4,
      failed: 1,
      percent: 50,
    });
  });

  it("uses resource-specific thresholds and normalizes load by CPU cores", () => {
    const pressures = getResourcePressure(
      metrics({
        cpu: 76,
        load: [6, 4, 2],
        memory: { total: 100, used: 60, free: 40, percent: 60 },
        disk: { total: 100, used: 85, free: 15, percent: 85 },
      }),
      4,
    );

    expect(pressures).toEqual([
      { label: "CPU", percent: 76, severity: "warning" },
      { label: "Memory", percent: 60, severity: "healthy" },
      { label: "Disk", percent: 85, severity: "warning" },
      { label: "Load", percent: 150, severity: "critical" },
    ]);
    expect(getOverallSeverity(pressures)).toBe("critical");
  });

  it("separates customer workloads from system containers", () => {
    const stopped = container("exited");
    const result = getContainerHealthSummary([
      container("running"),
      stopped,
      container("running", true),
    ]);

    expect(result).toMatchObject({
      workloadTotal: 2,
      workloadRunning: 1,
      workloadAttention: 1,
      systemTotal: 1,
    });
    expect(result.attention).toEqual([stopped]);
  });
});

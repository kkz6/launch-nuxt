import { reactive, toRefs } from "vue";

export interface MetricsMemory {
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface MetricsDisk {
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface MetricsProcess {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
}

export interface MetricsNetwork {
  rx_bytes: number;
  tx_bytes: number;
  rx_rate: number;
  tx_rate: number;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  cpu_model: string;
  cpu_cores: number;
  total_memory: number;
  uptime: number;
}

export interface MetricsData {
  timestamp: string;
  cpu: number;
  load: [number, number, number];
  memory: MetricsMemory;
  disk: MetricsDisk;
  processes: MetricsProcess[];
  network: MetricsNetwork;
}

interface MetricsEvent {
  event: "connected" | "error" | "metrics" | "system_info";
  message?: string;
  data?: { message?: string };
  timestamp?: string;
  cpu?: number;
  load?: [number, number, number];
  memory?: MetricsMemory;
  disk?: MetricsDisk;
  processes?: MetricsProcess[];
  network?: MetricsNetwork;
  hostname?: string;
  os?: string;
  kernel?: string;
  cpu_model?: string;
  cpu_cores?: number;
  total_memory?: number;
  uptime?: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const STREAM_INTERVAL_MS = 500;
const METRICS_ANIMATION_MS = 480;
const HISTORY_DURATION_SECONDS = 60;
const MAX_HISTORY_LENGTH =
  (HISTORY_DURATION_SECONDS * 1000) / STREAM_INTERVAL_MS;

interface MetricsStreamState {
  metrics: MetricsData | null;
  history: MetricsData[];
  systemInfo: SystemInfo | null;
  isConnected: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  ws: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  shouldReconnect: boolean;
}

export const useMetricsStream = (serverId: MaybeRef<string>) => {
  const config = useRuntimeConfig();
  const { t } = useI18n();
  const { token } = useAuth();
  const { getCurrentTeamId } = useApi();
  const { effectiveLocale, getEffectiveLocale } = useLocalePreference();

  const state = reactive({
    metrics: null,
    history: [],
    systemInfo: null,
    isConnected: false,
    error: null,
    connectionStatus: "disconnected",
    ws: null,
    reconnectTimeout: null,
    reconnectAttempts: 0,
    shouldReconnect: true,
  }) as MetricsStreamState;

  const {
    metrics,
    history,
    systemInfo,
    isConnected,
    error,
    connectionStatus,
    ws,
    reconnectTimeout,
    reconnectAttempts,
    shouldReconnect,
  } = toRefs(state);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000;
  let metricsAnimationFrame: number | null = null;

  const interpolate = (from: number, to: number, progress: number) => {
    return from + (to - from) * progress;
  };

  const interpolateMetrics = (
    from: MetricsData,
    to: MetricsData,
    progress: number,
  ): MetricsData => ({
    timestamp: to.timestamp,
    cpu: interpolate(from.cpu, to.cpu, progress),
    load: [
      interpolate(from.load[0], to.load[0], progress),
      interpolate(from.load[1], to.load[1], progress),
      interpolate(from.load[2], to.load[2], progress),
    ],
    memory: {
      total: interpolate(from.memory.total, to.memory.total, progress),
      used: interpolate(from.memory.used, to.memory.used, progress),
      free: interpolate(from.memory.free, to.memory.free, progress),
      percent: interpolate(from.memory.percent, to.memory.percent, progress),
    },
    disk: {
      total: interpolate(from.disk.total, to.disk.total, progress),
      used: interpolate(from.disk.used, to.disk.used, progress),
      free: interpolate(from.disk.free, to.disk.free, progress),
      percent: interpolate(from.disk.percent, to.disk.percent, progress),
    },
    processes: to.processes,
    network: {
      rx_bytes: interpolate(
        from.network.rx_bytes,
        to.network.rx_bytes,
        progress,
      ),
      tx_bytes: interpolate(
        from.network.tx_bytes,
        to.network.tx_bytes,
        progress,
      ),
      rx_rate: interpolate(from.network.rx_rate, to.network.rx_rate, progress),
      tx_rate: interpolate(from.network.tx_rate, to.network.tx_rate, progress),
    },
  });

  const animateMetrics = (nextMetrics: MetricsData) => {
    if (metricsAnimationFrame !== null) {
      cancelAnimationFrame(metricsAnimationFrame);
      metricsAnimationFrame = null;
    }

    const currentMetrics = metrics.value;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!currentMetrics || prefersReducedMotion) {
      metrics.value = nextMetrics;
      return;
    }

    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / METRICS_ANIMATION_MS, 1);
      metrics.value = interpolateMetrics(currentMetrics, nextMetrics, progress);

      if (progress < 1) {
        metricsAnimationFrame = requestAnimationFrame(animate);
        return;
      }

      metricsAnimationFrame = null;
    };

    metricsAnimationFrame = requestAnimationFrame(animate);
  };

  const clearReconnectTimeout = () => {
    if (reconnectTimeout.value) {
      clearTimeout(reconnectTimeout.value);
      reconnectTimeout.value = null;
    }
  };

  const scheduleReconnect = () => {
    if (
      !shouldReconnect.value ||
      reconnectAttempts.value >= maxReconnectAttempts
    ) {
      if (reconnectAttempts.value >= maxReconnectAttempts) {
        error.value = t("shared.webSocket.maxReconnect");
        connectionStatus.value = "error";
      }
      return;
    }

    clearReconnectTimeout();

    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttempts.value) +
        Math.random() * 1000,
      30000,
    );

    console.log(
      `[MetricsStream] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts.value + 1})`,
    );

    reconnectTimeout.value = setTimeout(() => {
      reconnectAttempts.value++;
      connect();
    }, delay);
  };

  const connect = () => {
    if (import.meta.server) return;

    const serverIdValue = toValue(serverId);
    if (!serverIdValue || !token.value) {
      error.value = t("shared.webSocket.missingServerOrAuth");
      connectionStatus.value = "error";
      return;
    }

    if (ws.value?.readyState === WebSocket.OPEN) {
      return;
    }

    if (ws.value) {
      ws.value.close();
    }

    shouldReconnect.value = true;
    connectionStatus.value = "connecting";
    error.value = null;

    const wsBase = config.public.wsBase as string;
    const teamId = getCurrentTeamId();
    const params = new URLSearchParams({
      serverId: serverIdValue,
      token: token.value,
      interval_ms: String(STREAM_INTERVAL_MS),
      locale: getEffectiveLocale(),
    });
    if (teamId) params.set("team_id", teamId);
    const wsUrl = `${wsBase}/metrics/stream?${params.toString()}`;

    console.log("[MetricsStream] Connecting...");

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
      console.log("[MetricsStream] WebSocket opened");
    };

    ws.value.onmessage = (event) => {
      try {
        const data: MetricsEvent = JSON.parse(event.data);

        if (data.event === "connected") {
          console.log("[MetricsStream] Connected");
          isConnected.value = true;
          connectionStatus.value = "connected";
          reconnectAttempts.value = 0;
          error.value = null;
        } else if (data.event === "system_info") {
          console.log("[MetricsStream] Received system info");
          systemInfo.value = {
            hostname: data.hostname || "",
            os: data.os || "",
            kernel: data.kernel || "",
            cpu_model: data.cpu_model || "",
            cpu_cores: data.cpu_cores || 0,
            total_memory: data.total_memory || 0,
            uptime: data.uptime || 0,
          };
        } else if (data.event === "error") {
          console.error("[MetricsStream] Error:", data.message);
          error.value =
            data.data?.message ||
            data.message ||
            t("shared.webSocket.unknownError");
          connectionStatus.value = "error";
        } else if (data.event === "metrics") {
          const metricsData: MetricsData = {
            timestamp: data.timestamp || new Date().toISOString(),
            cpu: data.cpu || 0,
            load: data.load || [0, 0, 0],
            memory: data.memory || { total: 0, used: 0, free: 0, percent: 0 },
            disk: data.disk || { total: 0, used: 0, free: 0, percent: 0 },
            processes: data.processes || [],
            network: data.network || {
              rx_bytes: 0,
              tx_bytes: 0,
              rx_rate: 0,
              tx_rate: 0,
            },
          };

          animateMetrics(metricsData);

          history.value = [...history.value, metricsData].slice(
            -MAX_HISTORY_LENGTH,
          );
        }
      } catch (err) {
        console.error("[MetricsStream] Failed to parse message:", err);
      }
    };

    ws.value.onclose = () => {
      console.log("[MetricsStream] Disconnected");
      isConnected.value = false;

      if (connectionStatus.value !== "error") {
        connectionStatus.value = "disconnected";
      }

      if (shouldReconnect.value) {
        scheduleReconnect();
      }
    };

    ws.value.onerror = (err) => {
      console.error("[MetricsStream] WebSocket error:", err);
      error.value = t("shared.webSocket.connectionError");
    };
  };

  const disconnect = () => {
    console.log("[MetricsStream] Disconnecting...");
    shouldReconnect.value = false;
    clearReconnectTimeout();
    reconnectAttempts.value = 0;

    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }

    isConnected.value = false;
    connectionStatus.value = "disconnected";
  };

  const clearHistory = () => {
    if (metricsAnimationFrame !== null) {
      cancelAnimationFrame(metricsAnimationFrame);
      metricsAnimationFrame = null;
    }

    history.value = [];
    metrics.value = null;
  };

  watch(effectiveLocale, (nextLocale, previousLocale) => {
    if (nextLocale !== previousLocale && ws.value) {
      disconnect();
      connect();
    }
  });

  tryOnUnmounted(() => {
    if (metricsAnimationFrame !== null) {
      cancelAnimationFrame(metricsAnimationFrame);
    }

    disconnect();
  });

  return {
    metrics,
    history,
    systemInfo,
    isConnected,
    error,
    connectionStatus,
    connect,
    disconnect,
    clearHistory,
  };
};

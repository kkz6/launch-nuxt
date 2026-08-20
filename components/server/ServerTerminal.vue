<script setup lang="ts">
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  serverId: string;
  username?: string;
  isMaximized?: boolean;
  /**
   * When set, the backend wraps the session in
   * `docker exec -it <container> sh` instead of starting the user's
   * host login shell. Used by the workload detail pages so the
   * Terminal button opens a shell inside the container.
   */
  container?: string;
  /**
   * Picks the shell exec'd inside the container. "bash" / "sh" call
   * /bin/bash and /bin/sh directly; empty falls back to the auto-detect
   * wrapper. Only meaningful when `container` is set.
   */
  shell?: "" | "bash" | "sh";
}

const props = withDefaults(defineProps<Props>(), {
  username: "launcher",
  isMaximized: false,
  container: "",
  shell: "",
});

const emit = defineEmits<{
  connectionStatusChange: ["connecting" | "connected" | "disconnected"];
}>();

const termRef = ref<HTMLDivElement | null>(null);
const terminalInstance = ref<Terminal | null>(null);
const fitAddonInstance = ref<FitAddon | null>(null);
const wsRef = ref<WebSocket | null>(null);
const connectionStatus = ref<"connecting" | "connected" | "disconnected">(
  "connecting",
);

const { token } = useAuth();
const { getCurrentTeamId } = useApi();
const { effectiveLocale } = useLocalePreference();
const { t } = useI18n();

// Cleanup function for the current terminal instance
let cleanupFn: (() => void) | null = null;

const sendResize = (cols: number, rows: number, ws: WebSocket) => {
  if (ws.readyState === WebSocket.OPEN) {
    const resizeMessage = JSON.stringify({
      type: "resize",
      cols,
      rows,
    });
    ws.send(resizeMessage);
  }
};

const cleanupTerminal = () => {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  // Detach old WebSocket before closing so its onclose doesn't update status
  const oldWs = wsRef.value;
  wsRef.value = null;
  if (oldWs && oldWs.readyState === WebSocket.OPEN) {
    oldWs.close();
  }

  if (terminalInstance.value) {
    terminalInstance.value.dispose();
    terminalInstance.value = null;
  }
  fitAddonInstance.value = null;
};

const initializeTerminal = () => {
  cleanupTerminal();

  if (!termRef.value) return;

  const container = termRef.value;
  container.innerHTML = "";

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    lineHeight: 1.2,
    scrollback: 5000,
    convertEol: true,
    theme: {
      background: "#0a0a0a",
      foreground: "#e4e4e7",
      cursor: "#e4e4e7",
      cursorAccent: "#0a0a0a",
      selectionBackground: "rgba(255, 255, 255, 0.3)",
      black: "#18181b",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#eab308",
      blue: "#3b82f6",
      magenta: "#a855f7",
      cyan: "#06b6d4",
      white: "#e4e4e7",
      brightBlack: "#52525b",
      brightRed: "#f87171",
      brightGreen: "#4ade80",
      brightYellow: "#facc15",
      brightBlue: "#60a5fa",
      brightMagenta: "#c084fc",
      brightCyan: "#22d3ee",
      brightWhite: "#f4f4f5",
    },
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);
  terminalInstance.value = term;
  fitAddonInstance.value = fitAddon;

  const config = useRuntimeConfig();
  const urlParams = new URLSearchParams();
  urlParams.set("serverId", props.serverId);
  urlParams.set("username", props.username);
  urlParams.set("token", token.value || "");
  urlParams.set("locale", effectiveLocale.value);
  // When container is set, the WS handler runs `docker exec -it
  // <container> sh` instead of opening the host shell. Sending it
  // verbatim — the backend validates against a strict charset
  // before splicing into the docker command, so injection is blocked
  // there.
  if (props.container) {
    urlParams.set("container", props.container);
    // Empty shell → backend auto-detects (`bash || sh` wrapper). Bare
    // values map to /bin/bash and /bin/sh respectively. The backend
    // already whitelists this — anything else is ignored there.
    if (props.shell) {
      urlParams.set("shell", props.shell);
    }
  }
  const teamId = getCurrentTeamId();
  if (teamId) {
    urlParams.set("team_id", teamId);
  }

  const wsBase = config.public.wsBase as string;
  const wsUrl = `${wsBase}/terminal/ws?${urlParams}`;

  const waitForContainer = () => {
    const rect = container.getBoundingClientRect();
    if (rect.height > 0 && rect.width > 0) {
      container.style.height = "100%";
      container.style.width = "100%";

      setTimeout(() => {
        try {
          fitAddon.fit();
        } catch (error) {
          console.error("Initial fit error:", error);
        }
      }, 10);

      const ws = new WebSocket(wsUrl);
      wsRef.value = ws;
      initializeWebSocket(ws, term, fitAddon);
    } else {
      setTimeout(waitForContainer, 50);
    }
  };

  const initializeWebSocket = (
    ws: WebSocket,
    term: Terminal,
    fitAddon: FitAddon,
  ) => {
    connectionStatus.value = "connecting";

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ws.onopen = () => {
      if (wsRef.value !== ws) return;
      connectionStatus.value = "connected";
      setTimeout(() => {
        fitAddon.fit();
        sendResize(term.cols, term.rows, ws);
      }, 100);
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data === "string") {
          term.write(event.data);
        }
      } catch (error) {
        console.error("Terminal write error:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (wsRef.value !== ws) return;
      connectionStatus.value = "disconnected";
      term.write(
        `\r\n\x1b[31m❌ ${t("server.terminal.connectionFailed")}\x1b[0m\r\n`,
      );
    };

    ws.onclose = (event) => {
      if (wsRef.value !== ws) return;
      connectionStatus.value = "disconnected";
      if (event.code !== 1000 && event.code !== 1001) {
        term.write(
          `\r\n\x1b[31m⚠️ ${t("server.terminal.connectionLost", { code: event.code })}\x1b[0m\r\n`,
        );
      } else {
        term.write(
          `\r\n\x1b[31m🔌 ${t("server.terminal.connectionClosed")}\x1b[0m\r\n`,
        );
      }
    };
  };

  setTimeout(waitForContainer, 100);

  let resizeTimer: ReturnType<typeof setTimeout>;
  const handleResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (
        wsRef.value &&
        wsRef.value.readyState === WebSocket.OPEN &&
        term &&
        fitAddon
      ) {
        try {
          fitAddon.fit();
          sendResize(term.cols, term.rows, wsRef.value);
        } catch (error) {
          console.error("Resize error:", error);
        }
      }
    }, 100);
  };

  window.addEventListener("resize", handleResize);

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });

  resizeObserver.observe(container);

  // Store cleanup for this instance's listeners
  cleanupFn = () => {
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", handleResize);
    resizeObserver.disconnect();
  };
};

// Reconnect when username changes
watch(
  () => props.username,
  () => {
    nextTick(initializeTerminal);
  },
);

watch(
  () => props.isMaximized,
  (isMaximized) => {
    if (isMaximized && fitAddonInstance.value) {
      setTimeout(() => {
        fitAddonInstance.value?.fit();
        if (
          wsRef.value &&
          wsRef.value.readyState === WebSocket.OPEN &&
          terminalInstance.value
        ) {
          sendResize(
            terminalInstance.value.cols,
            terminalInstance.value.rows,
            wsRef.value,
          );
        }
      }, 200);
    }
  },
);

watch(
  connectionStatus,
  (status) => {
    emit("connectionStatusChange", status);
  },
  { immediate: true },
);

onMounted(initializeTerminal);

onUnmounted(() => {
  cleanupTerminal();
});

const reconnect = () => {
  nextTick(initializeTerminal);
};

defineExpose({ reconnect });
</script>

<template>
  <div
    class="h-full w-full overflow-hidden bg-[#0a0a0a]"
    style="position: relative"
  >
    <div
      ref="termRef"
      class="h-full w-full"
      style="height: 100%; width: 100%"
    />
  </div>
</template>

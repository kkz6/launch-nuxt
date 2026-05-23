<script setup lang="ts">
import { toast } from "vue-sonner";
import type { DockerApplication } from "~/services/dockerService";

/**
 * Container-style log stream. Default is application mode; we expose
 * the target via props so the same component drives the database
 * subtab and (with composeId set) the compose subtab.
 */
interface Props {
  application?: DockerApplication;
  /** Override target. When absent we use props.application.id. */
  applicationId?: string;
  databaseId?: string;
  composeId?: string;
  /**
   * Compose-mode only. When set, the WS query string includes
   * `service=<name>` so the backend runs `docker compose logs <svc>`
   * and the stream is scoped to that single container. Empty string
   * = aggregate (every service). Changing this re-establishes the
   * WS connection automatically via the watcher below.
   */
  service?: string;
  /** Friendly empty-state copy when the container hasn't started. */
  emptyStateMessage?: string;
}
const props = defineProps<Props>();

const lines = ref<string[]>([]);
const wsOpen = ref(false);
const isConnecting = ref(false);
const isPaused = ref(false);
const isAtBottom = ref(true);

const containerRef = ref<HTMLElement | null>(null);

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

const config = useRuntimeConfig();
// Match the LogViewer pattern: token comes from useAuth, the current
// team id from useApi. Splitting them is a pre-existing convention in
// this codebase — see components/server/LogViewer.vue for the same pair.
const { token, waitForAuth } = useAuth();
const { getCurrentTeamId } = useApi();

const connect = async () => {
  disconnect();

  // Decide which target to stream from. Caller passes one of:
  //   - props.application (the original application-mode shape)
  //   - props.databaseId / props.composeId for the new modes.
  // We send the same /docker/applications/logs endpoint with the right
  // query param — the backend dispatches on which ID is present.
  let targetParam: { name: string; value: string } | null = null;
  if (props.databaseId) {
    targetParam = { name: "databaseId", value: props.databaseId };
  } else if (props.composeId) {
    targetParam = { name: "composeId", value: props.composeId };
  } else if (props.applicationId) {
    targetParam = { name: "applicationId", value: props.applicationId };
  } else if (props.application) {
    // Backwards-compatible default: connect to the application unless
    // it hasn't deployed yet, in which case fall back to the empty
    // state (the WS would send `no_container` anyway).
    if (!props.application.container_id) {
      return;
    }
    targetParam = { name: "applicationId", value: props.application.id };
  }
  if (!targetParam) return;

  isConnecting.value = true;
  await waitForAuth();

  const teamId = getCurrentTeamId();
  const params = new URLSearchParams({
    [targetParam.name]: targetParam.value,
    tail: "200",
    token: token.value || "",
  });
  if (teamId) params.set("team_id", teamId);
  // Compose-only: scope the stream to a single service when set.
  // Empty string = aggregate (omit the param).
  if (props.composeId && props.service) {
    params.set("service", props.service);
  }

  const wsBase = config.public.wsBase as string;
  ws = new WebSocket(`${wsBase}/docker/applications/logs?${params.toString()}`);

  ws.onopen = () => {
    wsOpen.value = true;
    isConnecting.value = false;
  };
  ws.onmessage = (e) => {
    if (isPaused.value) return;
    // Backend sends one line per frame as plain text. Control events
    // (connected / no_container / error) come as JSON — peek the prefix
    // before treating it as a log line so JSON doesn't pollute the buffer.
    const data = e.data as string;
    if (data.startsWith("{") && data.endsWith("}")) {
      try {
        const evt = JSON.parse(data);
        if (evt.event === "no_container") {
          toast.info(evt.message || "Application has not been deployed yet");
          return;
        }
        if (evt.event === "error") {
          toast.error(evt.message || "Log stream error");
          return;
        }
        // 'connected' and other control events: noop here.
        return;
      } catch {
        // Not control JSON — fall through and append.
      }
    }
    lines.value.push(data);
    // Trim the buffer if it grows huge. 10k lines @ avg 100 chars is
    // ~1 MB — beyond that the browser starts to chug.
    if (lines.value.length > 10000) {
      lines.value.splice(0, lines.value.length - 10000);
    }
    nextTick(scrollIfStuckToBottom);
  };
  ws.onerror = () => {
    wsOpen.value = false;
    isConnecting.value = false;
  };
  ws.onclose = () => {
    wsOpen.value = false;
    isConnecting.value = false;
  };

  // Keep the connection alive across idle stretches — some browsers /
  // proxies will reap a quiet WS after a minute. A trivial ping
  // (empty TextMessage) is enough; the server ignores it.
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send("");
  }, 25000);
};

const disconnect = () => {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  wsOpen.value = false;
};

const clearBuffer = () => {
  lines.value = [];
};

const scrollIfStuckToBottom = () => {
  if (!containerRef.value || !isAtBottom.value) return;
  containerRef.value.scrollTop = containerRef.value.scrollHeight;
};

const onScroll = () => {
  const el = containerRef.value;
  if (!el) return;
  // 40px tolerance — keeps "auto-follow" sticky when the user is just
  // brushing the scrollbar near the bottom.
  isAtBottom.value =
    el.scrollHeight - el.scrollTop - el.clientHeight < 40;
};

// Reconnect when the application's container_id changes (a fresh
// deploy flipped the running container). Only meaningful for
// application mode — database/compose targets identify by stable IDs.
watch(
  () => props.application?.container_id,
  () => {
    void connect();
  },
);

// Compose-only: reconnect when the user picks a different service
// from the Logs subtab's service picker. The empty-string ↔ named
// transition also re-fires here.
watch(
  () => props.service,
  () => {
    if (props.composeId) {
      lines.value = [];
      void connect();
    }
  },
);

onMounted(() => {
  void connect();
});

onBeforeUnmount(disconnect);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Logs</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Live container output. Most recent 200 lines on connect, then
          tails as new lines arrive.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
          :class="
            wsOpen
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              : isConnecting
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300'
          "
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="
              wsOpen
                ? 'bg-emerald-500'
                : isConnecting
                  ? 'bg-amber-500'
                  : 'bg-zinc-500'
            "
          />
          {{ wsOpen ? "Live" : isConnecting ? "Connecting" : "Disconnected" }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="lines.length === 0"
          @click="clearBuffer"
        >
          <Icon name="lucide:eraser" class="mr-2 h-4 w-4" />
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          @click="isPaused = !isPaused"
        >
          <Icon
            :name="isPaused ? 'lucide:play' : 'lucide:pause'"
            class="mr-2 h-4 w-4"
          />
          {{ isPaused ? "Resume" : "Pause" }}
        </Button>
      </div>
    </div>

    <div
      v-if="application && !application.container_id"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:scroll" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No logs yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {{
          emptyStateMessage ||
          "Deploy the application first; logs start streaming once a container is running."
        }}
      </p>
    </div>

    <div
      v-else
      ref="containerRef"
      class="h-[60vh] overflow-auto rounded-lg border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100"
      @scroll="onScroll"
    >
      <div v-if="lines.length === 0" class="py-8 text-center text-zinc-500">
        <Icon
          v-if="isConnecting || wsOpen"
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin"
        />
        <span v-else>No log lines yet.</span>
      </div>
      <div
        v-for="(line, idx) in lines"
        :key="idx"
        class="whitespace-pre-wrap break-all"
      >
        {{ line }}
      </div>
    </div>
  </div>
</template>

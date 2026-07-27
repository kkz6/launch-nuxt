<script setup lang="ts">
import { reactive, toRefs } from "vue";
import { toast } from "vue-sonner";
import type { DockerApplication } from "~/services/dockerService";

interface Props {
  application?: DockerApplication;
  applicationId?: string;
  databaseId?: string;
  composeId?: string;
  service?: string;
  emptyStateMessage?: string;
}
const props = defineProps<Props>();

interface LogsState {
  lines: { raw: string; html: string }[];
  wsOpen: boolean;
  isConnecting: boolean;
  isPaused: boolean;
  isAtBottom: boolean;
  containerRef: HTMLElement | null;
}

const state = reactive({
  lines: [],
  wsOpen: false,
  isConnecting: false,
  isPaused: false,
  isAtBottom: true,
  containerRef: null,
}) as LogsState;

const { lines, wsOpen, isConnecting, isPaused, isAtBottom, containerRef } =
  toRefs(state);

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

const config = useRuntimeConfig();
const { token, waitForAuth } = useAuth();
const { getCurrentTeamId } = useApi();

const connect = async () => {
  disconnect();

  let targetParam: { name: string; value: string } | null = null;
  if (props.databaseId) {
    targetParam = { name: "databaseId", value: props.databaseId };
  } else if (props.composeId) {
    targetParam = { name: "composeId", value: props.composeId };
  } else if (props.applicationId) {
    targetParam = { name: "applicationId", value: props.applicationId };
  } else if (props.application) {
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
        return;
      } catch {}
    }
    lines.value.push({ raw: data, html: parseAnsiToHtml(data) });
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

const jumpToBottom = () => {
  if (!containerRef.value) return;
  containerRef.value.scrollTop = containerRef.value.scrollHeight;
  isAtBottom.value = true;
};

const onScroll = () => {
  const el = containerRef.value;
  if (!el) return;
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
};

watch(
  () => props.application?.container_id,
  () => {
    void connect();
  },
);

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
    <div>
      <h2 class="text-xl font-semibold">Logs</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Live container output. Most recent 200 lines on connect, then tails as
        new lines arrive.
      </p>
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
      class="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-sm"
    >
      <div
        class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide"
            :class="
              wsOpen
                ? 'text-emerald-400'
                : isConnecting
                  ? 'text-amber-400'
                  : 'text-zinc-500'
            "
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="[
                wsOpen
                  ? 'bg-emerald-400'
                  : isConnecting
                    ? 'bg-amber-400'
                    : 'bg-zinc-500',
                wsOpen && 'animate-pulse',
              ]"
            />
            {{ wsOpen ? "Live" : isConnecting ? "Connecting" : "Disconnected" }}
          </div>
          <slot name="header-actions" />
        </div>

        <div class="flex items-center gap-0.5">
          <button
            type="button"
            class="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            :title="isPaused ? 'Resume stream' : 'Pause stream'"
            @click="isPaused = !isPaused"
          >
            <Icon
              :name="isPaused ? 'lucide:play' : 'lucide:pause'"
              class="h-3.5 w-3.5"
            />
          </button>
          <button
            type="button"
            class="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Clear buffer"
            :disabled="lines.length === 0"
            @click="clearBuffer"
          >
            <Icon name="lucide:eraser" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref="containerRef"
        class="h-[60vh] overflow-auto p-3 font-mono text-xs leading-relaxed text-zinc-100"
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
          v-html="line.html"
        />
      </div>

      <button
        v-if="!isAtBottom && lines.length > 0"
        type="button"
        class="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-[11px] font-medium text-zinc-100 shadow-md transition-colors hover:bg-zinc-700"
        @click="jumpToBottom"
      >
        <Icon name="lucide:arrow-down" class="h-3 w-3" />
        Jump to latest
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, toRefs } from "vue";
import {
  AlertTriangle,
  Circle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Shield,
  Terminal,
  User,
  X,
} from "lucide-vue-next";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Server } from "~/types";
import ServerTerminal from "~/components/server/ServerTerminal.vue";

interface Props {
  server: Server;
  isOpen: boolean;
  container?: string;
}

const props = withDefaults(defineProps<Props>(), {
  container: "",
});
const { t } = useI18n();
const emit = defineEmits<{
  close: [];
}>();

type ConnectionStatus = "connecting" | "connected" | "disconnected";

const serverUsers = computed(() => {
  const users = props.server.users;
  if (!users) {
    return [];
  }

  const result: { value: string; label: string; isRoot: boolean }[] = [];

  if (users.local) {
    result.push({ value: users.local, label: users.local, isRoot: false });
  }

  if (users.root) {
    result.push({ value: users.root, label: users.root, isRoot: true });
  }

  return result;
});

const defaultUser = computed(() => serverUsers.value[0]?.value || "");

const isContainerMode = computed(() => props.container.length > 0);
const initialUser = computed(() => {
  if (isContainerMode.value) {
    return props.server.users?.root || "root";
  }
  return defaultUser.value;
});

const TERMINAL_HEIGHT_KEY = "launch:terminal-height";
const MIN_TERMINAL_HEIGHT = 160;
const TERMINAL_TOP_PADDING = 60;

const loadPersistedHeight = (): number => {
  if (typeof window === "undefined") return 400;
  const raw = window.localStorage.getItem(TERMINAL_HEIGHT_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_TERMINAL_HEIGHT) return 400;
  return n;
};

interface TerminalState {
  height: number;
  isMaximized: boolean;
  isResizing: boolean;
  connectionStatus: ConnectionStatus;
  selectedUser: string;
  selectedShell: "" | "bash" | "sh";
  terminalKey: number;
  showWarning: boolean;
  terminalRef: InstanceType<typeof ServerTerminal> | null;
}

const state = reactive({
  height: loadPersistedHeight(),
  isMaximized: false,
  isResizing: false,
  connectionStatus: "connecting",
  selectedUser: initialUser.value,
  selectedShell: "bash",
  terminalKey: 0,
  showWarning: true,
  terminalRef: null,
}) as TerminalState;

const {
  height,
  isMaximized,
  isResizing,
  connectionStatus,
  selectedUser,
  selectedShell,
  terminalKey,
  showWarning,
  terminalRef,
} = toRefs(state);

watch(initialUser, (u) => {
  selectedUser.value = u;
});
const toggleMaximize = () => {
  if (isMaximized.value) {
    height.value = loadPersistedHeight();
  } else {
    height.value = window.innerHeight - 100;
  }
  isMaximized.value = !isMaximized.value;
};

const startResize = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  isResizing.value = true;
  if (isMaximized.value) isMaximized.value = false;

  const maxHeight = () => window.innerHeight - TERMINAL_TOP_PADDING;

  const onMove = (ev: MouseEvent | TouchEvent) => {
    const clientY =
      "touches" in ev ? (ev.touches[0]?.clientY ?? 0) : ev.clientY;
    const next = window.innerHeight - clientY;
    height.value = Math.min(maxHeight(), Math.max(MIN_TERMINAL_HEIGHT, next));
  };

  const onEnd = () => {
    isResizing.value = false;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        TERMINAL_HEIGHT_KEY,
        String(Math.round(height.value)),
      );
    }
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onEnd);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onEnd);
    window.removeEventListener("touchcancel", onEnd);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  };

  document.body.style.cursor = "ns-resize";
  document.body.style.userSelect = "none";

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onEnd);
  window.addEventListener("touchcancel", onEnd);
};

const clampToViewport = () => {
  const max = window.innerHeight - TERMINAL_TOP_PADDING;
  if (height.value > max) height.value = max;
};

onMounted(() => {
  window.addEventListener("resize", clampToViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", clampToViewport);
});

const handleUserChange = (user: any) => {
  if (typeof user === "string") {
    selectedUser.value = user;
  }
};

const handleShellChange = (s: "bash" | "sh") => {
  if (selectedShell.value === s) return;
  selectedShell.value = s;
  terminalKey.value += 1;
};

const handleConnectionStatusChange = (status: ConnectionStatus) => {
  connectionStatus.value = status;
};

const handleReconnect = () => {
  terminalRef.value?.reconnect();
};

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      showWarning.value = true;
      connectionStatus.value = "connecting";
    }
  },
);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      const scrollY = window.scrollY;
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      document.body.setAttribute("data-scroll-y", scrollY.toString());
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = parseInt(
        document.body.getAttribute("data-scroll-y") || "0",
      );
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
      document.body.removeAttribute("data-scroll-y");
      document.body.style.top = "";
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    }
  },
);

onBeforeUnmount(() => {
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  document.body.removeAttribute("data-scroll-y");
  document.body.style.top = "";
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="slide-up">
      <div
        v-if="isOpen"
        class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border-t border-zinc-800 bg-zinc-900 ease-in-out"
        :class="isResizing ? '' : 'transition-[height] duration-300'"
        :style="{ height: `${height}px` }"
      >
        <div
          class="group absolute inset-x-0 -top-1.5 z-10 flex h-3 cursor-ns-resize items-center justify-center"
          role="separator"
          aria-orientation="horizontal"
          :aria-label="t('server.terminal.resize')"
          @mousedown="startResize"
          @touchstart="startResize"
        >
          <div
            class="h-1 w-12 rounded-full bg-zinc-700 transition-colors group-hover:bg-zinc-500"
            :class="isResizing ? 'bg-zinc-400' : ''"
          />
        </div>
        <div
          class="flex h-10 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-4"
        >
          <div class="flex items-center gap-2 text-zinc-300">
            <Terminal class="h-4 w-4" />
            <h3 class="text-sm font-medium">{{ server.name }}</h3>
            <span class="text-xs text-zinc-500">—</span>
            <span class="font-mono text-xs text-zinc-500">
              {{ server.public_ipv4 }}
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 text-xs text-zinc-500">
              <Circle
                :class="[
                  'h-2 w-2',
                  connectionStatus === 'connected'
                    ? 'fill-green-500 text-green-500'
                    : connectionStatus === 'connecting'
                      ? 'fill-yellow-500 text-yellow-500'
                      : 'fill-red-500 text-red-500',
                ]"
              />
              <span>{{ t(`server.terminal.${connectionStatus}`) }}</span>
              <span class="text-zinc-600">•</span>

              <template v-if="isContainerMode">
                <div
                  class="flex h-6 items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300"
                  :title="`docker exec -it ${container} ${selectedShell || 'sh'}`"
                >
                  <Icon name="lucide:box" class="h-3 w-3 text-sky-400" />
                  <span class="font-mono truncate max-w-[180px]">{{
                    container
                  }}</span>
                </div>
                <div
                  class="flex h-6 overflow-hidden rounded border border-zinc-700 bg-zinc-900"
                >
                  <button
                    type="button"
                    class="px-2 text-[11px] transition-colors"
                    :class="
                      selectedShell === 'bash'
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    "
                    @click="handleShellChange('bash')"
                  >
                    Bash
                  </button>
                  <button
                    type="button"
                    class="border-l border-zinc-700 px-2 text-[11px] transition-colors"
                    :class="
                      selectedShell === 'sh'
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-200'
                    "
                    @click="handleShellChange('sh')"
                  >
                    /bin/sh
                  </button>
                </div>
              </template>

              <template v-else>
                <Select
                  :model-value="selectedUser"
                  @update:model-value="handleUserChange"
                >
                  <SelectTrigger
                    class="h-6 w-[110px] border-zinc-700 bg-zinc-900 text-xs text-zinc-300 focus:ring-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent class="border-zinc-700 bg-zinc-900">
                    <SelectItem
                      v-for="user in serverUsers"
                      :key="user.value"
                      :value="user.value"
                      class="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      <div class="flex items-center gap-1.5">
                        <Shield
                          v-if="user.isRoot"
                          class="h-3 w-3 text-amber-500"
                        />
                        <User v-else class="h-3 w-3" />
                        <span>{{ user.label }}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </template>
            </div>

            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                :title="t('server.terminal.reconnect')"
                @click="handleReconnect"
              >
                <RotateCcw class="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                @click="toggleMaximize"
              >
                <Minimize2 v-if="isMaximized" class="h-3 w-3" />
                <Maximize2 v-else class="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                @click="emit('close')"
              >
                <X class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div
          v-if="showWarning"
          class="flex-shrink-0 border-b border-amber-900/50 bg-amber-950/50 px-3 py-2"
        >
          <Alert variant="default" class="border-0 bg-transparent p-0">
            <div class="flex items-start gap-2">
              <AlertTriangle
                class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
              />
              <AlertDescription class="flex-1 text-xs text-amber-200/90">
                <span class="font-medium">{{
                  t("server.terminal.caution")
                }}</span>
                {{ t("server.terminal.cautionDescription") }}
              </AlertDescription>
              <Button
                variant="ghost"
                size="icon"
                class="-mr-1 h-5 w-5 text-amber-500/70 hover:bg-transparent hover:text-amber-500"
                @click="showWarning = false"
              >
                <X class="h-3 w-3" />
              </Button>
            </div>
          </Alert>
        </div>

        <div class="flex-1 overflow-hidden bg-black">
          <ServerTerminal
            v-if="isOpen"
            :key="terminalKey"
            ref="terminalRef"
            :server-id="server.id"
            :username="selectedUser"
            :is-maximized="isMaximized"
            :container="container"
            :shell="selectedShell"
            @connection-status-change="handleConnectionStatusChange"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.modal-open {
  overflow: hidden;
  position: fixed;
  width: 100%;
}
</style>

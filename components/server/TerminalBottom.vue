<script setup lang="ts">
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
  /**
   * When set, the bottom pane attaches to this container (via the WS
   * handler's `?container=` mode) instead of opening the host root
   * shell. Used by the workload detail pages so the Terminal button
   * drops you inside the database / application container.
   */
  container?: string;
}

const props = withDefaults(defineProps<Props>(), {
  container: "",
});
const emit = defineEmits<{
  close: [];
}>();

type ConnectionStatus = "connecting" | "connected" | "disconnected";

// Server users with local user prioritized first
const serverUsers = computed(() => {
  const users = props.server.users;
  if (!users) {
    return [];
  }

  const result: { value: string; label: string; isRoot: boolean }[] = [];

  // Add local user first (priority)
  if (users.local) {
    result.push({ value: users.local, label: users.local, isRoot: false });
  }

  // Add root user second
  if (users.root) {
    result.push({ value: users.root, label: users.root, isRoot: true });
  }

  return result;
});

// Get default user (local user has priority)
const defaultUser = computed(() => serverUsers.value[0]?.value || "");

// When in container mode (props.container is set), docker exec needs
// to run as root, so we force the SSH user to root regardless of the
// host-shell user picker. Otherwise default to the local user.
const isContainerMode = computed(() => props.container.length > 0);
const initialUser = computed(() => {
  if (isContainerMode.value) {
    return props.server.users?.root || "root";
  }
  return defaultUser.value;
});

// Persistent terminal height — survives page reloads so users don't
// have to drag back to their preferred size each session. Hard
// minimum keeps the header + warning + a usable terminal area on
// screen; max keeps a sliver of the page above the terminal visible.
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

const height = ref(loadPersistedHeight());
const isMaximized = ref(false);
// Disable the height CSS transition while the user is actively
// dragging the resize handle — without this the cursor visibly lags
// the panel edge by ~300ms and the resize feels broken.
const isResizing = ref(false);
const connectionStatus = ref<ConnectionStatus>("connecting");
const selectedUser = ref(initialUser.value);
// Container-mode shell. Mirrors dokploy's "Select way to connect" toggle.
// "" = auto-detect (legacy wrapper `bash || sh`), "bash" = /bin/bash
// directly, "sh" = /bin/sh directly. Bare-shell paths skip the `sh -c`
// wrapper so distroless or minimal images (no /bin/sh on PATH) still
// open a working session — the wrapper was the cause of the
// `exec: "sh": executable file not found in $PATH` error the user hit
// on a node:slim Nuxt container.
const selectedShell = ref<"" | "bash" | "sh">("bash");

// Re-seed the user when container mode flips (e.g. user navigates
// between workload pages without remounting the layout).
watch(initialUser, (u) => {
  selectedUser.value = u;
});
const terminalKey = ref(0);
const showWarning = ref(true);
const terminalRef = ref<InstanceType<typeof ServerTerminal> | null>(null);

const toggleMaximize = () => {
  if (isMaximized.value) {
    // Restore the user's persisted size, falling back to 400 the
    // first time around.
    height.value = loadPersistedHeight();
  } else {
    height.value = window.innerHeight - 100;
  }
  isMaximized.value = !isMaximized.value;
};

// Drag-to-resize handle on the top edge of the panel.
//
// Mouse + touch are both wired; pointer events would be the modern
// API but supporting iOS Safari without extra polyfills is simpler
// with the dual listeners. The window-level listeners ensure the
// drag keeps tracking even if the cursor moves over the xterm canvas
// (which would otherwise eat the move events). We also flip
// `isResizing` so the height transition switches off during the
// drag — without that the cursor visibly leads the panel edge.
const startResize = (event: MouseEvent | TouchEvent) => {
  event.preventDefault();
  isResizing.value = true;
  // Drag implicitly exits maximize mode — otherwise the next click
  // on the maximize button would restore to a "saved" 400 that no
  // longer reflects what the user actually wants.
  if (isMaximized.value) isMaximized.value = false;

  const maxHeight = () => window.innerHeight - TERMINAL_TOP_PADDING;

  const onMove = (ev: MouseEvent | TouchEvent) => {
    const clientY =
      "touches" in ev ? ev.touches[0]?.clientY ?? 0 : ev.clientY;
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

  // Globally pin the resize cursor + suppress text selection until
  // the drag ends — keeps the experience smooth even when the cursor
  // strays off the handle while moving.
  document.body.style.cursor = "ns-resize";
  document.body.style.userSelect = "none";

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onEnd);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("touchend", onEnd);
  window.addEventListener("touchcancel", onEnd);
};

// Keep the terminal from growing past the viewport when the window
// itself shrinks (rotating an iPad, dragging a desktop window). We
// clamp on every resize event so the user always sees the full
// header/footer chrome.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleUserChange = (user: any) => {
  if (typeof user === 'string') {
    selectedUser.value = user;
  }
};

// Switching the shell on a live session would leave the docker-exec
// stdio half-attached, so we bump terminalKey to remount ServerTerminal
// — the new WS opens with the new ?shell= value.
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

// Reset warning when terminal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      showWarning.value = true;
      connectionStatus.value = "connecting";
    }
  }
);

// Handle scroll lock when terminal is open
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
        document.body.getAttribute("data-scroll-y") || "0"
      );
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
      document.body.removeAttribute("data-scroll-y");
      document.body.style.top = "";
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
    }
  }
);

onBeforeUnmount(() => {
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  document.body.removeAttribute("data-scroll-y");
  document.body.style.top = "";
});
</script>

<template>
  <!-- Backdrop blur when terminal is open -->
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
        <!--
          Drag handle for resizing the terminal vertically. Sits as a
          thin strip at the very top edge of the panel; a small
          "grabber" pill is centred horizontally to make it visually
          discoverable on hover. The handle's hit area is wider than
          the visible pill (8px tall) so users don't have to be
          pixel-perfect to grab it.
        -->
        <div
          class="group absolute inset-x-0 -top-1.5 z-10 flex h-3 cursor-ns-resize items-center justify-center"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize terminal"
          @mousedown="startResize"
          @touchstart="startResize"
        >
          <div
            class="h-1 w-12 rounded-full bg-zinc-700 transition-colors group-hover:bg-zinc-500"
            :class="isResizing ? 'bg-zinc-400' : ''"
          />
        </div>
        <!-- Header -->
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
              <span class="capitalize">{{ connectionStatus }}</span>
              <span class="text-zinc-600">•</span>

              <!--
                User picker only makes sense for a host shell. In
                container mode (`container` prop set) the SSH user is
                always root (needed for docker exec), and the actual
                in-container user comes from the image's USER
                directive — picking between host users would be
                misleading. Show a static "container: <name>" chip
                instead.
              -->
              <template v-if="isContainerMode">
                <div
                  class="flex h-6 items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300"
                  :title="`docker exec -it ${container} ${selectedShell || 'sh'}`"
                >
                  <Icon name="lucide:box" class="h-3 w-3 text-sky-400" />
                  <span class="font-mono truncate max-w-[180px]">{{ container }}</span>
                </div>
                <!--
                  Shell toggle: bash by default, /bin/sh fallback. Same
                  surface as dokploy's "Select way to connect to <id>".
                  Switching forces a terminalKey bump so ServerTerminal
                  reopens the WS with the new ?shell= value — the WS
                  side can't re-exec in flight.
                -->
                <div class="flex h-6 overflow-hidden rounded border border-zinc-700 bg-zinc-900">
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
                <Select :model-value="selectedUser" @update:model-value="handleUserChange">
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
                        <Shield v-if="user.isRoot" class="h-3 w-3 text-amber-500" />
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
                title="Reconnect"
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

        <!-- Warning Banner -->
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
                <span class="font-medium">Caution:</span> Only make changes if
                you understand what you're doing. Incorrect commands may break
                application connectivity or server functionality.
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

        <!-- Terminal content -->
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

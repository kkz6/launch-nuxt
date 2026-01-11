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
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

type TerminalUser = "launcher" | "root";
type ConnectionStatus = "connecting" | "connected" | "disconnected";

const height = ref(400);
const isMaximized = ref(false);
const connectionStatus = ref<ConnectionStatus>("connecting");
const selectedUser = ref<TerminalUser>("launcher");
const terminalKey = ref(0);
const showWarning = ref(true);
const terminalRef = ref<InstanceType<typeof ServerTerminal> | null>(null);

const toggleMaximize = () => {
  if (isMaximized.value) {
    height.value = 400;
  } else {
    height.value = window.innerHeight - 100;
  }
  isMaximized.value = !isMaximized.value;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleUserChange = (user: any) => {
  selectedUser.value = user as TerminalUser;
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
        class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border-t border-zinc-800 bg-zinc-900"
        :style="{ height: `${height}px` }"
      >
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

              <!-- User Selector -->
              <Select :model-value="selectedUser" @update:model-value="handleUserChange">
                <SelectTrigger
                  class="h-6 w-[110px] border-zinc-700 bg-zinc-900 text-xs text-zinc-300 focus:ring-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent class="border-zinc-700 bg-zinc-900">
                  <SelectItem
                    value="launcher"
                    class="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    <div class="flex items-center gap-1.5">
                      <User class="h-3 w-3" />
                      <span>launcher</span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="root"
                    class="text-xs text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100"
                  >
                    <div class="flex items-center gap-1.5">
                      <Shield class="h-3 w-3 text-amber-500" />
                      <span>root</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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

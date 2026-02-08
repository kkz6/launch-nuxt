<script setup lang="ts">
import { Button } from '~/components/ui/button'
import type { Server, Site } from '~/types'

interface Props {
  server: Server
  site: Site
  isOpen: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const height = ref(400)
const isMaximized = ref(false)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>('connecting')
const terminalRef = ref<InstanceType<typeof import('./Terminal.vue').default> | null>(null)

const toggleMaximize = () => {
  if (isMaximized.value) {
    height.value = 400
  } else {
    height.value = window.innerHeight - 100
  }
  isMaximized.value = !isMaximized.value
}

const clearTerminal = () => {
  if (terminalRef.value) {
    terminalRef.value.clearTerminal()
  }
}

const onConnectionStatusChange = (status: 'connecting' | 'connected' | 'disconnected') => {
  connectionStatus.value = status
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.documentElement.classList.add('modal-open')
      document.body.classList.add('modal-open')
      document.body.setAttribute('data-scroll-y', scrollY.toString())
      document.body.style.top = `-${scrollY}px`
    } else {
      const scrollY = parseInt(document.body.getAttribute('data-scroll-y') || '0')
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
      document.body.removeAttribute('data-scroll-y')
      document.body.style.top = ''
      if (scrollY > 0) {
        window.scrollTo(0, scrollY)
      }
    }
  }
)

onBeforeUnmount(() => {
  document.documentElement.classList.remove('modal-open')
  document.body.classList.remove('modal-open')
  document.body.removeAttribute('data-scroll-y')
  document.body.style.top = ''
})

const connectionStatusColor = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'fill-green-500 text-green-500'
    case 'connecting':
      return 'fill-yellow-500 text-yellow-500'
    default:
      return 'fill-red-500 text-red-500'
  }
})
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
        class="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border-t border-zinc-800 bg-zinc-900 transition-[height] duration-300 ease-in-out"
        :style="{ height: `${height}px` }"
      >
        <!-- Header -->
        <div class="flex h-10 flex-shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <div class="flex items-center gap-2 text-zinc-300">
            <Icon name="lucide:terminal" class="h-4 w-4" />
            <h3 class="text-sm font-medium">{{ site.address }}</h3>
            <span class="text-xs text-zinc-500">—</span>
            <span class="font-mono text-xs text-zinc-500">
              {{ (site as any).app_directory }}
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 text-xs text-zinc-500">
              <Icon name="lucide:circle" class="h-2 w-2" :class="connectionStatusColor" />
              <span class="capitalize">{{ connectionStatus }}</span>
              <span class="text-zinc-600">•</span>
              <span class="font-mono">launcher</span>
            </div>

            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                title="Clear terminal"
                @click="clearTerminal"
              >
                <Icon name="lucide:rotate-ccw" class="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                @click="toggleMaximize"
              >
                <Icon v-if="isMaximized" name="lucide:minimize-2" class="h-3 w-3" />
                <Icon v-else name="lucide:maximize-2" class="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                @click="emit('close')"
              >
                <Icon name="lucide:x" class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Terminal content -->
        <div class="flex-1 overflow-hidden bg-black">
          <SiteTerminal
            v-if="isOpen"
            ref="terminalRef"
            :server-id="server.id"
            :site-id="site.id"
            :is-maximized="isMaximized"
            @connection-status-change="onConnectionStatusChange"
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

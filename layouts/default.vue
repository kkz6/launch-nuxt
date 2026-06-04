<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'

defineProps<{
  title?: string
}>()

const { isAuthenticated, isInitialized } = useAuth()
const colorMode = useColorMode()

// `isMounted` makes hydration deterministic: SSR + the first client render
// both see `false`, so the template path matches. After mount we re-render
// once with the real auth state. Previously we used <ClientOnly>, which
// emits a fragment / comment placeholder that broke the Nuxt layout
// <Transition> (it needs a single element root).
const isMounted = ref(false)

onMounted(() => {
  isMounted.value = true

  if (colorMode.preference === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (colorMode.preference === 'light') {
    document.documentElement.classList.remove('dark')
  }
})

// Show the authed shell only after we're mounted and auth has resolved.
const showAuthedShell = computed(
  () => isMounted.value && isInitialized.value && isAuthenticated.value,
)
</script>

<template>
  <!-- Single-root template: the conditional content lives *inside* one
       wrapper element so Nuxt's layout <Transition> always has a single
       node to animate. The wrapper has no visual styling — it inherits
       block layout from the page tree. -->
  <div class="contents">
    <div
      v-if="showAuthedShell"
      id="app-container"
      class="relative flex h-screen w-full flex-col overflow-hidden bg-background"
    >
      <LayoutPlatformUpdateBanner />
      <LayoutNavbar />
      <main class="w-full flex-1 overflow-y-auto px-4 pt-4 pb-10 lg:px-8">
        <slot />
      </main>
      <Toaster position="bottom-center" :close-button="true" :duration="4000" />
    </div>
    <slot v-else />
  </div>
</template>

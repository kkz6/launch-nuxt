<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'

defineProps<{
  title?: string
}>()

const { isAuthenticated, isInitialized } = useAuth()
const colorMode = useColorMode()

// Set initial color mode class
onMounted(() => {
  if (colorMode.preference === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (colorMode.preference === 'light') {
    document.documentElement.classList.remove('dark')
  }
})
</script>

<template>
  <div
    v-if="isInitialized && isAuthenticated"
    id="app-container"
    class="relative flex min-h-screen w-full flex-col bg-background"
  >
    <LayoutNavbar />
    <main class="w-full flex-1 px-4 pt-4 pb-10 lg:px-8">
      <slot />
    </main>
    <Toaster position="bottom-center" :close-button="true" :duration="4000" />
  </div>
</template>

<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'

defineProps<{
  title?: string
}>()

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
    id="app-container"
    class="relative flex min-h-screen w-full flex-col bg-background"
  >
    <LayoutNavbar />
    <main class="flex w-full flex-1 flex-col items-center pt-6 pb-10">
      <div class="w-full max-w-8xl px-4 lg:px-8">
        <slot />
      </div>
    </main>
    <Toaster rich-colors />
  </div>
</template>

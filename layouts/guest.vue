<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'

defineProps<{
  title?: string
}>()
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8"
  >
    <div class="w-full max-w-md space-y-8">
      <slot />
    </div>
    <Toaster rich-colors />
  </div>
</template>

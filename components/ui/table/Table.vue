<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from '~/utils'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div class="relative w-full overflow-hidden rounded-lg border bg-card shadow-md">
    <table :class="cn('w-full caption-bottom text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>

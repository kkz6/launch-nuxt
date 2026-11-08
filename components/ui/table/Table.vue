<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  borderless?: boolean;
}>();
</script>

<template>
  <div
    class="relative w-full bg-card"
    :class="
      borderless
        ? 'overflow-x-auto border-y'
        : 'overflow-hidden rounded-lg border'
    "
  >
    <table :class="cn('w-full caption-bottom text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>

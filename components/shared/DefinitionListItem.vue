<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
</script>

<template>
  <div class="py-2 sm:grid sm:grid-cols-3 sm:gap-2 sm:py-2">
    <dt class="text-sm font-medium text-muted-foreground">{{ label }}</dt>
    <dd class="mt-1 flex flex-row items-center text-sm text-foreground sm:col-span-2 sm:mt-0">
      <slot />
    </dd>
  </div>
</template>

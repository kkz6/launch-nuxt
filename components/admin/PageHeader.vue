<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <header
    class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex min-w-0 items-start gap-3">
      <slot name="title-leading" />
      <div class="min-w-0">
        <h1
          class="break-words text-xl font-semibold text-foreground"
        >
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground"
        >
          {{ description }}
        </p>
      </div>
    </div>
    <div
      v-if="$slots.actions"
      class="flex shrink-0 flex-wrap items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </header>
</template>

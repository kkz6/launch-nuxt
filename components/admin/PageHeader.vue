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
          class="break-words text-[26px] font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-[28px]"
        >
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="mt-2 max-w-2xl text-[13px] leading-5 text-muted-foreground"
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

<script setup lang="ts">
// MDC component for ::doc-card — the Fumadocs <Card> equivalent. A linked
// tile when `to` is set, otherwise a plain panel. Styled to the site palette.
defineProps<{ title?: string; to?: string }>()
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="group block rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] p-4 no-underline transition-all hover:border-[hsl(var(--site-accent))]/40 hover:bg-[hsl(var(--site-surface-elevated))]"
  >
    <div class="flex items-center gap-2">
      <span class="font-semibold text-[hsl(var(--site-text))]">{{ title }}</span>
      <Icon
        name="lucide:arrow-right"
        class="h-3.5 w-3.5 text-[hsl(var(--site-accent))] transition-transform group-hover:translate-x-0.5"
      />
    </div>
    <div class="mt-1 text-sm text-[hsl(var(--site-text-muted))] [&_p]:my-0">
      <slot />
    </div>
  </NuxtLink>

  <div
    v-else
    class="rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] p-4"
  >
    <div v-if="title" class="font-semibold text-[hsl(var(--site-text))]">{{ title }}</div>
    <div class="mt-1 text-sm text-[hsl(var(--site-text-muted))] [&_p]:my-0">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// MDC component for ::doc-card — the Fumadocs <Card> equivalent. A linked
// tile when `to` is set, otherwise a plain panel. Styled to the site palette.
defineProps<{ title?: string; to?: string }>();
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="group flex h-full flex-col rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))]/60 p-5 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--site-accent))]/50 hover:bg-[hsl(var(--site-surface-elevated))] hover:shadow-lg hover:shadow-emerald-950/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--site-accent))]/40 [&_*]:no-underline"
  >
    <div class="flex items-center justify-between gap-3">
      <span
        class="font-semibold text-[hsl(var(--site-text))] transition-colors group-hover:text-[hsl(var(--site-accent))]"
      >
        {{ title }}
      </span>
      <Icon
        name="lucide:arrow-right"
        class="h-4 w-4 shrink-0 text-[hsl(var(--site-text-muted))] transition-all group-hover:translate-x-0.5 group-hover:text-[hsl(var(--site-accent))]"
      />
    </div>
    <div
      class="mt-2 text-sm leading-relaxed text-[hsl(var(--site-text-muted))] [&_p]:my-0"
    >
      <slot />
    </div>
  </NuxtLink>

  <div
    v-else
    class="flex h-full flex-col rounded-xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))]/60 p-5"
  >
    <div v-if="title" class="font-semibold text-[hsl(var(--site-text))]">
      {{ title }}
    </div>
    <div
      class="mt-2 text-sm leading-relaxed text-[hsl(var(--site-text-muted))] [&_p]:my-0"
    >
      <slot />
    </div>
  </div>
</template>

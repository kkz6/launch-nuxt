<script setup lang="ts">
// MDC component for ::card — the Fumadocs <Card> equivalent. A linked
// tile when `to` is set, otherwise a plain panel.
defineProps<{ title?: string; to?: string }>()
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    class="group block rounded-xl border bg-card p-4 no-underline transition-colors hover:border-emerald-500/40 hover:bg-muted/40"
  >
    <div class="flex items-center gap-2">
      <span class="font-semibold text-foreground">{{ title }}</span>
      <Icon
        name="lucide:arrow-right"
        class="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </div>
    <div class="mt-1 text-sm text-muted-foreground [&_p]:my-0">
      <slot />
    </div>
  </NuxtLink>

  <div v-else class="rounded-xl border bg-card p-4">
    <div v-if="title" class="font-semibold text-foreground">{{ title }}</div>
    <div class="mt-1 text-sm text-muted-foreground [&_p]:my-0">
      <slot />
    </div>
  </div>
</template>

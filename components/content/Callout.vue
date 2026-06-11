<script setup lang="ts">
// MDC component for ::callout — the Fumadocs <Callout> equivalent.
interface Props {
  type?: 'info' | 'warning' | 'error' | 'tip' | 'note'
  title?: string
}
const props = withDefaults(defineProps<Props>(), { type: 'info' })

const variants: Record<string, { box: string; icon: string; ic: string }> = {
  info: { box: 'border-sky-500/30 bg-sky-500/[0.06]', icon: 'lucide:info', ic: 'text-sky-500' },
  warning: { box: 'border-amber-500/30 bg-amber-500/[0.06]', icon: 'lucide:triangle-alert', ic: 'text-amber-500' },
  error: { box: 'border-rose-500/30 bg-rose-500/[0.06]', icon: 'lucide:octagon-alert', ic: 'text-rose-500' },
  tip: { box: 'border-emerald-500/30 bg-emerald-500/[0.06]', icon: 'lucide:lightbulb', ic: 'text-emerald-500' },
  note: { box: 'border-border bg-muted/40', icon: 'lucide:pencil-line', ic: 'text-muted-foreground' },
}
const v = computed(() => variants[props.type] ?? variants.info)
</script>

<template>
  <div class="my-5 flex gap-3 rounded-lg border p-4" :class="v.box">
    <Icon :name="v.icon" class="mt-0.5 h-4 w-4 shrink-0" :class="v.ic" />
    <div class="min-w-0 text-sm leading-relaxed [&_p]:my-0 [&_p+p]:mt-2 [&_code]:text-[0.85em]">
      <p v-if="title" class="mb-1 font-semibold text-foreground">{{ title }}</p>
      <slot />
    </div>
  </div>
</template>

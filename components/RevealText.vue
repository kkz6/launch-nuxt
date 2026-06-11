<script setup lang="ts">
// Word-by-word reveal for headings. Each word fades + lifts + unblurs with a
// stagger when the element scrolls into view. Pure CSS animation triggered by
// an IntersectionObserver — no runtime animation lib, SSR-safe, and it falls
// back to fully visible when motion is reduced or JS is unavailable.
const props = withDefaults(
  defineProps<{
    text: string
    stagger?: number
    delay?: number
    as?: string
  }>(),
  { stagger: 0.05, delay: 0.05, as: 'span' }
)

// Split on explicit line breaks (\n → <br>) then on spaces, keeping a flat
// word index so the stagger runs continuously across lines.
const lines = computed(() => {
  let i = 0
  return props.text.split('\n').map((line) => ({
    words: line.split(' ').map((w) => ({ w, i: i++ })),
  }))
})

const root = ref<HTMLElement | null>(null)
const shown = ref(false)

onMounted(() => {
  if (!root.value || typeof IntersectionObserver === 'undefined') {
    shown.value = true
    return
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        shown.value = true
        io.disconnect()
      }
    },
    { threshold: 0.25 }
  )
  io.observe(root.value)
  onBeforeUnmount(() => io.disconnect())
})
</script>

<template>
  <component :is="as" ref="root" :class="['reveal-text', { 'is-shown': shown }]">
    <template v-for="(line, li) in lines" :key="li">
      <br v-if="li > 0" >
      <span
        v-for="word in line.words"
        :key="word.i"
        class="reveal-word"
        :style="{ animationDelay: `${delay + word.i * stagger}s` }"
        >{{ word.w + ' ' }}</span
      >
    </template>
  </component>
</template>

<style scoped>
.reveal-word {
  display: inline-block;
  white-space: pre;
  opacity: 0;
  transform: translateY(0.45em);
  filter: blur(6px);
}

.is-shown .reveal-word {
  animation: reveal-word-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes reveal-word-in {
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-word {
    opacity: 1;
    transform: none;
    filter: none;
    animation: none !important;
  }
}
</style>

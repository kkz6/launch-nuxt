<script setup lang="ts">
// Shared marketing CTA — terminal / developer-native styling to match
// the landing page. Used on pricing, support and integrations.
interface Props {
  className?: string;
  heading: string;
  buttonText: string;
  buttonLink?: string;
}

const props = withDefaults(defineProps<Props>(), {
  className: "",
  buttonLink: undefined,
});
</script>

<template>
  <section :class="['relative bg-background py-24', props.className]">
    <div class="mx-auto max-w-6xl px-6 lg:px-8">
      <div
        class="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-16 text-center shadow-2xl shadow-black/30 sm:px-16"
      >
        <div
          class="bp-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,black,transparent)]"
        />
        <div class="relative mx-auto max-w-2xl">
          <div class="font-mono text-sm text-emerald-400">
            <span class="text-zinc-500">$</span> lctl get-started<span
              class="caret"
              >▋</span
            >
          </div>
          <h2
            class="mt-5 font-mono text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl"
          >
            {{ heading }}
          </h2>
          <div class="mt-8 flex justify-center">
            <NuxtLink
              v-if="buttonLink"
              :to="buttonLink"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-mono text-sm font-semibold text-zinc-950 shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <span class="text-zinc-950/50">$</span> {{ buttonText }}
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </NuxtLink>
            <button
              v-else
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-mono text-sm font-semibold text-zinc-950 shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <span class="text-zinc-950/50">$</span> {{ buttonText }}
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bp-grid-dark {
  background-image:
    linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px);
  background-size: 3rem 3rem;
}
@keyframes caretBlink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}
.caret {
  animation: caretBlink 1.1s step-end infinite;
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}
</style>

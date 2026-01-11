<script setup lang="ts">
interface Props {
  className?: string
  heading: string
  buttonText: string
  buttonLink?: string
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
  buttonLink: undefined,
})
</script>

<template>
  <section :class="['site-section bg-[hsl(var(--site-bg))] py-16', props.className]">
    <div class="site-grid-pattern absolute inset-0" />
    <div
      class="site-glow bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 translate-y-1/2 bg-emerald-500 opacity-20"
    />

    <div class="site-container relative">
      <div class="text-center" data-aos="fade-up">
        <h2 class="font-site mb-5 text-xl font-bold text-[hsl(var(--site-text))] md:text-2xl">
          {{ heading }}
        </h2>
        <NuxtLink v-if="buttonLink" :to="buttonLink" class="btn btn-site-primary group">
          {{ buttonText }}
          <svg
            class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-width="2"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </NuxtLink>
        <button v-else class="btn btn-site-primary group">
          {{ buttonText }}
          <svg
            class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-width="2"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>

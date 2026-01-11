<script setup lang="ts">
interface App {
  name: string
  image: string
  badge?: boolean
}

interface Props {
  app: App
}

defineProps<Props>()
</script>

<template>
  <article class="site-card site-card-hover group rounded-2xl p-6">
    <div
      class="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--site-text))]/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
    />

    <div class="mb-4 inline-flex">
      <div class="relative">
        <div
          class="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--site-text))]/10"
        >
          <img class="h-10 w-10 object-contain" :src="app.image" width="40" height="40" :alt="app.name" />
        </div>
        <span
          v-if="app.badge"
          class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"
        >
          <svg class="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
    </div>
    <h3 class="font-site mb-2 text-lg font-semibold text-[hsl(var(--site-text))]">
      {{ app.name }}
    </h3>
    <p class="text-sm leading-relaxed text-[hsl(var(--site-text-muted))]">
      <slot />
    </p>
  </article>
</template>

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
  <section :class="['relative bg-background py-24', props.className]">
    <div class="absolute inset-0 bg-gradient-to-t from-muted/50 to-background" />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="text-center">
        <h2 class="mb-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {{ heading }}
        </h2>
        <NuxtLink
          v-if="buttonLink"
          :to="buttonLink"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          {{ buttonText }}
          <Icon name="lucide:arrow-right" class="h-4 w-4" />
        </NuxtLink>
        <button
          v-else
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          {{ buttonText }}
          <Icon name="lucide:arrow-right" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </section>
</template>

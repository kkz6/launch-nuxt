<script setup lang="ts">
interface Props {
  icon?: string
  title: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  icon: 'lucide:inbox',
  description: '',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-10">
    <div class="flex h-11 w-11 items-center justify-center rounded-lg border border-border/40 bg-background">
      <Icon :name="icon" class="h-5 w-5 text-muted-foreground/70" />
    </div>
    <h3 class="mt-3 text-sm font-medium text-foreground/80">{{ title }}</h3>
    <p v-if="description" class="mt-1 text-center text-xs text-muted-foreground/70">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>

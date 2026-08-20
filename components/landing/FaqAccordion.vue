<script setup lang="ts">
interface Props {
  title: string;
  id: string;
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
});

const accordionOpen = ref(props.active);
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/20"
  >
    <h2>
      <button
        class="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-sm font-medium text-foreground"
        :aria-expanded="accordionOpen"
        :aria-controls="`accordion-text-${id}`"
        @click.prevent="accordionOpen = !accordionOpen"
      >
        <span
          ><span class="text-emerald-600 dark:text-emerald-400">?</span>
          {{ title }}</span
        >
        <span
          :class="[
            'ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded transition-all duration-300',
            accordionOpen
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          ]"
        >
          <Icon
            name="lucide:chevron-down"
            :class="[
              'h-4 w-4 transition duration-300',
              { 'rotate-180': accordionOpen },
            ]"
          />
        </span>
      </button>
    </h2>
    <div
      :id="`accordion-text-${id}`"
      role="region"
      :aria-labelledby="`accordion-title-${id}`"
      :class="[
        'grid overflow-hidden text-muted-foreground transition-all duration-300 ease-in-out',
        accordionOpen
          ? 'grid-rows-[1fr] opacity-100'
          : 'grid-rows-[0fr] opacity-0',
      ]"
    >
      <div class="overflow-hidden">
        <p class="px-4 pb-3 text-sm leading-relaxed">
          <slot />
        </p>
      </div>
    </div>
  </div>
</template>

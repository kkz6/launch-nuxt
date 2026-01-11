<script setup lang="ts">
interface Props {
  title: string
  id: string
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
})

const accordionOpen = ref(props.active)
</script>

<template>
  <div
    class="site-card overflow-hidden rounded-lg transition-all duration-300 hover:border-[hsl(var(--site-text))]/20"
  >
    <h2>
      <button
        class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[hsl(var(--site-text))]"
        :aria-expanded="accordionOpen"
        :aria-controls="`accordion-text-${id}`"
        @click.prevent="accordionOpen = !accordionOpen"
      >
        <span>{{ title }}</span>
        <span
          :class="[
            'ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded transition-all duration-300',
            accordionOpen
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-[hsl(var(--site-text))]/5 text-[hsl(var(--site-text-muted))]',
          ]"
        >
          <svg
            :class="['transition duration-300', { 'rotate-180': accordionOpen }]"
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </span>
      </button>
    </h2>
    <div
      :id="`accordion-text-${id}`"
      role="region"
      :aria-labelledby="`accordion-title-${id}`"
      :class="[
        'grid overflow-hidden text-[hsl(var(--site-text-muted))] transition-all duration-300 ease-in-out',
        accordionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
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

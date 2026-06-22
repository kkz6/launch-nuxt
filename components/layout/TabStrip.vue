<script setup lang="ts" generic="T extends TabItem">
// `Icon` (Nuxt Icon) and the script-setup macros (ref/computed/watch/
// nextTick/onMounted/onBeforeUnmount) are Nuxt auto-imports — pulling
// them in via `#components` worked at runtime but tripped vue-tsc
// when invoked outside the project's prepared .nuxt/tsconfig.
import type { RouteLocationRaw } from 'vue-router'

/**
 * Uniform tab strip used for every horizontal navigation in the app
 * (server-detail tabs, Advanced sub-tabs, site detail, project detail,
 * workload detail).
 *
 * Two non-obvious things this component owns:
 *
 *  1. Alignment with the breadcrumb above. Every tab button has
 *     internal `px-3` padding. If the nav sits flush with the
 *     container's lg:px-8 left edge, the first tab's icon ends up
 *     12px to the right of the breadcrumb icon. The historical fix
 *     was sprinkling `-ml-3` on each nav block; it drifted out of
 *     sync (e.g. when the server-detail nav got a conditional
 *     `-mx-4 lg:-mx-8` for a full-width bottom border, the mx
 *     shorthand silently shadowed `-ml-3`, leaving the parent tabs
 *     12px off from the breadcrumb AND from the sub-tabs below).
 *     TabStrip applies `-ml-3` exactly once, in one place.
 *
 *  2. Sliding active-tab underline. Used to be six near-identical
 *     copies of refs + reactive offsets + a `nextTick(updateIndicator)`
 *     effect. Centralised here.
 *
 * `extendBorder` is for the parent tabs above a sub-tab strip — it
 * renders a wrapping div with a full-width bottom border without
 * disturbing the nav's `-ml-3` alignment.
 *
 * `toLink` switches the strip between its two modes:
 *   - provided → route tabs; each renders a <NuxtLink> and the URL
 *               drives the active key. Used by the navbar strips.
 *   - omitted  → local tabs; each renders a <button> and emits
 *               update:activeKey on click (v-model:active-key). Used
 *               by self-contained sub-sections like the docker
 *               application Advanced tab.
 */
const props = withDefaults(
  defineProps<{
    tabs: T[]
    activeKey: string
    toLink?: (tab: T) => string | RouteLocationRaw
    variant?: 'foreground' | 'rose'
    extendBorder?: boolean
  }>(),
  {
    variant: 'foreground',
    extendBorder: false,
  },
)
const emit = defineEmits<{ 'update:activeKey': [value: string] }>()

const NuxtLink = resolveComponent('NuxtLink')

const navRef = ref<HTMLElement | null>(null)
const tabRefs = ref(new Map<string, HTMLElement>())
const indicatorLeft = ref(0)
const indicatorWidth = ref(0)

const setTabRef = (key: string, el: unknown) => {
  if (!el) return
  // <NuxtLink ref="..."> hands back a Vue component instance whose
  // `$el` is the rendered <a>. Functional refs occasionally pass the
  // raw element directly, so accept both shapes.
  const node = (el as { $el?: HTMLElement }).$el ?? (el as HTMLElement)
  if (node) tabRefs.value.set(key, node)
}

const updateIndicator = () => {
  const tabEl = tabRefs.value.get(props.activeKey)
  if (!tabEl || !navRef.value) {
    indicatorWidth.value = 0
    return
  }
  const navRect = navRef.value.getBoundingClientRect()
  const tabRect = tabEl.getBoundingClientRect()
  indicatorLeft.value = tabRect.left - navRect.left
  indicatorWidth.value = tabRect.width
}

watch(
  [() => props.activeKey, () => props.tabs.length],
  () => nextTick(updateIndicator),
  { immediate: true },
)

onMounted(() => {
  nextTick(updateIndicator)
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateIndicator)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIndicator)
  }
})

// Variant-driven classes. Rose is used by the Advanced sub-tabs to
// differentiate them visually from the parent tabs above.
const activeTextClass = computed(() =>
  props.variant === 'rose'
    ? 'text-rose-500 dark:text-rose-300'
    : 'text-foreground',
)
const indicatorBgClass = computed(() =>
  props.variant === 'rose' ? 'bg-rose-400' : 'bg-foreground',
)
</script>

<script lang="ts">
export interface TabItem {
  value: string
  label: string
  icon: string
}
</script>

<template>
  <div
    :class="
      extendBorder
        ? '-mx-4 lg:-mx-8 px-4 lg:px-8 border-b border-border'
        : ''
    "
  >
    <nav
      ref="navRef"
      class="relative -mb-px -ml-3 flex gap-1 overflow-x-auto"
    >
      <component
        :is="toLink ? NuxtLink : 'button'"
        v-for="tab in tabs"
        :key="tab.value"
        :ref="(el: unknown) => setTabRef(tab.value, el)"
        :to="toLink ? toLink(tab) : undefined"
        :type="toLink ? undefined : 'button'"
        class="relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
        :class="
          activeKey === tab.value
            ? activeTextClass
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="toLink ? undefined : emit('update:activeKey', tab.value)"
      >
        <Icon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </component>
      <!-- Sliding underline indicator — position computed from the
           active tab's bounding box relative to the nav. -->
      <span
        class="absolute bottom-0 h-0.5 transition-all duration-300 ease-out"
        :class="indicatorBgClass"
        :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
      />
    </nav>
  </div>
</template>

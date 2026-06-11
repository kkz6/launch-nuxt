<script setup lang="ts">
interface NavItem {
  title: string
  path: string
  items?: NavItem[]
}

withDefaults(defineProps<{ items: NavItem[]; depth?: number }>(), { depth: 0 })

const route = useRoute()
const isActive = (path: string) => route.path === path
</script>

<template>
  <ul :class="depth > 0 ? 'mt-1 ml-3 space-y-1 border-l border-border pl-3' : 'space-y-1'">
    <li v-for="item in items" :key="item.path">
      <NuxtLink
        :to="item.path"
        :class="[
          'block rounded-md px-3 py-1.5 text-sm transition-colors',
          isActive(item.path)
            ? 'bg-muted font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        ]"
      >
        {{ item.title }}
      </NuxtLink>
      <DocsNavItems
        v-if="item.items && item.items.length > 0"
        :items="item.items"
        :depth="depth + 1"
      />
    </li>
  </ul>
</template>

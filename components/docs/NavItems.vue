<script setup lang="ts">
interface NavItem {
  title: string;
  path: string;
  items?: NavItem[];
}

withDefaults(defineProps<{ items: NavItem[]; depth?: number }>(), { depth: 0 });

const route = useRoute();
const isActive = (path: string) => route.path === path;
</script>

<template>
  <ul :class="depth > 0 ? 'mt-1 ml-3 space-y-0.5' : 'space-y-0.5'">
    <li v-for="item in items" :key="item.path">
      <NuxtLink
        :to="item.path"
        :class="[
          'block rounded-lg px-3 py-1.5 font-docs-mono text-[12px] transition-all',
          isActive(item.path)
            ? 'bg-[hsl(var(--site-accent))]/10 font-medium text-[hsl(var(--site-accent))]'
            : 'text-[hsl(var(--site-text-muted))] hover:translate-x-0.5 hover:bg-[hsl(var(--site-text))]/5 hover:text-[hsl(var(--site-text))]',
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

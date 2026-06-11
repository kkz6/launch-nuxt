<script setup lang="ts">
const route = useRoute()
const { isAuthenticated } = useAuth()
const colorMode = useColorMode()

const mobileMenuOpen = ref(false)
const mobileSidebarOpen = ref(false)

const navLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs', label: 'Docs' },
]

interface NavNode {
  title: string
  path: string
  children?: NavNode[]
}

interface DocNavItem {
  title: string
  path: string
  items: DocNavItem[]
}

interface DocNavSection {
  title: string
  path?: string
  items: DocNavItem[]
}

// Build the sidebar from the actual @nuxt/content tree so it always reflects
// the markdown files under content/docs.
const { data: navTree } = await useAsyncData('docs-nav', () =>
  queryCollectionNavigation('docs')
)

// Recursively map a content node into a nav item, dropping the directory's own
// index child (its path equals the parent's) so section headers aren't repeated.
const mapItem = (node: NavNode): DocNavItem => ({
  title: node.title,
  path: node.path,
  items: (node.children ?? [])
    .filter((child) => child.path !== node.path)
    .map(mapItem),
})

const docsRoot = computed<NavNode[]>(
  () => navTree.value?.[0]?.children ?? navTree.value ?? []
)

// Top-level pages (no children) render as plain links above the grouped
// sections. Each directory becomes a section whose header links to its index.
const topLevelItems = computed<DocNavItem[]>(() =>
  docsRoot.value
    .filter((node) => !node.children || node.children.length === 0)
    .map(mapItem)
)

const docsNavigation = computed<DocNavSection[]>(() =>
  docsRoot.value
    .filter((node) => node.children && node.children.length > 0)
    .map((node) => ({
      title: node.title,
      path: node.path,
      items: node.children!
        .filter((child) => child.path !== node.path)
        .map(mapItem),
    }))
)

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.preference === 'dark')

const isActive = (path: string) => route.path === path

// Close the mobile sidebar whenever navigation lands on a new page.
watch(() => route.path, () => {
  mobileSidebarOpen.value = false
})

// Receive TOC from page
const docsToc = inject<ComputedRef<Array<{ id: string; text: string }>>>('docsToc', computed(() => []))
</script>

<template>
  <div class="relative min-h-screen bg-[hsl(var(--site-bg))] font-site text-[hsl(var(--site-text))]">
    <!-- Blueprint grid backdrop, matching the landing -->
    <div class="site-grid-pattern pointer-events-none fixed inset-0 -z-10" />

    <!-- Header — mirrors the landing SiteHeader -->
    <header class="sticky top-0 z-50 w-full border-b border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))]/90 backdrop-blur-xl">
      <div class="flex h-12 items-center justify-between px-4 md:px-6">
        <div class="flex items-center gap-6">
          <!-- Mobile sidebar toggle -->
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))] lg:hidden"
            @click="mobileSidebarOpen = !mobileSidebarOpen"
          >
            <Icon name="lucide:panel-left" class="h-4 w-4" />
          </button>

          <NuxtLink to="/" class="text-xl font-bold text-[hsl(var(--site-text))]">launchctl</NuxtLink>

          <ul class="hidden items-center gap-0.5 lg:flex">
            <li v-for="item in navLinks" :key="item.label">
              <NuxtLink
                :to="item.href"
                :class="[
                  'group relative rounded px-3 py-1.5 font-mono text-sm transition-colors',
                  route.path.startsWith(item.href)
                    ? 'text-[hsl(var(--site-accent))]'
                    : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
                ]"
              >
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="flex items-center gap-3">
          <!-- Search button placeholder -->
          <button class="hidden h-8 items-center gap-2 rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] px-3 font-mono text-xs text-[hsl(var(--site-text-muted))] transition-colors hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))] md:flex">
            <Icon name="lucide:search" class="h-3.5 w-3.5" />
            <span>Search docs</span>
            <kbd class="pointer-events-none ml-3 hidden h-4 select-none items-center rounded border border-[hsl(var(--site-border))] px-1 text-[10px] sm:flex">⌘K</kbd>
          </button>

          <a
            href="https://github.com/gigcodes"
            target="_blank"
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))]"
          >
            <Icon name="lucide:github" class="h-4 w-4" />
          </a>

          <button
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))]"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="lucide:sun" class="h-4 w-4" />
            <Icon v-else name="lucide:moon" class="h-4 w-4" />
          </button>

          <NuxtLink
            v-if="!isAuthenticated"
            to="/register"
            class="btn-sm btn-site-primary hidden sm:inline-flex"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Mobile sidebar overlay -->
    <div
      v-if="mobileSidebarOpen"
      class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
      @click="mobileSidebarOpen = false"
    />

    <!-- Mobile sidebar -->
    <aside
      v-if="mobileSidebarOpen"
      class="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))] p-6 lg:hidden"
    >
      <div class="mb-6 flex items-center justify-between">
        <span class="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--site-text-muted))]">Documentation</span>
        <button class="text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]" @click="mobileSidebarOpen = false">
          <Icon name="lucide:x" class="h-5 w-5" />
        </button>
      </div>
      <nav>
        <DocsNavItems v-if="topLevelItems.length" :items="topLevelItems" class="mb-6" />
        <div v-for="section in docsNavigation" :key="section.title" class="mb-6">
          <NuxtLink
            v-if="section.path"
            :to="section.path"
            :class="[
              'mb-2 block font-mono text-xs uppercase tracking-[0.16em] transition-colors',
              isActive(section.path) ? 'text-[hsl(var(--site-accent))]' : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
            ]"
          >
            {{ section.title }}
          </NuxtLink>
          <h4 v-else class="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-[hsl(var(--site-text-muted))]">
            {{ section.title }}
          </h4>
          <DocsNavItems :items="section.items" />
        </div>
      </nav>
    </aside>

    <!-- Main layout -->
    <div class="mx-auto max-w-screen-2xl">
      <div class="flex">
        <!-- Desktop sidebar -->
        <aside class="hidden w-64 shrink-0 border-r border-[hsl(var(--site-border))] lg:block">
          <div class="custom-logs-scrollbar sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto py-8 pr-4 pl-6">
            <nav>
              <DocsNavItems v-if="topLevelItems.length" :items="topLevelItems" class="mb-6" />
              <div v-for="section in docsNavigation" :key="section.title" class="mb-6">
                <NuxtLink
                  v-if="section.path"
                  :to="section.path"
                  :class="[
                    'mb-2 block font-mono text-xs uppercase tracking-[0.16em] transition-colors',
                    isActive(section.path) ? 'text-[hsl(var(--site-accent))]' : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
                  ]"
                >
                  {{ section.title }}
                </NuxtLink>
                <h4 v-else class="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-[hsl(var(--site-text-muted))]">
                  {{ section.title }}
                </h4>
                <DocsNavItems :items="section.items" />
              </div>
            </nav>
          </div>
        </aside>

        <!-- Content area -->
        <main class="min-w-0 flex-1">
          <div class="px-6 py-8 lg:px-12 lg:py-10">
            <slot />
          </div>
        </main>

        <!-- Right sidebar (Table of Contents) -->
        <aside class="hidden w-56 shrink-0 xl:block">
          <div class="sticky top-12 py-8 pl-4 pr-6">
            <div v-if="docsToc && docsToc.length > 0">
              <h4 class="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-[hsl(var(--site-text-muted))]">
                <span class="text-[hsl(var(--site-accent))]">#</span> On this page
              </h4>
              <nav class="space-y-2.5 border-l border-[hsl(var(--site-border))] text-sm">
                <a
                  v-for="link in docsToc"
                  :key="link.id"
                  :href="`#${link.id}`"
                  class="-ml-px block border-l border-transparent pl-3 text-[hsl(var(--site-text-muted))] transition-colors hover:border-[hsl(var(--site-accent))] hover:text-[hsl(var(--site-text))]"
                >
                  {{ link.text }}
                </a>
              </nav>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

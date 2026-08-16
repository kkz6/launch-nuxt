<script setup lang="ts">
const route = useRoute()
const { isAuthenticated } = useAuth()
const colorMode = useColorMode()

const mobileSidebarOpen = ref(false)
const searchOpen = ref(false)
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

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

// Keep the documentation ordered by workflow rather than filename. New pages
// that are not listed here still appear after the curated entries.
const navOrder: Record<string, number> = {
  '/docs': 0,
  '/docs/application': 10,
  '/docs/application/servers': 11,
  '/docs/application/sites': 12,
  '/docs/application/docker': 13,
  '/docs/application/databases': 14,
  '/docs/application/backups': 15,
  '/docs/application/dns': 16,
  '/docs/application/notifications': 17,
  '/docs/application/teams': 18,
  '/docs/application/account': 19,
  '/docs/cli': 20,
  '/docs/cli/servers': 21,
  '/docs/cli/sites': 22,
  '/docs/cli/deployments': 23,
  '/docs/cli/operations': 24,
  '/docs/cli/realtime': 25,
  '/docs/cli/automation': 26,
  '/docs/cli/ai-skill': 27,
  '/docs/api': 30,
  '/docs/api/servers': 31,
  '/docs/api/sites': 32,
  '/docs/api/deployments': 33,
  '/docs/api/docker-applications': 34,
  '/docs/api/databases': 35,
  '/docs/api/ssh-keys': 36,
  '/docs/api/teams': 37,
}

const sortNavNodes = <T extends { path: string }>(nodes: T[]): T[] =>
  [...nodes].sort((a, b) =>
    (navOrder[a.path] ?? Number.MAX_SAFE_INTEGER) -
      (navOrder[b.path] ?? Number.MAX_SAFE_INTEGER) ||
    a.path.localeCompare(b.path),
  )

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
  items: sortNavNodes(
    (node.children ?? []).filter((child) => child.path !== node.path),
  ).map(mapItem),
})

const docsRoot = computed<NavNode[]>(
  () => navTree.value?.[0]?.children ?? navTree.value ?? []
)

// Top-level pages (no children) render as plain links above the grouped
// sections. Each directory becomes a section whose header links to its index.
const topLevelItems = computed<DocNavItem[]>(() =>
  docsRoot.value
    .filter((node) => !node.children || node.children.length === 0)
    .sort((a, b) => (navOrder[a.path] ?? 999) - (navOrder[b.path] ?? 999))
    .map(mapItem)
)

const docsNavigation = computed<DocNavSection[]>(() =>
  sortNavNodes(
    docsRoot.value.filter((node) => node.children && node.children.length > 0),
  )
    .map((node) => ({
      title: node.title,
      path: node.path,
      items: sortNavNodes(
        node.children!.filter((child) => child.path !== node.path),
      ).map(mapItem),
    }))
)

interface SearchItem {
  title: string
  path: string
  section: string
}

const flattenSearchItems = (nodes: NavNode[], section = 'Documentation'): SearchItem[] =>
  nodes.flatMap((node) => [
    { title: node.title, path: node.path, section },
    ...flattenSearchItems(
      (node.children ?? []).filter((child) => child.path !== node.path),
      node.children?.length ? node.title : section,
    ),
  ])

const searchItems = computed(() => flattenSearchItems(docsRoot.value))
const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return searchItems.value.slice(0, 8)
  return searchItems.value
    .map((item) => ({
      ...item,
      score: item.title.toLowerCase().startsWith(query)
        ? 0
        : item.title.toLowerCase().includes(query)
          ? 1
          : item.path.toLowerCase().includes(query)
            ? 2
            : 3,
    }))
    .filter((item) => item.score < 3)
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
    .slice(0, 10)
})

const openSearch = async () => {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

const closeSearch = () => {
  searchOpen.value = false
  searchQuery.value = ''
}

const openFirstSearchResult = async () => {
  const first = searchResults.value[0]
  if (!first) return
  closeSearch()
  await navigateTo(first.path)
}

const handleSearchShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    void openSearch()
  } else if (event.key === 'Escape' && searchOpen.value) {
    closeSearch()
  }
}

onMounted(() => window.addEventListener('keydown', handleSearchShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleSearchShortcut))

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.preference === 'dark')

const isActive = (path: string) => route.path === path

// Close the mobile sidebar whenever navigation lands on a new page.
watch(() => route.path, () => {
  mobileSidebarOpen.value = false
  closeSearch()
})

// Receive TOC from page
const docsToc = inject<ComputedRef<Array<{ id: string; text: string }>>>('docsToc', computed(() => []))
</script>

<template>
  <div class="docs-shell relative min-h-screen bg-[hsl(var(--site-bg))] font-docs text-[hsl(var(--site-text))]">
    <!-- Blueprint grid backdrop, matching the landing -->
    <div class="site-grid-pattern pointer-events-none fixed inset-0 -z-10" />

    <!-- Header — mirrors the landing SiteHeader -->
    <header class="sticky top-0 z-50 w-full border-b border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))]/88 backdrop-blur-xl">
      <div class="h-0.5 w-full bg-gradient-to-r from-[hsl(var(--site-accent))] via-cyan-400 to-transparent" />
      <div class="flex h-14 items-center justify-between px-4 md:px-6">
        <div class="flex items-center gap-6">
          <!-- Mobile sidebar toggle -->
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))] lg:hidden"
            aria-label="Open documentation navigation"
            @click="mobileSidebarOpen = !mobileSidebarOpen"
          >
            <Icon name="lucide:panel-left" class="h-4 w-4" />
          </button>

          <NuxtLink to="/" class="flex items-center gap-2.5 text-[hsl(var(--site-text))]">
            <span class="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(var(--site-text))] font-docs-mono text-xs font-semibold text-[hsl(var(--site-bg))]">L</span>
            <span class="text-lg font-semibold tracking-[-0.03em]">launchctl</span>
            <span class="hidden rounded-full border border-[hsl(var(--site-border))] px-2 py-0.5 font-docs-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--site-text-muted))] sm:inline">docs</span>
          </NuxtLink>

          <ul class="hidden items-center gap-0.5 lg:flex">
            <li v-for="item in navLinks" :key="item.label">
              <NuxtLink
                :to="item.href"
                :class="[
                  'group relative rounded px-3 py-1.5 font-docs-mono text-xs transition-colors',
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
          <button class="hidden h-9 min-w-52 items-center gap-2 rounded-lg border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))]/70 px-3 font-docs-mono text-xs text-[hsl(var(--site-text-muted))] shadow-sm transition-all hover:-translate-y-px hover:border-[hsl(var(--site-accent))]/40 hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))] md:flex" @click="openSearch">
            <Icon name="lucide:search" class="h-3.5 w-3.5" />
            <span>Search docs</span>
            <kbd class="pointer-events-none ml-auto hidden h-5 select-none items-center rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))] px-1.5 text-[10px] sm:flex">⌘K</kbd>
          </button>

          <a
            href="https://github.com/gigcodes"
            target="_blank"
            aria-label="Open launchctl on GitHub"
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))]"
          >
            <Icon name="lucide:github" class="h-4 w-4" />
          </a>

          <button
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))]"
            :aria-label="isDark ? 'Use light theme' : 'Use dark theme'"
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

    <Teleport to="body">
      <div v-if="searchOpen" class="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/55 px-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search documentation" @click.self="closeSearch">
        <div class="w-full max-w-xl overflow-hidden rounded-2xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))] font-docs text-[hsl(var(--site-text))] shadow-2xl shadow-black/25">
          <div class="flex items-center gap-3 border-b border-[hsl(var(--site-border))] px-4">
            <Icon name="lucide:search" class="h-5 w-5 shrink-0 text-[hsl(var(--site-accent))]" />
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="search"
              placeholder="Search commands, guides, and concepts…"
              class="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[hsl(var(--site-text-muted))]"
              @keydown.enter.prevent="openFirstSearchResult"
            >
            <kbd class="rounded border border-[hsl(var(--site-border))] px-1.5 py-1 font-docs-mono text-[10px] text-[hsl(var(--site-text-muted))]">ESC</kbd>
          </div>
          <div class="max-h-[52vh] overflow-y-auto p-2">
            <NuxtLink
              v-for="result in searchResults"
              :key="result.path"
              :to="result.path"
              class="group flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-[hsl(var(--site-surface))]"
              @click="closeSearch"
            >
              <span>
                <span class="block text-sm font-semibold">{{ result.title }}</span>
                <span class="mt-0.5 block font-docs-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--site-text-muted))]">{{ result.section }}</span>
              </span>
              <Icon name="lucide:arrow-up-right" class="h-4 w-4 text-[hsl(var(--site-text-muted))] opacity-0 transition-opacity group-hover:opacity-100" />
            </NuxtLink>
            <div v-if="searchResults.length === 0" class="px-4 py-12 text-center text-sm text-[hsl(var(--site-text-muted))]">
              No documentation matched “{{ searchQuery }}”.
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))]/50 px-4 py-2 font-docs-mono text-[10px] text-[hsl(var(--site-text-muted))]">
            <span>{{ searchResults.length }} results</span>
            <span>Type to filter · Enter to open</span>
          </div>
        </div>
      </div>
    </Teleport>

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
        <span class="font-docs-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--site-text-muted))]">Documentation</span>
        <button class="text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]" aria-label="Close documentation navigation" @click="mobileSidebarOpen = false">
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
              'mb-2 block font-docs-mono text-xs uppercase tracking-[0.16em] transition-colors',
              isActive(section.path) ? 'text-[hsl(var(--site-accent))]' : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
            ]"
          >
            {{ section.title }}
          </NuxtLink>
          <h4 v-else class="mb-2 font-docs-mono text-xs uppercase tracking-[0.16em] text-[hsl(var(--site-text-muted))]">
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
        <aside class="hidden w-72 shrink-0 border-r border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))]/20 lg:block">
          <div class="custom-logs-scrollbar sticky top-[3.625rem] h-[calc(100vh-3.625rem)] overflow-y-auto py-8 pr-5 pl-6">
            <nav>
              <DocsNavItems v-if="topLevelItems.length" :items="topLevelItems" class="mb-6" />
              <div v-for="section in docsNavigation" :key="section.title" class="mb-6">
                <NuxtLink
                  v-if="section.path"
                  :to="section.path"
                  :class="[
                    'mb-2 block font-docs-mono text-[10px] font-medium uppercase tracking-[0.18em] transition-colors',
                    isActive(section.path) ? 'text-[hsl(var(--site-accent))]' : 'text-[hsl(var(--site-text-muted))] hover:text-[hsl(var(--site-text))]',
                  ]"
                >
                  {{ section.title }}
                </NuxtLink>
                <h4 v-else class="mb-2 font-docs-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--site-text-muted))]">
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
              <h4 class="mb-4 flex items-center gap-2 font-docs-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--site-text-muted))]">
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

<script setup lang="ts">
const route = useRoute()
const { isAuthenticated } = useAuth()
const colorMode = useColorMode()

const mobileMenuOpen = ref(false)
const mobileSidebarOpen = ref(false)

const navLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs/overview', label: 'Docs' },
  { href: '/integrations', label: 'Integrations' },
]

const docsNavigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview', path: '/docs/overview' },
      { title: 'Servers', path: '/docs/servers' },
    ],
  },
]

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.preference === 'dark')

const isActive = (path: string) => route.path === path

// Receive TOC from page
const docsToc = inject<ComputedRef<Array<{ id: string; text: string }>>>('docsToc', computed(() => []))
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-6">
        <div class="flex items-center gap-6">
          <!-- Mobile sidebar toggle -->
          <button
            class="flex h-9 w-9 items-center justify-center rounded-md border lg:hidden"
            @click="mobileSidebarOpen = !mobileSidebarOpen"
          >
            <Icon name="lucide:panel-left" class="h-5 w-5" />
          </button>

          <NuxtLink to="/" class="flex items-center gap-2">
            <span class="text-xl font-bold text-foreground">launchctl</span>
          </NuxtLink>

          <nav class="hidden items-center gap-1 lg:flex">
            <NuxtLink
              v-for="item in navLinks"
              :key="item.label"
              :to="item.href"
              :class="[
                'rounded-md px-3 py-2 text-sm transition-colors',
                route.path.startsWith(item.href)
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <!-- Search button placeholder -->
          <button class="hidden h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex">
            <Icon name="lucide:search" class="h-4 w-4" />
            <span>Search docs...</span>
            <kbd class="pointer-events-none ml-4 hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium sm:flex">
              <span>⌘</span>K
            </kbd>
          </button>

          <a
            href="https://github.com/gigcodes"
            target="_blank"
            class="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="lucide:github" class="h-5 w-5" />
          </a>

          <button
            class="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="lucide:sun" class="h-5 w-5" />
            <Icon v-else name="lucide:moon" class="h-5 w-5" />
          </button>

          <NuxtLink
            v-if="!isAuthenticated"
            to="/register"
            class="hidden h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 sm:inline-flex"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Mobile sidebar overlay -->
    <div
      v-if="mobileSidebarOpen"
      class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
      @click="mobileSidebarOpen = false"
    />

    <!-- Mobile sidebar -->
    <aside
      v-if="mobileSidebarOpen"
      class="fixed inset-y-0 left-0 z-50 w-72 border-r bg-background p-6 lg:hidden"
    >
      <div class="mb-4 flex items-center justify-between">
        <span class="font-semibold">Documentation</span>
        <button @click="mobileSidebarOpen = false">
          <Icon name="lucide:x" class="h-5 w-5" />
        </button>
      </div>
      <nav>
        <div v-for="section in docsNavigation" :key="section.title" class="mb-6">
          <h4 class="mb-2 text-sm font-semibold text-foreground">
            {{ section.title }}
          </h4>
          <ul class="space-y-1">
            <li v-for="item in section.items" :key="item.path">
              <NuxtLink
                :to="item.path"
                :class="[
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  isActive(item.path)
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ]"
                @click="mobileSidebarOpen = false"
              >
                {{ item.title }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>
    </aside>

    <!-- Main layout -->
    <div class="mx-auto max-w-screen-2xl">
      <div class="flex">
        <!-- Desktop sidebar -->
        <aside class="hidden w-64 shrink-0 border-r lg:block">
          <div class="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 pr-4 pl-6">
            <nav>
              <div v-for="section in docsNavigation" :key="section.title" class="mb-6">
                <h4 class="mb-2 text-sm font-semibold text-foreground">
                  {{ section.title }}
                </h4>
                <ul class="space-y-1">
                  <li v-for="item in section.items" :key="item.path">
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
                  </li>
                </ul>
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
          <div class="sticky top-20 py-8 pl-4 pr-6">
            <div v-if="docsToc && docsToc.length > 0">
              <h4 class="mb-4 text-sm font-medium text-foreground">On this page</h4>
              <nav class="space-y-2 text-sm">
                <a
                  v-for="link in docsToc"
                  :key="link.id"
                  :href="`#${link.id}`"
                  class="block text-muted-foreground transition-colors hover:text-foreground"
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

<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.preference === 'dark')

const navigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview', path: '/docs/overview', icon: 'lucide:book-open' },
      { title: 'Servers', path: '/docs/servers', icon: 'lucide:server' },
    ],
  },
]

const isActive = (path: string) => route.path === path
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-6">
          <NuxtLink to="/" class="text-xl font-bold text-foreground">
            launchctl
          </NuxtLink>
          <div class="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <span>/</span>
            <span>Documentation</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="toggleTheme"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Icon v-if="isDark" name="lucide:sun" class="h-4 w-4" />
            <Icon v-else name="lucide:moon" class="h-4 w-4" />
          </button>
          <NuxtLink
            to="/register"
            class="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex gap-10 py-10 lg:gap-12">
        <!-- Sidebar -->
        <aside class="hidden w-56 shrink-0 lg:block">
          <nav class="sticky top-24">
            <div v-for="section in navigation" :key="section.title" class="mb-6">
              <h4 class="mb-3 px-3 text-sm font-semibold text-foreground">
                {{ section.title }}
              </h4>
              <ul class="space-y-1">
                <li v-for="item in section.items" :key="item.path">
                  <NuxtLink
                    :to="item.path"
                    :class="[
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive(item.path)
                        ? 'bg-muted font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    ]"
                  >
                    <Icon :name="item.icon" class="h-4 w-4" />
                    {{ item.title }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        <!-- Main content -->
        <main class="min-w-0 flex-1">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

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
      { title: 'Overview', path: '/docs/overview' },
      { title: 'Servers', path: '/docs/servers' },
    ],
  },
]

const isActive = (path: string) => route.path === path
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-6">
          <NuxtLink to="/" class="text-xl font-bold text-foreground">
            launchctl
          </NuxtLink>
          <span class="hidden text-sm text-muted-foreground sm:inline">Documentation</span>
        </div>

        <div class="flex items-center gap-4">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="toggleTheme"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <Icon v-if="isDark" name="lucide:sun" class="h-4 w-4" />
            <Icon v-else name="lucide:moon" class="h-4 w-4" />
          </button>
          <NuxtLink
            to="/register"
            class="hidden rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 sm:inline-flex"
          >
            Get Started
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex gap-12 py-8">
        <!-- Sidebar -->
        <aside class="hidden w-64 shrink-0 lg:block">
          <nav class="sticky top-24 space-y-6">
            <div v-for="section in navigation" :key="section.title">
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
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    ]"
                  >
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

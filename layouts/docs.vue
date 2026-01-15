<script setup lang="ts">
const route = useRoute()
const { isAuthenticated } = useAuth()
const colorMode = useColorMode()

const scrolled = ref(false)
const mobileMenuOpen = ref(false)

const navLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/docs/overview', label: 'Docs' },
  { href: '/integrations', label: 'Integrations' },
]

const docsNavigation = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview', path: '/docs/overview', icon: 'lucide:book-open' },
      { title: 'Servers', path: '/docs/servers', icon: 'lucide:server' },
    ],
  },
]

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.preference === 'dark')

const isActive = (path: string) => route.path === path

onMounted(() => {
  const handleScroll = () => {
    scrolled.value = window.scrollY > 20
  }
  window.addEventListener('scroll', handleScroll)
  onUnmounted(() => window.removeEventListener('scroll', handleScroll))
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header - matching site header -->
    <header
      :class="[
        'fixed top-0 z-50 w-full border-b transition-all duration-300',
        scrolled
          ? 'border-border bg-background/90 backdrop-blur-xl'
          : 'border-transparent bg-background',
      ]"
    >
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav class="relative flex h-14 items-center justify-between">
          <div class="flex items-center gap-10">
            <NuxtLink to="/" class="text-xl font-bold text-foreground">
              launchctl
            </NuxtLink>

            <ul class="hidden items-center gap-1 lg:flex">
              <li v-for="item in navLinks" :key="item.label">
                <NuxtLink
                  :to="item.href"
                  :class="[
                    'relative rounded-md px-3 py-2 text-sm transition-colors',
                    route.path.startsWith(item.href)
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  ]"
                >
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div class="hidden items-center gap-3 lg:flex">
            <button
              class="flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="toggleTheme"
              :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <Icon v-if="isDark" name="lucide:sun" class="h-4 w-4" />
              <Icon v-else name="lucide:moon" class="h-4 w-4" />
            </button>
            <NuxtLink
              :to="isAuthenticated ? '/dashboard' : '/login'"
              class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {{ isAuthenticated ? 'Dashboard' : 'Sign in' }}
            </NuxtLink>
            <NuxtLink
              v-if="!isAuthenticated"
              to="/register"
              class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Get Started
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </NuxtLink>
          </div>

          <!-- Mobile menu button -->
          <button
            class="flex h-9 w-9 items-center justify-center rounded-md border bg-background lg:hidden"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <Icon v-if="!mobileMenuOpen" name="lucide:menu" class="h-5 w-5 text-foreground" />
            <Icon v-else name="lucide:x" class="h-5 w-5 text-foreground" />
          </button>
        </nav>

        <!-- Mobile menu -->
        <div
          v-if="mobileMenuOpen"
          class="absolute left-0 right-0 top-14 border-b bg-background p-4 lg:hidden"
        >
          <ul class="space-y-1">
            <li v-for="item in navLinks" :key="item.label">
              <NuxtLink
                :to="item.href"
                class="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                @click="mobileMenuOpen = false"
              >
                {{ item.label }}
              </NuxtLink>
            </li>
            <li class="border-t pt-2">
              <NuxtLink
                :to="isAuthenticated ? '/dashboard' : '/login'"
                class="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                @click="mobileMenuOpen = false"
              >
                {{ isAuthenticated ? 'Dashboard' : 'Sign in' }}
              </NuxtLink>
            </li>
            <li v-if="!isAuthenticated">
              <NuxtLink
                to="/register"
                class="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                @click="mobileMenuOpen = false"
              >
                Get Started
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </header>

    <!-- Main content area with sidebar -->
    <div class="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
      <div class="flex gap-10 py-10 lg:gap-12">
        <!-- Sidebar -->
        <aside class="hidden w-56 shrink-0 lg:block">
          <nav class="sticky top-24">
            <div v-for="section in docsNavigation" :key="section.title" class="mb-6">
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

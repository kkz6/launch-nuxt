<script setup lang="ts">
const { isAuthenticated } = useAuth()

const scrolled = ref(false)
const mobileMenuOpen = ref(false)

const navLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/support', label: 'Docs' },
  { href: '/integrations', label: 'Integrations' },
]

onMounted(() => {
  const handleScroll = () => {
    scrolled.value = window.scrollY > 20
  }
  window.addEventListener('scroll', handleScroll)
  onUnmounted(() => window.removeEventListener('scroll', handleScroll))
})
</script>

<template>
  <header
    :class="[
      'fixed top-0 z-50 w-full border-b transition-all duration-300',
      scrolled
        ? 'border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))]/90 backdrop-blur-xl'
        : 'border-transparent',
    ]"
  >
    <div class="site-container">
      <nav class="relative flex h-12 items-center justify-between px-4">
        <div class="flex items-center gap-10">
          <NuxtLink to="/" class="group relative text-[hsl(var(--site-text))]">
            <img src="/images/logo.svg" alt="Launch" width="75" class="relative" />
          </NuxtLink>

          <ul class="hidden items-center gap-0.5 lg:flex">
            <li v-for="item in navLinks" :key="item.label">
              <NuxtLink
                :to="item.href"
                class="group relative px-3 py-1.5 font-mono text-sm text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
              >
                <span class="relative z-10">{{ item.label }}</span>
                <span
                  class="absolute inset-0 rounded bg-[hsl(var(--site-text))]/5 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="hidden items-center gap-3 lg:flex">
          <NuxtLink :to="isAuthenticated ? '/dashboard' : '/login'" class="btn-sm btn-site-ghost">
            {{ isAuthenticated ? 'Dashboard' : 'Sign in' }}
          </NuxtLink>
          <NuxtLink v-if="!isAuthenticated" to="/register" class="btn-sm btn-site-primary">
            Get Started
            <svg class="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                :stroke-width="2"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </NuxtLink>
        </div>

        <!-- Mobile menu button -->
        <button
          class="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--site-text))]/5 lg:hidden"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg
            v-if="!mobileMenuOpen"
            class="h-5 w-5 text-[hsl(var(--site-text))]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="h-5 w-5 text-[hsl(var(--site-text))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </nav>

      <!-- Mobile menu -->
      <div
        v-if="mobileMenuOpen"
        class="absolute left-0 right-0 top-12 border-b border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))] p-4 lg:hidden"
      >
        <ul class="space-y-2">
          <li v-for="item in navLinks" :key="item.label">
            <NuxtLink
              :to="item.href"
              class="block rounded-md px-3 py-2 font-mono text-sm text-[hsl(var(--site-text-muted))] hover:bg-[hsl(var(--site-text))]/5 hover:text-[hsl(var(--site-text))]"
              @click="mobileMenuOpen = false"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
          <li class="border-t border-[hsl(var(--site-border))] pt-2">
            <NuxtLink
              :to="isAuthenticated ? '/dashboard' : '/login'"
              class="block rounded-md px-3 py-2 font-mono text-sm text-[hsl(var(--site-text-muted))] hover:bg-[hsl(var(--site-text))]/5 hover:text-[hsl(var(--site-text))]"
              @click="mobileMenuOpen = false"
            >
              {{ isAuthenticated ? 'Dashboard' : 'Sign in' }}
            </NuxtLink>
          </li>
          <li v-if="!isAuthenticated">
            <NuxtLink
              to="/register"
              class="btn-site-primary block w-full justify-center text-center"
              @click="mobileMenuOpen = false"
            >
              Get Started
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const { isAuthenticated } = useAuth()
const colorMode = useColorMode()

const scrolled = ref(false)
const mobileMenuOpen = ref(false)

const navLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/support', label: 'Docs' },
  { href: '/integrations', label: 'Integrations' },
]

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

const isDark = computed(() => colorMode.preference === 'dark')

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
            <svg width="75" class="relative" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324.75 149.999998" preserveAspectRatio="xMidYMid meet">
              <g fill="currentColor">
                <g transform="translate(6.677201, 105.361852)"><path d="M 1.53125 0 L 11.953125 -62.796875 L 25.234375 -62.796875 L 16.65625 -10.953125 L 43.578125 -10.953125 L 41.734375 0 Z M 1.53125 0"></path></g>
              </g>
              <g fill="currentColor">
                <g transform="translate(55.673128, 105.361852)"><path d="M 14.59375 0.890625 C 10.113281 0.890625 6.585938 -0.285156 4.015625 -2.640625 C 1.441406 -5.003906 0.53125 -8.507812 1.28125 -13.15625 C 1.875 -16.644531 3.160156 -19.390625 5.140625 -21.390625 C 7.128906 -23.398438 9.550781 -24.875 12.40625 -25.8125 C 15.257812 -26.757812 18.257812 -27.375 21.40625 -27.65625 C 25.53125 -28.0625 28.515625 -28.492188 30.359375 -28.953125 C 32.210938 -29.421875 33.273438 -30.398438 33.546875 -31.890625 L 33.546875 -32.078125 C 33.847656 -34.015625 33.492188 -35.515625 32.484375 -36.578125 C 31.472656 -37.640625 29.863281 -38.171875 27.65625 -38.171875 C 25.320312 -38.171875 23.347656 -37.660156 21.734375 -36.640625 C 20.117188 -35.617188 18.957031 -34.320312 18.25 -32.75 L 6.34375 -33.734375 C 7.9375 -38.023438 10.734375 -41.425781 14.734375 -43.9375 C 18.734375 -46.445312 23.5625 -47.703125 29.21875 -47.703125 C 32.695312 -47.703125 35.859375 -47.148438 38.703125 -46.046875 C 41.554688 -44.941406 43.726562 -43.21875 45.21875 -40.875 C 46.71875 -38.539062 47.160156 -35.503906 46.546875 -31.765625 L 41.234375 0 L 28.859375 0 L 29.953125 -6.53125 L 29.59375 -6.53125 C 28.09375 -4.34375 26.085938 -2.554688 23.578125 -1.171875 C 21.066406 0.203125 18.070312 0.890625 14.59375 0.890625 Z M 19.84375 -8.125 C 22.695312 -8.125 25.175781 -8.957031 27.28125 -10.625 C 29.394531 -12.289062 30.664062 -14.359375 31.09375 -16.828125 L 31.890625 -21.828125 C 31.335938 -21.484375 30.5 -21.179688 29.375 -20.921875 C 28.25 -20.671875 27.066406 -20.445312 25.828125 -20.25 C 24.597656 -20.050781 23.5 -19.875 22.53125 -19.71875 C 20.1875 -19.382812 18.21875 -18.738281 16.625 -17.78125 C 15.039062 -16.820312 14.109375 -15.421875 13.828125 -13.578125 C 13.566406 -11.804688 13.988281 -10.453125 15.09375 -9.515625 C 16.207031 -8.585938 17.789062 -8.125 19.84375 -8.125 Z M 19.84375 -8.125"></path></g>
              </g>
              <g fill="currentColor">
                <g transform="translate(105.772848, 105.361852)"><path d="M 34.828125 -20.046875 L 39.34375 -47.09375 L 52.40625 -47.09375 L 44.546875 0 L 32.015625 0 L 33.421875 -8.546875 L 32.9375 -8.546875 C 31.476562 -5.796875 29.359375 -3.582031 26.578125 -1.90625 C 23.796875 -0.226562 20.640625 0.609375 17.109375 0.609375 C 12.367188 0.609375 8.796875 -0.96875 6.390625 -4.125 C 3.992188 -7.28125 3.234375 -11.609375 4.109375 -17.109375 L 9.140625 -47.09375 L 22.203125 -47.09375 L 17.59375 -19.4375 C 17.144531 -16.65625 17.53125 -14.457031 18.75 -12.84375 C 19.96875 -11.226562 21.8125 -10.421875 24.28125 -10.421875 C 26.632812 -10.421875 28.851562 -11.238281 30.9375 -12.875 C 33.019531 -14.507812 34.316406 -16.898438 34.828125 -20.046875 Z M 34.828125 -20.046875"></path></g>
              </g>
              <g fill="currentColor">
                <g transform="translate(159.459877, 105.361852)"><path d="M 18.953125 -27.234375 L 14.40625 0 L 1.375 0 L 9.234375 -47.09375 L 21.640625 -47.09375 L 20.296875 -38.78125 L 20.8125 -38.78125 C 22.3125 -41.539062 24.421875 -43.71875 27.140625 -45.3125 C 29.859375 -46.90625 32.972656 -47.703125 36.484375 -47.703125 C 41.367188 -47.703125 45.035156 -46.125 47.484375 -42.96875 C 49.941406 -39.8125 50.710938 -35.484375 49.796875 -29.984375 L 44.765625 0 L 31.703125 0 L 36.328125 -27.65625 C 36.804688 -30.539062 36.445312 -32.796875 35.25 -34.421875 C 34.050781 -36.046875 32.132812 -36.859375 29.5 -36.859375 C 26.84375 -36.859375 24.550781 -36.015625 22.625 -34.328125 C 20.707031 -32.640625 19.484375 -30.273438 18.953125 -27.234375 Z M 18.953125 -27.234375"></path></g>
              </g>
              <g fill="currentColor">
                <g transform="translate(213.146906, 105.361852)"><path d="M 22.4375 0.921875 C 17.613281 0.921875 13.640625 -0.101562 10.515625 -2.15625 C 7.390625 -4.21875 5.207031 -7.078125 3.96875 -10.734375 C 2.726562 -14.390625 2.507812 -18.597656 3.3125 -23.359375 C 4.09375 -28.179688 5.722656 -32.414062 8.203125 -36.0625 C 10.679688 -39.71875 13.820312 -42.570312 17.625 -44.625 C 21.425781 -46.675781 25.710938 -47.703125 30.484375 -47.703125 C 36.628906 -47.703125 41.332031 -46.054688 44.59375 -42.765625 C 47.851562 -39.484375 49.15625 -35.125 48.5 -29.6875 L 36.21875 -29.6875 C 36.25 -32.007812 35.644531 -33.894531 34.40625 -35.34375 C 33.175781 -36.800781 31.375 -37.53125 29 -37.53125 C 25.9375 -37.53125 23.28125 -36.3125 21.03125 -33.875 C 18.78125 -31.445312 17.300781 -28.003906 16.59375 -23.546875 C 15.832031 -19.046875 16.160156 -15.5625 17.578125 -13.09375 C 19.003906 -10.632812 21.238281 -9.40625 24.28125 -9.40625 C 26.550781 -9.40625 28.566406 -10.085938 30.328125 -11.453125 C 32.085938 -12.828125 33.375 -14.765625 34.1875 -17.265625 L 46.515625 -17.265625 C 45.691406 -13.660156 44.175781 -10.488281 41.96875 -7.75 C 39.769531 -5.019531 37.015625 -2.890625 33.703125 -1.359375 C 30.390625 0.160156 26.632812 0.921875 22.4375 0.921875 Z M 22.4375 0.921875"></path></g>
              </g>
              <g fill="currentColor">
                <g transform="translate(263.85983, 105.361852)"><path d="M 18.953125 -27.234375 L 14.40625 0 L 1.375 0 L 11.8125 -62.796875 L 24.46875 -62.796875 L 20.546875 -38.78125 L 21.0625 -38.78125 C 22.570312 -41.5625 24.648438 -43.742188 27.296875 -45.328125 C 29.953125 -46.910156 33.066406 -47.703125 36.640625 -47.703125 C 41.523438 -47.703125 45.195312 -46.128906 47.65625 -42.984375 C 50.125 -39.835938 50.898438 -35.503906 49.984375 -29.984375 L 44.953125 0 L 31.921875 0 L 36.515625 -27.65625 C 36.984375 -30.5625 36.609375 -32.820312 35.390625 -34.4375 C 34.179688 -36.050781 32.257812 -36.859375 29.625 -36.859375 C 26.96875 -36.859375 24.648438 -36.015625 22.671875 -34.328125 C 20.703125 -32.640625 19.460938 -30.273438 18.953125 -27.234375 Z M 18.953125 -27.234375"></path></g>
              </g>
            </svg>
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
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] text-[hsl(var(--site-text-muted))] transition-colors hover:bg-[hsl(var(--site-surface-elevated))] hover:text-[hsl(var(--site-text))] focus:outline-none"
            @click="toggleTheme"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg
              v-if="isDark"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                :stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                :stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          </button>
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

<script setup lang="ts">
import { Toaster } from '~/components/ui/sonner'
import { Separator } from '~/components/ui/separator'

const route = useRoute()

const sidebarNavItems = [
  {
    title: 'Profile',
    href: '/settings/profile',
    icon: 'lucide:user',
  },
  {
    title: 'Account',
    href: '/settings/account',
    icon: 'lucide:settings',
  },
  {
    title: 'Security',
    href: '/settings/security',
    icon: 'lucide:shield',
  },
  {
    title: 'Teams',
    href: '/settings/teams',
    icon: 'lucide:users',
  },
  {
    title: 'API Tokens',
    href: '/settings/api-tokens',
    icon: 'lucide:key',
  },
]

const isActive = (href: string) => {
  return route.path === href
}
</script>

<template>
  <div
    id="app-container"
    class="bg-radial relative flex min-h-screen w-full flex-col bg-background"
  >
    <LayoutNavbar />
    <main class="flex w-full flex-col items-center pt-6">
      <div class="w-full max-w-8xl space-y-6 px-4 pb-16 lg:px-8">
        <div class="space-y-0.5">
          <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
          <p class="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        <Separator class="my-6" />
        <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside class="-mx-4 lg:w-1/5">
            <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
              <NuxtLink
                v-for="item in sidebarNavItems"
                :key="item.href"
                :to="item.href"
                :class="[
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-muted hover:bg-muted'
                    : 'hover:bg-transparent hover:underline',
                ]"
              >
                <Icon :name="item.icon" class="h-4 w-4" />
                {{ item.title }}
              </NuxtLink>
            </nav>
          </aside>
          <div class="flex-1 lg:max-w-2xl">
            <slot />
          </div>
        </div>
      </div>
    </main>
    <Toaster rich-colors />
  </div>
</template>

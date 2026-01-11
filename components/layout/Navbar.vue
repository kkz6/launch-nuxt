<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'

const { user, logout } = useAuth()

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Servers', href: '/servers' },
  { name: 'Sites', href: '/sites' },
]

const userInitials = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const handleLogout = async () => {
  await logout()
}
</script>

<template>
  <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 lg:px-8">
      <div class="flex items-center gap-6">
        <NuxtLink to="/dashboard" class="flex items-center gap-2">
          <span class="text-xl font-bold">Launch</span>
        </NuxtLink>
        <nav class="hidden items-center gap-4 md:flex">
          <NuxtLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.href"
            class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ item.name }}
          </NuxtLink>
        </nav>
      </div>

      <div class="flex items-center gap-4">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="relative h-8 w-8 rounded-full">
              <Avatar class="h-8 w-8">
                <AvatarImage :src="user?.profile_photo_url || ''" :alt="user?.name || ''" />
                <AvatarFallback>{{ userInitials }}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-56" align="end" force-mount>
            <DropdownMenuLabel class="font-normal">
              <div class="flex flex-col space-y-1">
                <p class="text-sm font-medium leading-none">{{ user?.name }}</p>
                <p class="text-xs leading-none text-muted-foreground">{{ user?.email }}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem as-child>
              <NuxtLink to="/settings/profile">Profile</NuxtLink>
            </DropdownMenuItem>
            <DropdownMenuItem as-child>
              <NuxtLink to="/settings">Settings</NuxtLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="handleLogout">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>

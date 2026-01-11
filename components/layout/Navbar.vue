<script setup lang="ts">
import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Rocket,
  Settings,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

const { user, logout } = useAuth();

const isOpen = ref(false);

const userInitials = computed(() => {
  if (!user.value?.name) return "U";
  return user.value.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

const handleLogout = async () => {
  isOpen.value = false;
  await logout();
};

const navigateTo = (path: string) => {
  isOpen.value = false;
  useRouter().push(path);
};
</script>

<template>
  <nav
    class="sticky top-0 z-40 w-full border-b border-divider bg-background/70 backdrop-blur-lg"
  >
    <div
      class="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 sm:px-6"
    >
      <NuxtLink to="/servers" class="flex items-center gap-2">
        <span class="text-xl font-bold">Launch</span>
      </NuxtLink>

      <div class="flex items-center space-x-2">
        <ModeToggle />
        <ClientOnly>
          <DropdownMenu v-model:open="isOpen">
            <DropdownMenuTrigger as-child>
              <div
                class="flex h-9 cursor-pointer items-center gap-0.5 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-1 shadow-sm transition-all duration-150 hover:bg-accent/10 hover:shadow-md sm:pr-1.5"
              >
                <Avatar class="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-xs font-medium sm:text-sm">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>

                <span
                  class="ml-0.5 mr-2 hidden max-w-[150px] truncate text-sm font-medium sm:inline"
                >
                  {{ user?.name }}
                </span>

                <ChevronsUpDown class="h-4 w-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-[280px] sm:w-64">
              <DropdownMenuLabel
                class="flex items-center gap-2 px-2 py-3 sm:py-2"
              >
                <Avatar class="h-10 w-10 sm:hidden">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-sm font-medium">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">{{ user?.name }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    user?.email
                  }}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  v-if="user?.onboarded"
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="navigateTo('/onboarding')"
                >
                  <Rocket class="h-4 w-4 text-muted-foreground" />
                  <span>Onboarding</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="navigateTo('/settings/profile')"
                >
                  <Settings class="h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="navigateTo('/settings/billing')"
                >
                  <CreditCard class="h-4 w-4 text-muted-foreground" />
                  <span>Billing</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="cursor-pointer gap-2 px-2 py-2.5 text-destructive focus:text-destructive sm:py-2"
                @click="handleLogout"
              >
                <LogOut class="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div
              class="flex h-9 animate-pulse items-center gap-0.5 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-1 shadow-sm sm:pr-1.5"
            >
              <div class="h-8 w-8 rounded-full bg-muted" />
              <div class="ml-0.5 mr-2 hidden h-4 w-16 rounded bg-muted sm:block" />
              <div class="h-4 w-4 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>
  </nav>
</template>

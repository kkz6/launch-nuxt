<script setup lang="ts">
import {
  User2,
  Users,
  KeyRound,
  GitBranch,
  Bell,
  Globe,
  Server,
  Archive,
  Database,
  CreditCard,
} from "lucide-vue-next";
import { Toaster } from "~/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const route = useRoute();
const router = useRouter();
const activeTab = ref("settings");

const mainTabs = [
  { value: "servers", label: "Servers", route: "/servers" },
  { value: "domains", label: "Domains", route: "/dns" },
  { value: "settings", label: "Settings", route: "/settings" },
];

const handleTabChange = (value: string | number) => {
  const tab = mainTabs.find((t) => t.value === String(value));
  if (tab && tab.route !== "/settings") {
    router.push(tab.route);
  }
};

const sidebarNavItems = [
  {
    title: "Profile",
    href: "/settings/profile",
    icon: User2,
  },
  {
    title: "Teams",
    href: "/settings/teams",
    icon: Users,
  },
  {
    title: "SSH Keys",
    href: "/settings/ssh-keys",
    icon: KeyRound,
  },
  {
    title: "Source Control",
    href: "/settings/source-control",
    icon: GitBranch,
  },
  {
    title: "Notifications",
    href: "/settings/notifications",
    icon: Bell,
  },
  {
    title: "DNS Providers",
    href: "/settings/dns-providers",
    icon: Globe,
  },
  {
    title: "Server Providers",
    href: "/settings/server-providers",
    icon: Server,
  },
  {
    title: "Archived Servers",
    href: "/settings/archived-servers",
    icon: Archive,
  },
  {
    title: "Storage Providers",
    href: "/settings/storage-providers",
    icon: Database,
  },
  {
    title: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
  },
];

const isActive = (href: string) => {
  if (href === "/settings/profile" && route.path === "/settings") {
    return true;
  }
  return route.path.startsWith(href);
};
</script>

<template>
  <div
    id="app-container"
    class="relative flex min-h-screen w-full flex-col bg-background"
  >
    <LayoutNavbar />
    <main class="flex w-full flex-1 flex-col items-center pb-10 pt-6">
      <div class="w-full max-w-8xl px-4 lg:px-8">
        <!-- Header -->
        <header
          class="mb-6 flex w-full flex-wrap items-center justify-between gap-2"
        >
          <div class="flex flex-col gap-2">
            <h1 class="text-xl font-bold lg:text-3xl">Settings</h1>
            <p class="text-muted-foreground lg:text-medium">
              Manage your account settings
            </p>
          </div>
        </header>

        <!-- Main Tabs -->
        <div class="flex w-full justify-between gap-8">
          <Tabs
            v-model="activeTab"
            class="w-full"
            @update:model-value="handleTabChange"
          >
            <div class="border-b border-border">
              <TabsList class="h-auto gap-0 bg-transparent p-0">
                <TabsTrigger
                  v-for="tab in mainTabs"
                  :key="tab.value"
                  :value="tab.value"
                  class="relative -mb-px rounded-none border-b border-transparent px-4 pb-3 pt-2 text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {{ tab.label }}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="settings" class="w-full">
              <!-- Settings Content with Sidebar -->
              <div
                class="my-8 flex w-full flex-wrap gap-4 md:flex-nowrap"
              >
                <!-- Sidebar Navigation -->
                <div class="w-full md:max-w-[18rem]">
                  <div class="flex flex-col gap-4 py-2">
                    <nav class="grid gap-1 px-2">
                      <NuxtLink
                        v-for="item in sidebarNavItems"
                        :key="item.href"
                        :to="item.href"
                        :class="[
                          'inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          isActive(item.href)
                            ? 'bg-muted dark:bg-muted dark:text-white'
                            : '',
                          'justify-start',
                        ]"
                      >
                        <component :is="item.icon" class="h-4 w-4" />
                        {{ item.title }}
                      </NuxtLink>
                    </nav>
                  </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1">
                  <slot />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
    <Toaster rich-colors />
  </div>
</template>

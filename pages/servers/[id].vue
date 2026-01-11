<script setup lang="ts">
import { ChevronLeft, ChevronRight, Terminal } from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { Server, Site } from "~/types";
import { serverService } from "~/services/serverService";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);

const server = ref<Server | null>(null);
const sites = ref<Site[]>([]);
const isLoading = ref(true);
const isTerminalOpen = ref(false);

// Valid tab values
const validTabs = ["sites", "databases", "networks", "logs", "daemons", "schedulers", "advanced"];

// Get initial tab from query params or default to "sites"
const getInitialTab = () => {
  const tabFromQuery = route.query.tab as string;
  return validTabs.includes(tabFromQuery) ? tabFromQuery : "sites";
};

const activeTab = ref(getInitialTab());

// Sync tab changes to URL query params
watch(activeTab, (newTab) => {
  router.replace({
    query: { ...route.query, tab: newTab },
  });
});

// Scroll state for tabs
const scrollRef = ref<HTMLDivElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

const tabs = [
  { value: "sites", label: "Sites", icon: "lucide:globe" },
  { value: "databases", label: "Databases", icon: "lucide:database" },
  { value: "networks", label: "Networks", icon: "lucide:network" },
  { value: "logs", label: "Logs", icon: "lucide:scroll-text" },
  { value: "daemons", label: "Daemons", icon: "lucide:activity" },
  { value: "schedulers", label: "Schedulers", icon: "lucide:clock" },
  { value: "advanced", label: "Advanced", icon: "lucide:terminal" },
];

const serviceProviders: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: "Custom Server",
};

const checkScroll = () => {
  const el = scrollRef.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 0;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth;
};

const scrollBy = (amount: number) => {
  scrollRef.value?.scrollBy({ left: amount, behavior: "smooth" });
};

onMounted(async () => {
  try {
    const [serverData, sitesData] = await Promise.all([
      serverService.get(serverId.value),
      serverService.sites.list(serverId.value),
    ]);
    server.value = serverData.data;
    sites.value = sitesData.data;
    useHead({ title: server.value?.name || "Server" });

    // Initialize scroll check
    nextTick(() => {
      checkScroll();
      scrollRef.value?.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
    });
  } catch {
    navigateTo("/servers");
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  scrollRef.value?.removeEventListener("scroll", checkScroll);
  window.removeEventListener("resize", checkScroll);
});

const copyIp = () => {
  if (server.value?.public_ipv4) {
    navigator.clipboard.writeText(server.value.public_ipv4);
    toast.success("IP address copied to clipboard");
  }
};
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon
      name="lucide:loader-2"
      class="h-8 w-8 animate-spin text-muted-foreground"
    />
  </div>

  <div v-else-if="server" class="pb-10">
    <div class="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink as-child>
              <NuxtLink to="/servers">Servers</NuxtLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>{{ server.name }}</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header
        class="mb-6 flex w-full items-center justify-between gap-4 max-sm:flex-wrap"
      >
        <div class="flex w-fit flex-col justify-between gap-2">
          <div class="flex flex-row flex-wrap items-center gap-2 xl:gap-4">
            <h1 class="flex items-center gap-2 text-xl font-bold lg:text-3xl">
              {{ server.name }}
            </h1>
          </div>
          <div v-if="server.provider" class="flex h-fit w-fit flex-row gap-2">
            <Badge :variant="server.connected ? 'success' : 'destructive'">
              {{ server.connected ? "Connected" : "Disconnected" }}
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Badge
                    variant="outline"
                    class="cursor-pointer"
                    @click="copyIp"
                  >
                    {{ server.public_ipv4 }}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to copy IP address</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge>
              {{
                server.provider === "custom_server"
                  ? "Custom Server"
                  : serviceProviders[server.provider] || server.provider
              }}
            </Badge>
          </div>
        </div>
        <p
          v-if="server.description"
          class="max-w-6xl text-sm text-muted-foreground"
        >
          {{ server.description }}
        </p>
      </header>
    </div>

    <Tabs v-model="activeTab" class="w-full">
      <div class="flex w-full items-center gap-4">
        <!-- Tabs with scroll -->
        <div class="relative min-w-0 flex-1">
          <!-- Left scroll button -->
          <div class="absolute inset-y-0 left-0 z-10 flex items-center">
            <button
              v-if="canScrollLeft"
              class="mb-3 rounded-full bg-background p-1 shadow"
              aria-label="Scroll left"
              @click="scrollBy(-100)"
            >
              <ChevronLeft class="h-4 w-4" />
            </button>
          </div>

          <!-- Right scroll button -->
          <div class="absolute inset-y-0 right-0 z-10 flex items-center">
            <button
              v-if="canScrollRight"
              class="mb-3 rounded-full bg-background p-1 shadow"
              aria-label="Scroll right"
              @click="scrollBy(100)"
            >
              <ChevronRight class="h-4 w-4" />
            </button>
          </div>

          <div
            ref="scrollRef"
            class="scrollbar-none w-full overflow-x-auto whitespace-nowrap"
            :style="{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }"
          >
            <TabsList
              class="mb-3 flex h-auto min-w-max justify-start -space-x-px bg-background p-0"
            >
              <TabsTrigger
                v-for="tab in tabs"
                :key="tab.value"
                :value="tab.value"
                class="relative w-[120px] whitespace-nowrap rounded-none border border-border py-2 shadow-sm shadow-black/5 first:rounded-s last:rounded-e after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-muted data-[state=active]:after:bg-primary"
              >
                <Icon
                  :name="tab.icon"
                  class="-ms-0.5 me-1.5 h-4 w-4 shrink-0 opacity-60"
                />
                <span class="truncate">{{ tab.label }}</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <!-- Terminal Button -->
        <div v-if="server.connected" class="flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  class="relative mb-3"
                  variant="ghost"
                  size="icon"
                  @click="isTerminalOpen = true"
                >
                  <Terminal class="h-4 w-4" />
                  <span
                    v-if="isTerminalOpen"
                    class="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 animate-pulse rounded-full bg-green-500"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Open Terminal</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <TabsContent value="sites" class="pt-2.5">
        <ServerShowSites :sites="sites" :server="server" />
      </TabsContent>

      <TabsContent value="databases" class="pt-2.5">
        <ServerShowDatabases :server-id="server.id" />
      </TabsContent>

      <TabsContent value="networks" class="pt-2.5">
        <ServerShowNetworks :server-id="server.id" />
      </TabsContent>

      <TabsContent value="logs" class="pt-2.5">
        <ServerShowLogs :server-id="server.id" />
      </TabsContent>

      <TabsContent value="daemons" class="pt-2.5">
        <ServerShowDaemons :server-id="server.id" />
      </TabsContent>

      <TabsContent value="schedulers" class="pt-2.5">
        <ServerShowSchedulers :server-id="server.id" />
      </TabsContent>

      <TabsContent value="advanced" class="pt-2.5">
        <ServerAdvancedSettings :server="server" />
      </TabsContent>
    </Tabs>

    <!-- Server Terminal -->
    <ServerTerminalBottom
      v-if="server.connected"
      :server="server"
      :is-open="isTerminalOpen"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

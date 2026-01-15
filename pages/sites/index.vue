<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import type { Site } from "~/types";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({
  title: "Sites",
});

const sites = ref<Site[]>([]);
const isLoading = ref(true);

const getSiteTypeIcon = (type: string): string => {
  const t = type?.toLowerCase() || "";
  if (t.includes("laravel")) return "simple-icons:laravel";
  if (t.includes("wordpress")) return "simple-icons:wordpress";
  if (t.includes("nuxt")) return "simple-icons:nuxtdotjs";
  if (t.includes("next")) return "simple-icons:nextdotjs";
  if (t.includes("node")) return "simple-icons:nodedotjs";
  if (t.includes("python") || t.includes("django")) return "simple-icons:python";
  if (t.includes("ruby") || t.includes("rails")) return "simple-icons:ruby";
  return "simple-icons:php";
};

const getSiteTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    laravel: "Laravel",
    wordpress: "WordPress",
    generic: "Generic PHP",
    nuxt: "Nuxt",
    nextjs: "Next.js",
    nodejs: "Node.js",
    python: "Python",
    django: "Django",
    ruby: "Ruby",
    rails: "Ruby on Rails",
  };
  return types[type] || type;
};

const getStatusColor = (site: Site): string => {
  if (site.installation_failed_at || site.uninstallation_failed_at) {
    return "bg-red-500";
  }
  if (site.uninstallation_requested_at || !site.installed_at) {
    return "bg-yellow-500";
  }
  return "bg-green-500";
};

const getStatusLabel = (site: Site): { text: string; loading: boolean } => {
  if (site.installation_failed_at) {
    return { text: "Installation failed", loading: false };
  }
  if (site.uninstallation_failed_at) {
    return { text: "Uninstallation failed", loading: false };
  }
  if (site.uninstallation_requested_at) {
    return { text: "Uninstalling", loading: true };
  }
  if (site.installed_at) {
    return { text: "Installed", loading: false };
  }
  return { text: "Installing", loading: true };
};

const isAccessible = (site: Site) => {
  return Boolean(site.installed_at) && !site.uninstallation_requested_at;
};

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

onMounted(async () => {
  try {
    const response = await $api<{ data: Site[] }>("/sites");
    sites.value = response.data;
  } catch {
    // Handle error
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="sites.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:globe" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">No sites yet</p>
        <p class="text-sm text-muted-foreground">Get started by creating your first site</p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="site in sites"
        :key="site.id"
        :to="isAccessible(site) ? `/servers/${site.server_id}/sites/${site.id}` : '#'"
        class="group"
        :class="{ 'pointer-events-none': !isAccessible(site) }"
      >
        <div
          class="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          :class="{
            'opacity-60': !isAccessible(site),
          }"
        >
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon
                :name="getSiteTypeIcon(site.type)"
                class="h-5 w-5 text-muted-foreground"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold truncate">{{ site.address }}</h3>
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="getStatusColor(site)"
                />
              </div>
              <p class="text-sm text-muted-foreground truncate">
                {{ getSiteTypeLabel(site.type) }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between text-sm">
            <div class="flex items-center gap-1.5">
              <Icon
                v-if="getStatusLabel(site).loading"
                name="lucide:loader-2"
                class="h-3.5 w-3.5 animate-spin text-muted-foreground"
              />
              <span
                :class="[
                  getStatusLabel(site).loading ? 'text-muted-foreground' : '',
                  site.installation_failed_at || site.uninstallation_failed_at ? 'text-destructive' : ''
                ]"
              >
                {{ getStatusLabel(site).text }}
              </span>
            </div>
            <span class="text-muted-foreground">
              {{ formatDate(site.installed_at || site.created_at) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

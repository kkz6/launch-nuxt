<script setup lang="ts">
import { computed } from "vue";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

const route = useRoute();
const breadcrumbState = usePageBreadcrumbState();

// Only render the trail for the route it was declared on. Navigating elsewhere
// reactively drops it (no manual reset → no flicker).
const crumbs = computed<PageCrumb[]>(() =>
  breadcrumbState.value?.path === route.path
    ? breadcrumbState.value.crumbs
    : [],
);

// Admin gets a sub-tab row beneath the breadcrumb (moved out of the page so it
// no longer re-animates on every tab change).
const adminTabs = [
  { label: "Overview", to: "/admin/overview", icon: "lucide:bar-chart-3" },
  {
    label: "Users",
    to: "/admin",
    icon: "lucide:users",
    // Stays active on /admin and the /admin/users/:id detail pages.
    match: (p: string) => p === "/admin" || p.startsWith("/admin/users"),
  },
  { label: "Invitations", to: "/admin/invitations", icon: "lucide:mail" },
  { label: "Servers", to: "/admin/servers", icon: "lucide:server" },
  { label: "Failures", to: "/admin/failures", icon: "lucide:triangle-alert" },
];

const showAdminTabs = computed(() => route.path.startsWith("/admin"));

const isAdminTabActive = (tab: (typeof adminTabs)[number]): boolean =>
  tab.match ? tab.match(route.path) : route.path.startsWith(tab.to);

const hasHeader = computed(
  () => (crumbs.value?.length ?? 0) > 0 || showAdminTabs.value,
);
</script>

<template>
  <div
    v-if="hasHeader"
    class="shrink-0 border-b border-divider bg-background/60 px-4 lg:px-8"
  >
    <!-- Breadcrumb trail -->
    <Breadcrumb v-if="crumbs && crumbs.length" class="pt-3">
      <BreadcrumbList>
        <template v-for="(crumb, i) in crumbs" :key="i">
          <BreadcrumbItem>
            <BreadcrumbLink v-if="crumb.to && i < crumbs.length - 1" as-child>
              <NuxtLink :to="crumb.to">{{ crumb.label }}</NuxtLink>
            </BreadcrumbLink>
            <BreadcrumbPage v-else>{{ crumb.label }}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator v-if="i < crumbs.length - 1" />
        </template>
      </BreadcrumbList>
    </Breadcrumb>

    <!-- Admin section sub-tabs -->
    <nav v-if="showAdminTabs" class="-mb-px mt-3 flex gap-6">
      <NuxtLink
        v-for="tab in adminTabs"
        :key="tab.to"
        :to="tab.to"
        class="relative flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors"
        :class="
          isAdminTabActive(tab)
            ? 'border-foreground text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
      >
        <Icon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </NuxtLink>
    </nav>

    <!-- Spacing when only a breadcrumb (no tabs) is shown -->
    <div v-if="crumbs && crumbs.length && !showAdminTabs" class="pb-3" />
  </div>
</template>

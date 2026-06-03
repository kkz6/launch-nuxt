<script setup lang="ts">
const route = useRoute();

const tabs = [
  {
    label: "Overview",
    to: "/admin/overview",
    icon: "lucide:bar-chart-3",
    match: (p: string) => p.startsWith("/admin/overview"),
  },
  {
    label: "Users",
    to: "/admin",
    icon: "lucide:users",
    match: (p: string) => p === "/admin",
  },
  {
    label: "Servers",
    to: "/admin/servers",
    icon: "lucide:server",
    match: (p: string) => p.startsWith("/admin/servers"),
  },
  {
    label: "Failures",
    to: "/admin/failures",
    icon: "lucide:triangle-alert",
    match: (p: string) => p.startsWith("/admin/failures"),
  },
];

const isActive = (tab: (typeof tabs)[number]) => tab.match(route.path);
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-semibold">Admin Panel</h1>
      <p class="text-sm text-muted-foreground">
        Internal back-office — staff only.
      </p>
    </div>

    <div class="border-b">
      <nav class="-mb-px flex gap-6">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="relative flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors"
          :class="
            isActive(tab)
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          <Icon :name="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </div>
  </div>
</template>

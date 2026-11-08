<script setup lang="ts">
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const { t } = useI18n();

const groups = [
  {
    label: "adminShell.manage",
    items: [
      {
        key: "overview",
        to: "/admin/overview",
        icon: "lucide:layout-dashboard",
      },
      { key: "users", to: "/admin", icon: "lucide:users" },
      { key: "invitations", to: "/admin/invitations", icon: "lucide:mail" },
    ],
  },
  {
    label: "adminShell.monitor",
    items: [
      { key: "servers", to: "/admin/servers", icon: "lucide:server" },
      { key: "failures", to: "/admin/failures", icon: "lucide:triangle-alert" },
      {
        key: "observability",
        to: "/admin/observability",
        icon: "lucide:activity",
      },
    ],
  },
];

function isActive(to: string): boolean {
  const path = route.path.replace(/\/$/, "");
  return to === "/admin"
    ? path === "/admin" || path.startsWith("/admin/users/")
    : path === to || path.startsWith(`${to}/`);
}
</script>

<template>
  <nav :aria-label="t('adminShell.navigation')" class="space-y-7">
    <div v-for="group in groups" :key="group.label">
      <p
        class="mb-2.5 px-3 text-xs font-medium text-muted-foreground/80"
      >
        {{ t(group.label) }}
      </p>
      <ul class="space-y-0.5">
        <li v-for="item in group.items" :key="item.key">
          <NuxtLink
            :to="item.to"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            class="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
            :class="
              isActive(item.to)
                ? 'bg-primary/10 font-semibold text-primary'
                : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
            "
            @click="emit('navigate')"
          >
            <Icon
              :name="item.icon"
              class="h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {{ t(`admin.common.${item.key}`) }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

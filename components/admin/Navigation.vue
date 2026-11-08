<script setup lang="ts">
import TabStrip from "~/components/layout/TabStrip.vue";

defineProps<{ extendBorder?: boolean }>();

const route = useRoute();
const { t } = useI18n();
const items = [
  { value: "overview", to: "/admin/overview", icon: "lucide:layout-dashboard" },
  { value: "users", to: "/admin", icon: "lucide:users" },
  { value: "invitations", to: "/admin/invitations", icon: "lucide:mail" },
  { value: "servers", to: "/admin/servers", icon: "lucide:server" },
  { value: "failures", to: "/admin/failures", icon: "lucide:triangle-alert" },
  {
    value: "observability",
    to: "/admin/observability",
    icon: "lucide:activity",
  },
];
const tabs = computed(() =>
  items.map((item) => ({
    ...item,
    label: t(`admin.common.${item.value}`),
  })),
);
const activeKey = computed(() => {
  const path = route.path.replace(/\/$/, "");
  return (
    items.find((item) =>
      item.to === "/admin"
        ? path === "/admin" || path.startsWith("/admin/users/")
        : path === item.to || path.startsWith(`${item.to}/`),
    )?.value || ""
  );
});
</script>

<template>
  <TabStrip
    :extend-border="extendBorder"
    :tabs="tabs"
    :active-key="activeKey"
    :to-link="(tab) => tab.to"
    :aria-label="t('adminShell.navigation')"
  />
</template>

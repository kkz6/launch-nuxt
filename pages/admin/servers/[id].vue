<script setup lang="ts">
import { ref, watch } from "vue";
import ServerDetail from "~/components/admin/ServerDetail.vue";
import { Button } from "~/components/ui/button";
import type { AdminServerDetail } from "~/types";

definePageMeta({ layout: "default", middleware: ["auth", "staff"] });
const route = useRoute();
const { t, locale } = useI18n();
const name = ref("");
useHead({
  title: () =>
    t("admin.serverDetail.pageTitle", {
      name: name.value || t("admin.common.server"),
    }),
});
function applyBreadcrumb() {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.servers"), to: "/admin/servers" },
    { label: name.value || t("admin.common.server") },
  ]);
}
function loaded(server: AdminServerDetail) {
  name.value = server.name;
  applyBreadcrumb();
}
applyBreadcrumb();
watch(locale, applyBreadcrumb);
</script>

<template>
  <ServerDetail
    :key="route.params.id as string"
    :server-id="route.params.id as string"
    class="max-w-5xl"
    @loaded="loaded"
    @deleted="navigateTo('/admin/servers')"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="navigateTo('/admin/servers')">
        <Icon name="lucide:arrow-left" class="h-4 w-4" />
        {{ t("admin.serverDetail.backToServers") }}
      </Button>
    </template>
  </ServerDetail>
</template>

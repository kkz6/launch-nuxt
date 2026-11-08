<script setup lang="ts">
import type { AdminUserRow } from "~/types";
import DataTable from "~/components/data-table/DataTable.vue";
import { TeamsCell } from "~/components/data-table/columns";
import { Button } from "~/components/ui/button";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const { locale, t } = useI18n();
const table = ref<{ refresh: () => void } | null>(null);

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

useHead({
  title: () => t("admin.usersList.pageTitle"),
});

const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.users") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);

// The table is now pure data: actions (suspend/delete/spectate) live on the
// per-user detail page. Clicking a row opens it.
const openUser = (row: AdminUserRow): void => {
  navigateTo(`/admin/users/${row.id}`);
};
</script>

<template>
  <div class="space-y-7">
    <AdminPageHeader
      :title="t('admin.common.users')"
      :description="t('adminDirectory.users.description')"
    >
      <template #actions>
        <Button variant="ghost" size="sm" @click="table?.refresh()">
          <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
          {{ t("adminDirectory.refresh") }}
        </Button>
      </template>
    </AdminPageHeader>

    <section aria-labelledby="user-directory-title" class="space-y-4">
      <div class="sr-only">
        <h2 id="user-directory-title" class="font-semibold">
          {{ t("adminDirectory.users.directoryTitle") }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ t("adminDirectory.users.directoryDescription") }}
        </p>
      </div>
      <div class="admin-directory">
        <DataTable
          ref="table"
          borderless
          endpoint="/admin/users/table"
          :row-actions-filter="() => []"
          @row-click="openUser"
        >
          <template #cell-name="{ row }">
            <NuxtLink
              :to="`/admin/users/${row.id}`"
              class="group inline-flex items-center gap-2.5 rounded-sm font-medium outline-offset-4 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              @click.stop
            >
              <span
                aria-hidden="true"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >{{ initials(row.name || "") }}</span
              >
              <span class="group-hover:underline underline-offset-4">{{
                row.name
              }}</span>
              <Icon
                name="lucide:chevron-right"
                class="h-3.5 w-3.5 text-muted-foreground"
              />
            </NuxtLink>
          </template>
          <template #cell-teams="{ value }">
            <TeamsCell :value="value" />
          </template>
        </DataTable>
      </div>
    </section>
  </div>
</template>

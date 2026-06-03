<script setup lang="ts">
import { toast } from "vue-sonner";
import type { AdminUserRow } from "~/types";
import type { ActionDef } from "~/types/data-table";
import { useImpersonation } from "~/composables/useImpersonation";
import { useAuth } from "~/composables/useAuth";
import { Button } from "~/components/ui/button";
import DataTable from "~/components/data-table/DataTable.vue";
import { TeamsCell } from "~/components/data-table/columns";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Users",
});

const { user } = useAuth();
const isSuperAdmin = computed(() => user.value?.staff_role === "super_admin");

const { start } = useImpersonation();
const spectatingId = ref<string | number | null>(null);

// The backend gates suspend/unsuspend/delete at super_admin (403 otherwise).
// Hide them in the UI for non-super-admins so support staff only see the
// read-only flows (Spectate stays — it's a separate client action).
const filterServerActions = (actions: ActionDef[]): ActionDef[] =>
  isSuperAdmin.value ? actions : [];

const spectate = async (target: AdminUserRow) => {
  spectatingId.value = target.id;
  try {
    await start(target.id, "Staff support session");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to start spectate session");
    spectatingId.value = null;
  }
};
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <p class="text-sm text-muted-foreground">
      Browse users and spectate (read-only) as any user for support.
    </p>

    <DataTable
      endpoint="/admin/users/table"
      :row-actions-filter="filterServerActions"
    >
      <!-- Custom cell for the nested teams[] array. -->
      <template #cell-teams="{ value }">
        <TeamsCell :value="value" />
      </template>

      <!-- Client-only Spectate action, rendered alongside the server-driven
           suspend/unsuspend/delete actions. -->
      <template #row-actions="{ row }">
        <Button
          variant="outline"
          size="sm"
          :disabled="spectatingId === (row as AdminUserRow).id"
          @click="spectate(row as AdminUserRow)"
        >
          <Icon
            v-if="spectatingId === (row as AdminUserRow).id"
            name="lucide:loader-2"
            class="h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:eye" class="h-4 w-4" />
          Spectate
        </Button>
      </template>
    </DataTable>
  </div>
</template>

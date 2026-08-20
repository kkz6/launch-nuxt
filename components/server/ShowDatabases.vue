<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import type { Database, DatabaseUser } from "~/types";

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const databases = ref<Database[]>([]);
const databaseUsers = ref<DatabaseUser[]>([]);
const isLoading = ref(true);
const isSyncing = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Create a map of database IDs to names for the CreateDatabaseUser component
const databasesMap = computed(() => {
  const map: Record<string, string> = {};
  for (const db of databases.value) {
    map[db.id] = db.name;
  }
  return map;
});

// State for editing a database user
const editingUser = ref<DatabaseUser | null>(null);
const isEditDialogOpen = ref(false);

const editUser = (user: DatabaseUser) => {
  editingUser.value = user;
  isEditDialogOpen.value = true;
};

const onEditDialogClose = () => {
  isEditDialogOpen.value = false;
  editingUser.value = null;
};

const onUserUpdated = () => {
  onEditDialogClose();
  fetchData();
};

const fetchData = async () => {
  try {
    const [dbData, usersData] = await Promise.all([
      $api<{ data: Database[] }>(`/servers/${props.serverId}/databases`),
      $api<{ data: DatabaseUser[] }>(
        `/servers/${props.serverId}/database-users`,
      ),
    ]);
    databases.value = dbData.data;
    databaseUsers.value = usersData.data;
  } catch {
    toast.error(t("server.databases.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const syncDatabases = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.databases.syncTitle"),
    description: t("server.databases.syncDescription"),
    confirmText: t("server.databases.syncTitle"),
    cancelText: t("server.common.cancel"),
  });

  if (result.ok) {
    isSyncing.value = true;
    try {
      await $api(`/servers/${props.serverId}/databases/sync`, {
        method: "POST",
      });
      toast.success(t("server.databases.syncStarted"));
      await fetchData();
    } catch {
      toast.error(t("server.databases.syncFailed"));
    } finally {
      isSyncing.value = false;
    }
  }
};

// Trigger a manual run of the first backup configured for this
// database. Most servers have a single backup per database; if there
// are multiple, we pick the first enabled one. Mirrors the row action
// on the Advanced → Backups tab — same POST endpoint, same async
// task flow — so the user can kick off a backup without leaving the
// Databases tab where they're already focused.
const isRunningBackup = ref<string | null>(null);
const runDatabaseBackup = async (database: Database) => {
  if (!confirmationDialog.value) return;
  const backups = database.backups ?? [];
  if (backups.length === 0) return;
  // Prefer an enabled backup; fall back to the first one — a disabled
  // backup is still runnable from the UI (the scheduler just doesn't
  // fire it automatically).
  const target = backups.find((b) => b.enabled) ?? backups[0];

  // Confirmation dialog mirrors the Advanced → Backups tab's "Run
  // Backup" flow so the action behaves consistently no matter where
  // the user triggers it from.
  const result = await confirmationDialog.value.show({
    title: t("server.databases.runBackup"),
    description: t("server.databases.runBackupDescription", {
      name: database.name,
    }),
    confirmText: t("server.databases.runBackup"),
    cancelText: t("server.common.cancel"),
  });
  if (!result.ok) return;

  isRunningBackup.value = database.id;
  try {
    await $api(`/servers/${props.serverId}/backups/${target.id}/run`, {
      method: "POST",
    });
    toast.success(t("server.databases.backupStarted", { name: database.name }));
  } catch {
    toast.error(t("server.databases.backupFailed", { name: database.name }));
  } finally {
    isRunningBackup.value = null;
  }
};

const deleteDatabase = async (database: Database) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.databases.deleteTitle"),
    description: t("server.databases.deleteDescription", {
      name: database.name,
    }),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/databases/${database.id}`, {
        method: "DELETE",
      });
      databases.value = databases.value.filter((d) => d.id !== database.id);
      toast.success(t("server.databases.deleteSuccess"));
    } catch {
      toast.error(t("server.databases.deleteFailed"));
    }
  }
};

const deleteUser = async (user: DatabaseUser) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.databases.deleteUserTitle"),
    description: t("server.databases.deleteUserDescription", {
      name: user.name,
    }),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/database-users/${user.id}`, {
        method: "DELETE",
      });
      databaseUsers.value = databaseUsers.value.filter((u) => u.id !== user.id);
      toast.success(t("server.databases.deleteUserSuccess"));
    } catch {
      toast.error(t("server.databases.deleteUserFailed"));
    }
  }
};

const databaseColumns = computed(() => [
  { key: "name", label: t("server.databases.databaseName"), width: "30%" },
  { key: "status", label: t("server.databases.status"), width: "25%" },
  {
    key: "installed_at",
    label: t("server.databases.installedAt"),
    width: "25%",
    type: "relative-date" as const,
  },
]);

const userColumns = computed(() => [
  { key: "name", label: t("server.databases.username"), width: "30%" },
  { key: "status", label: t("server.databases.status"), width: "25%" },
  {
    key: "installed_at",
    label: t("server.databases.installedAt"),
    width: "25%",
    type: "relative-date" as const,
  },
]);

onMounted(fetchData);
</script>

<template>
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Edit Database User Dialog -->
    <ServerCreateDatabaseUser
      v-if="editingUser"
      :server-id="serverId"
      :databases="databasesMap"
      :user="editingUser"
      :open="isEditDialogOpen"
      @update:open="
        (val) => {
          if (!val) onEditDialogClose();
        }
      "
      @updated="onUserUpdated"
    />

    <!-- Databases Section -->
    <div>
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold">
            {{ t("server.databases.title") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("server.databases.description") }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="isSyncing"
            @click="syncDatabases"
          >
            <Icon
              name="lucide:refresh-cw"
              class="mr-2 h-4 w-4"
              :class="{ 'animate-spin': isSyncing }"
            />
            {{ t("server.databases.sync") }}
          </Button>
          <ServerCreateDatabase
            v-if="databases.length > 0"
            :server-id="serverId"
            @created="fetchData"
          />
        </div>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <SharedDataTable
          :data="databases"
          :columns="databaseColumns"
          :actions="[
            {
              label: t('server.databases.runBackup'),
              icon: 'lucide:play',
              onClick: runDatabaseBackup,
              show: (db: Database) => (db.backups?.length ?? 0) > 0,
            },
            {
              label: t('server.common.delete'),
              icon: 'lucide:trash-2',
              onClick: deleteDatabase,
              className: 'hover:text-white hover:bg-destructive/90',
            },
          ]"
          empty-icon="lucide:database"
          :empty-title="t('server.databases.empty')"
          :empty-description="t('server.databases.emptyDescription')"
        >
          <template #empty>
            <ServerCreateDatabase :server-id="serverId" @created="fetchData" />
          </template>

          <template #cell-name="{ value }">
            <span class="font-medium">{{ value }}</span>
          </template>

          <template #cell-status="{ row }">
            <SharedInstallationStatus v-bind="row" />
          </template>

          <template #cell-installed_at="{ value }">
            <SharedDateTooltip v-if="value" :date="String(value)" />
            <span v-else class="text-muted-foreground">-</span>
          </template>
        </SharedDataTable>
      </template>
    </div>

    <!-- Database Users Section -->
    <div>
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-semibold">
            {{ t("server.databases.usersTitle") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("server.databases.usersDescription") }}
          </p>
        </div>
        <ServerCreateDatabaseUser
          v-if="databaseUsers.length > 0"
          :server-id="serverId"
          :databases="databasesMap"
          @created="fetchData"
        />
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>

      <template v-else>
        <SharedDataTable
          :data="databaseUsers"
          :columns="userColumns"
          :actions="[
            {
              label: t('server.common.edit'),
              icon: 'lucide:pencil',
              onClick: editUser,
            },
            {
              label: t('server.common.delete'),
              icon: 'lucide:trash-2',
              onClick: deleteUser,
              className: 'hover:text-white hover:bg-destructive/90',
              show: (user: DatabaseUser) => user.name !== 'root',
            },
          ]"
          empty-icon="lucide:user"
          :empty-title="t('server.databases.usersEmpty')"
          :empty-description="t('server.databases.usersEmptyDescription')"
        >
          <template #empty>
            <ServerCreateDatabaseUser
              :server-id="serverId"
              :databases="databasesMap"
              @created="fetchData"
            />
          </template>

          <template #cell-name="{ value }">
            <span class="font-medium">{{ value }}</span>
          </template>

          <template #cell-status="{ row }">
            <SharedInstallationStatus v-bind="row" />
          </template>

          <template #cell-installed_at="{ value }">
            <SharedDateTooltip v-if="value" :date="String(value)" />
            <span v-else class="text-muted-foreground">-</span>
          </template>
        </SharedDataTable>
      </template>
    </div>
  </div>
</template>

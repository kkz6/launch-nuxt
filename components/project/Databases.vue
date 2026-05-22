<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerDatabase,
  type DockerDatabaseEngine,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();

const databases = ref<DockerDatabase[]>([]);
const isLoading = ref(true);
const createOpen = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchDatabases = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.databases.list(props.serverId, props.projectId);
    databases.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load databases");
  } finally {
    isLoading.value = false;
  }
};

const onCreated = (db: DockerDatabase) => {
  databases.value = [db, ...databases.value];
  createOpen.value = false;
};

const deleteDatabase = async (db: DockerDatabase) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Database",
    description: `Remove "${db.name}"? The container will be stopped and removed. Data on bind mounts (if any) is not deleted.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
    inputVerificationText: db.name,
    helpText: "Type the database name to confirm:",
  });
  if (!result.ok) return;
  try {
    await dockerService.databases.delete(props.serverId, props.projectId, db.id);
    databases.value = databases.value.filter((x) => x.id !== db.id);
    toast.success("Database deletion queued");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete database");
  }
};

const engineIcon = (engine: DockerDatabaseEngine): string => {
  switch (engine) {
    case "postgres":
      return "simple-icons:postgresql";
    case "mysql":
      return "simple-icons:mysql";
    case "mariadb":
      return "simple-icons:mariadb";
    case "redis":
      return "simple-icons:redis";
    case "mongo":
      return "simple-icons:mongodb";
    default:
      return "lucide:database";
  }
};

const statusColor = (status: string): string => {
  switch (status) {
    case "running":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "building":
    case "idle":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "stopped":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// Reflect lifecycle/status updates from the worker so the list is
// always fresh without a manual refresh.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const channel = computed(() => `team.${teamId.value}`);
useChannelEvents(
  channel,
  [
    "docker.database.created",
    "docker.database.starting",
    "docker.database.running",
    "docker.database.failed",
    "docker.database.lifecycle",
    "docker.database.lifecycle_done",
    "docker.database.deleted",
  ],
  () => fetchDatabases(true),
);

onMounted(fetchDatabases);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Databases</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Managed Postgres, MySQL, MariaDB, Redis, or Mongo containers
          with auto-generated credentials.
        </p>
      </div>
      <Button @click="createOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Database
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="databases.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:database" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No databases yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Spin up a database container in this project. Credentials are
        generated on create and reachable from sibling containers by
        the database's name on <code>launch-network</code>.
      </p>
      <Button class="mt-6" @click="createOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Database
      </Button>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="db in databases"
        :key="db.id"
        :to="`/servers/${props.serverId}/projects/${props.projectId}/databases/${db.id}`"
        class="group block rounded-lg border bg-card p-5 transition hover:border-primary"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <Icon :name="engineIcon(db.engine)" class="h-4 w-4 text-muted-foreground" />
              <h3 class="truncate text-lg font-semibold group-hover:text-primary">
                {{ db.name }}
              </h3>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ db.engine }} {{ db.engine_version }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="ml-2 shrink-0 opacity-0 transition group-hover:opacity-100"
            @click.prevent="deleteDatabase(db)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="statusColor(db.status)"
          >
            {{ db.status }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{
              db.external_port
                ? `Exposed on :${db.external_port}`
                : "Internal only"
            }}
          </span>
        </div>
      </NuxtLink>
    </div>

    <CreateDatabaseSheet
      v-model:open="createOpen"
      :server-id="props.serverId"
      :project-id="props.projectId"
      @created="onCreated"
    />
  </div>
</template>

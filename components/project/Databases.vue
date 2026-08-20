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
const { t } = useI18n();

const databases = ref<DockerDatabase[]>([]);
const isLoading = ref(true);

// Shared with the navbar "+ New Database" button — see
// components/layout/Navbar.vue.
const createOpen = useState<boolean>("dockerCreateDatabaseOpen", () => false);

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchDatabases = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.databases.list(
      props.serverId,
      props.projectId,
    );
    databases.value = res.data;
  } catch {
    if (!silent) toast.error(t("workload.project.databases.loadFailed"));
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
    title: t("workload.database.delete.title"),
    description: t("workload.database.delete.listDescription", {
      name: db.name,
    }),
    confirmText: t("workload.actions.delete"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    inputVerificationText: db.name,
    helpText: t("workload.database.delete.confirmHelp"),
    // Off by default — `launch-db-<id>-data` survives unless ticked.
    checkbox: {
      label: t("workload.database.delete.volumeLabel"),
      checked: false,
    },
  });
  if (!result.ok) return;
  const removeVolumes = !!result.checkbox?.checked;
  try {
    await dockerService.databases.delete(
      props.serverId,
      props.projectId,
      db.id,
      {
        removeVolumes,
      },
    );
    databases.value = databases.value.filter((x) => x.id !== db.id);
    toast.success(
      removeVolumes
        ? t("workload.database.delete.queuedWithVolume")
        : t("workload.database.delete.queuedPreserved"),
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.database.delete.failed"));
  }
};

const statusLabel = (status: string) => t(`workload.status.${status}`, status);

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
// Role gating — members are read-only; editors+ create, admins+ delete.
const { canEdit, canDelete } = useCan();
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

    <!--
      Heading-only row — the "New Database" trigger now lives in the
      project navbar next to Terminal.
    -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold">
        {{ t("workload.project.databases.title") }}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t("workload.project.databases.description") }}
      </p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="databases.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:database" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">
        {{ t("workload.project.databases.emptyTitle") }}
      </h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {{ t("workload.project.databases.emptyBefore") }}
        <code>launch-network</code
        >{{ t("workload.project.databases.emptyAfter") }}
      </p>
      <Button v-if="canEdit" class="mt-6" @click="createOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("workload.project.databases.new") }}
      </Button>
    </div>

    <!--
      Card layout mirrors ServerDockerProjects.vue (which mirrors
      pages/servers/index.vue):
      - outer wrapper holds the click handler (cursor-pointer, group)
      - inner div is the visible card with bg-card + hover:bg-muted/50
      - h-10 w-10 brand-icon-bg block on the left, fills with primary
        on hover (CSS rule at the bottom of this file)
      - name + subtitle stacked to the right
      - mt-auto bottom row: status pill on the left, exposure on the
        right
    -->
    <!--
      Cards use NuxtLink (not @click="navigateTo()") so Nuxt's client
      router runs the full navigation pipeline — page component
      remounts cleanly, onMounted fires, data fetch kicks off
      immediately. The previous manual-click version had a race
      that left the destination page blank until refresh.
    -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="db in databases"
        :key="db.id"
        :to="`/servers/${props.serverId}/projects/${props.projectId}/databases/${db.id}`"
        class="group block h-full"
      >
        <div
          class="relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <div class="relative flex items-start gap-3">
            <div
              class="brand-icon-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors duration-200"
            >
              <Icon
                :name="engineIcon(db.engine)"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="truncate font-semibold">{{ db.name }}</h3>
              <p class="line-clamp-1 text-sm text-muted-foreground">
                {{ db.engine }} {{ db.engine_version }}
              </p>
            </div>
            <Button
              v-if="canDelete"
              variant="ghost"
              size="icon"
              class="-mr-1 -mt-1 shrink-0 opacity-0 transition group-hover:opacity-100"
              @click.stop.prevent="deleteDatabase(db)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4" />
            </Button>
          </div>

          <div
            class="relative mt-auto flex min-h-7 items-center justify-between pt-4 text-sm"
          >
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="statusColor(db.status)"
            >
              {{ statusLabel(db.status) }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{
                db.external_port
                  ? t("workload.database.exposedOn", {
                      port: db.external_port,
                    })
                  : t("workload.database.internalOnly")
              }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <ProjectCreateDatabaseSheet
      v-model:open="createOpen"
      :server-id="props.serverId"
      :project-id="props.projectId"
      @created="onCreated"
    />
  </div>
</template>

<style scoped>
/*
  Hover-fill for the icon block, identical to ServerDockerProjects.vue
  and pages/servers/index.vue. Databases don't have per-engine brand
  colours (we'd need five distinct hues), so we use the theme primary
  as a single shared accent — reads cleanly across the grid regardless
  of engine.
*/
.group:hover .brand-icon-bg {
  background-color: hsl(var(--primary));
}

.group:hover .brand-icon {
  color: hsl(var(--primary-foreground));
}
</style>

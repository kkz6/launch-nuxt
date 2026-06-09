<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerDatabase,
} from "~/services/dockerService";
import type { Server } from "~/types";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const databaseId = computed(() => route.params.databaseId as string);

const db = ref<DockerDatabase | null>(null);
const isLoading = ref(true);

// No Deployments tab on databases — lifecycle actions (create / start /
// restart / stop) are direct docker subcommands, not user-facing
// deploys. The audit history still lives in the polymorphic
// docker_deployments table on the backend for ops, but the UI surfaces
// it via the action buttons + Logs tab instead of a dedicated tab.
const SUBTABS = [
  { value: "general", label: "General", icon: "lucide:info" },
  { value: "databases", label: "Databases", icon: "lucide:database" },
  { value: "environment", label: "Environment", icon: "lucide:key" },
  { value: "backups", label: "Backups", icon: "lucide:hard-drive" },
  { value: "logs", label: "Logs", icon: "lucide:scroll" },
  { value: "advanced", label: "Advanced", icon: "lucide:sliders-horizontal" },
] as const;
type SubTabId = (typeof SUBTABS)[number]["value"];

const READY_SUBTABS: Record<string, boolean> = {
  general: true,
  databases: true,
  environment: true,
  backups: true,
  logs: true,
  advanced: true,
};

// Read straight from the URL on every render. The navbar's subtab
// NuxtLinks are the source of truth — they update route.query.subtab
// and this computed picks the change up reactively. A local ref +
// watcher loop was the original implementation but it only mirrored
// the URL on mount, so navbar clicks didn't switch tabs.
const validIds = SUBTABS.map((s) => s.value);
const subTab = computed<SubTabId>(() => {
  const q = route.query.subtab as string | undefined;
  return q && (validIds as readonly string[]).includes(q)
    ? (q as SubTabId)
    : "general";
});

const fetchDatabase = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.databases.get(
      serverId.value,
      projectId.value,
      databaseId.value,
    );
    db.value = res.data;
    useHead({ title: db.value.name });
  } catch {
    toast.error("Database not found");
    navigateTo(
      `/servers/${serverId.value}/projects/${projectId.value}?tab=databases`,
    );
  } finally {
    isLoading.value = false;
  }
};

// React to lifecycle events from the worker so the status badge
// updates without polling.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
const channel = computed(() => `team.${teamId.value}`);
useChannelEvents(
  channel,
  [
    "docker.database.starting",
    "docker.database.running",
    "docker.database.failed",
    "docker.database.lifecycle_done",
  ],
  (data) => {
    if (data.id !== databaseId.value) return;
    fetchDatabase();
  },
);

// Navbar fires lifecycle actions directly via dockerService and bumps
// this key on success. Watching it here re-pulls the database so the
// page reflects the new state instantly (status badge, credentials,
// etc.) without waiting for the WS round-trip.
const workloadActionRefreshKey = useState<number>(
  "workloadActionRefreshKey",
  () => 0,
);
watch(workloadActionRefreshKey, () => {
  if (db.value) void fetchDatabase();
});

onMounted(fetchDatabase);

// Server fetch + Terminal mount — the navbar's Terminal button writes
// to the `serverTerminalOpen` useState bus, but ServerTerminalBottom
// only renders if the page mounts it. Without this block the bottom
// terminal pane never shows up on workload pages even though the
// button click registers.
const server = ref<Server | null>(null);
const isTerminalOpen = useState("serverTerminalOpen", () => false);

// Bound to the navbar's "Connection info" Actions item. The dialog
// lives here so it can read the already-loaded `database` row
// without a second fetch.
const databaseConnectionDialogOpen = useState<boolean>(
  "databaseConnectionDialogOpen",
  () => false,
);
// Belt-and-braces: ensure the flag is reset on page enter so a stale
// `true` from a previous visit doesn't pop the dialog immediately.
onMounted(() => {
  databaseConnectionDialogOpen.value = false;
});
const loadServer = async () => {
  try {
    const res = await $api<{ data: Server }>(`/servers/${serverId.value}`);
    server.value = res.data;
  } catch {
    // Silently fail — the rest of the page works without Terminal.
    server.value = null;
  }
};
onMounted(loadServer);

const statusBadge = computed(() => {
  if (!db.value) return "";
  switch (db.value.status) {
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
});
</script>

<template>
  <!--
    Single-root template. Nuxt config sets pageTransition
    { mode: 'out-in' } which wraps every page in a <Transition>; that
    in turn requires exactly one root vnode or the page silently
    fails to mount on SPA navigation (only hard reload works). Keep
    chrome + subtab nav + content all under this one wrapper.
  -->
  <div class="space-y-6 pb-10">
    <!--
      No on-page header — the navbar's last breadcrumb segment carries
      the engine icon + name + status badge + version subtitle, so a
      duplicate h1 would just be visual noise. Subtab nav is also in
      the navbar (sliding indicator strip).

      Content body waits on db so the per-subtab components don't
      receive a null prop. Spinner sits in a dashed border container
      so the layout doesn't look broken while the API call is in
      flight.
    -->
    <div
      v-if="!db"
      class="flex items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <DatabaseGeneral v-if="subTab === 'general'" :database="db" />

      <DatabaseDatabases
        v-else-if="subTab === 'databases'"
        :database="db"
      />

      <DatabaseEnvironment
        v-else-if="subTab === 'environment'"
        :database="db"
      />

      <DatabaseBackups v-else-if="subTab === 'backups'" :database="db" />

      <DatabaseLogs v-else-if="subTab === 'logs'" :database="db" />

      <DatabaseAdvanced
        v-else-if="subTab === 'advanced'"
        :database="db"
        @deleted="
          navigateTo(`/servers/${serverId}/projects/${projectId}?tab=databases`)
        "
      />

      <ServerDockerComingSoon
        v-else-if="!READY_SUBTABS[subTab]"
        :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
        description="This tab is reserved for future use."
        :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
      />
    </template>

    <!--
      Bottom Terminal pane — opens when the navbar Terminal button
      flips the shared `serverTerminalOpen` useState. `container`
      makes the WS handler wrap the session in `docker exec -it
      <container> sh`, so the shell opens INSIDE the database
      container rather than on the host root. db.container_name is
      backend-computed (deterministic from project + db names).
    -->
    <ServerTerminalBottom
      v-if="server && server.connected"
      :server="server"
      :is-open="isTerminalOpen"
      :container="db?.container_name || ''"
      @close="isTerminalOpen = false"
    />

    <!--
      Connection info dialog — triggered from the navbar's Actions
      dropdown via the shared `databaseConnectionDialogOpen` flag.
      Mounted here so it has access to the already-loaded `db` row.
      Only renders when the database is loaded to avoid handing
      `null` into the dialog's props.
    -->
    <DatabaseConnectionDialog
      v-if="db"
      v-model:open="databaseConnectionDialogOpen"
      :database="db"
    />
  </div>
</template>

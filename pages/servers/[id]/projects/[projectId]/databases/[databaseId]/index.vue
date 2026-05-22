<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerDatabase,
  type DockerDatabaseLifecycleAction,
} from "~/services/dockerService";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const databaseId = computed(() => route.params.databaseId as string);

const db = ref<DockerDatabase | null>(null);
const isLoading = ref(true);
const revealed = ref<DockerDatabase | null>(null);
const isRevealing = ref(false);
const lifecycleInFlight = ref<DockerDatabaseLifecycleAction | null>(null);

const SUBTABS = [
  { value: "general", label: "General", icon: "lucide:info" },
  { value: "environment", label: "Connection", icon: "lucide:key" },
  { value: "backups", label: "Backups", icon: "lucide:hard-drive" },
  { value: "logs", label: "Logs", icon: "lucide:scroll" },
  { value: "advanced", label: "Advanced", icon: "lucide:sliders-horizontal" },
] as const;
type SubTabId = (typeof SUBTABS)[number]["value"];

// General + Connection ship in phase 2i. Backups/Logs/Advanced stay
// placeholders until a follow-up.
const READY_SUBTABS: Record<string, boolean> = {
  general: true,
  environment: true,
  backups: true,
  logs: true,
  advanced: true,
};

const validIds = SUBTABS.map((s) => s.value);
const initial = (): SubTabId => {
  const q = route.query.subtab as string;
  return (validIds as readonly string[]).includes(q) ? (q as SubTabId) : "general";
};
const subTab = ref<SubTabId>(initial());
watch(subTab, (v) => {
  router.replace({ query: { ...route.query, subtab: v } });
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

const reveal = async () => {
  if (!db.value) return;
  isRevealing.value = true;
  try {
    const res = await dockerService.databases.get(
      db.value.server_id,
      db.value.project_id,
      db.value.id,
      { reveal: true },
    );
    revealed.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load credentials");
  } finally {
    isRevealing.value = false;
  }
};

const hideCreds = () => {
  revealed.value = null;
};

const lifecycle = async (action: DockerDatabaseLifecycleAction) => {
  if (!db.value || lifecycleInFlight.value) return;
  lifecycleInFlight.value = action;
  try {
    await dockerService.databases.lifecycle(
      db.value.server_id,
      db.value.project_id,
      db.value.id,
      action,
    );
    toast.success(`${action[0].toUpperCase()}${action.slice(1)} queued`);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || `Failed to ${action}`);
  } finally {
    lifecycleInFlight.value = null;
  }
};

const copyValue = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label}`);
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

onMounted(fetchDatabase);

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

const connectionString = computed(() => {
  if (!revealed.value?.credentials || !db.value) return "";
  const c = revealed.value.credentials;
  const host = db.value.external_port ? "<server-ip>" : db.value.name;
  const port = db.value.external_port ?? defaultPort(db.value.engine);
  switch (db.value.engine) {
    case "postgres":
      return `postgres://${c.username}:${c.password}@${host}:${port}/${c.database}`;
    case "mysql":
    case "mariadb":
      return `mysql://${c.username}:${c.password}@${host}:${port}/${c.database}`;
    case "redis":
      return `redis://:${c.password}@${host}:${port}`;
    case "mongo":
      return `mongodb://${c.username}:${c.password}@${host}:${port}`;
    default:
      return "";
  }
});

function defaultPort(engine: string): number {
  switch (engine) {
    case "postgres":
      return 5432;
    case "mysql":
    case "mariadb":
      return 3306;
    case "redis":
      return 6379;
    case "mongo":
      return 27017;
    default:
      return 0;
  }
}
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="db" class="space-y-6 pb-10">
    <NuxtLink
      :to="`/servers/${serverId}/projects/${projectId}?tab=databases`"
      class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon name="lucide:arrow-left" class="h-4 w-4" />
      Back to project
    </NuxtLink>

    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold">{{ db.name }}</h1>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="statusBadge"
          >
            {{ db.status }}
          </span>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ db.engine }} {{ db.engine_version }}
          <span v-if="db.external_port"> · exposed on :{{ db.external_port }}</span>
          <span v-else> · internal only</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="db.status !== 'running'"
          variant="outline"
          :disabled="lifecycleInFlight !== null"
          @click="lifecycle('start')"
        >
          <Icon name="lucide:play" class="mr-2 h-4 w-4" />
          Start
        </Button>
        <Button
          v-if="db.status === 'running'"
          variant="outline"
          :disabled="lifecycleInFlight !== null"
          @click="lifecycle('stop')"
        >
          <Icon name="lucide:square" class="mr-2 h-4 w-4" />
          Stop
        </Button>
        <Button
          :disabled="lifecycleInFlight !== null"
          @click="lifecycle('restart')"
        >
          <Icon name="lucide:rotate-cw" class="mr-2 h-4 w-4" />
          Restart
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 border-b">
      <button
        v-for="tab in SUBTABS"
        :key="tab.value"
        class="flex items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors"
        :class="
          subTab === tab.value
            ? 'border-primary font-medium text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click="subTab = tab.value"
      >
        <Icon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </button>
    </div>

    <!-- General: engine info, image tag, container name. -->
    <section v-if="subTab === 'general'" class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">General</h3>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Engine
          </dt>
          <dd class="font-medium capitalize">{{ db.engine }}</dd>
        </div>
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Version
          </dt>
          <dd class="font-mono text-sm">{{ db.engine_version }}</dd>
        </div>
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Image
          </dt>
          <dd class="font-mono text-xs">{{ db.image_tag || "—" }}</dd>
        </div>
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            External port
          </dt>
          <dd class="font-mono text-sm">
            {{ db.external_port ? db.external_port : "Not exposed (internal only)" }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Connection: credentials + connection string. -->
    <section
      v-else-if="subTab === 'environment'"
      class="rounded-lg border bg-card p-6"
    >
      <h3 class="text-lg font-semibold">Connection</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Auto-generated on create. Click reveal to fetch the password
        — it isn't loaded into the page until you ask.
      </p>

      <div v-if="!revealed" class="mt-6 flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
          Credentials are hidden. Reveal to view + copy.
        </p>
        <Button :disabled="isRevealing" @click="reveal">
          <Icon
            v-if="isRevealing"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:eye" class="mr-2 h-4 w-4" />
          Reveal credentials
        </Button>
      </div>

      <div v-else class="mt-6 space-y-4">
        <div
          v-for="row in [
            { label: 'Username', value: revealed.credentials!.username },
            { label: 'Password', value: revealed.credentials!.password },
            { label: 'Database', value: revealed.credentials!.database },
          ]"
          :key="row.label"
          class="space-y-1"
        >
          <Label>{{ row.label }}</Label>
          <div class="flex items-center gap-2">
            <Input
              :model-value="row.value"
              readonly
              class="font-mono text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              @click="copyValue(row.label, row.value)"
            >
              <Icon name="lucide:copy" class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="space-y-1">
          <Label>Connection string</Label>
          <div class="flex items-center gap-2">
            <Input
              :model-value="connectionString"
              readonly
              class="font-mono text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              @click="copyValue('Connection string', connectionString)"
            >
              <Icon name="lucide:copy" class="h-4 w-4" />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            From another container on launch-network, replace
            <code>&lt;server-ip&gt;</code> isn't needed — use
            <code>{{ db.name }}</code> as the host. From outside the
            docker server, this only works if you exposed an external
            port.
          </p>
        </div>

        <Button variant="outline" class="mt-2" @click="hideCreds">
          <Icon name="lucide:eye-off" class="mr-2 h-4 w-4" />
          Hide
        </Button>
      </div>
    </section>

    <DatabaseBackups v-else-if="subTab === 'backups'" :database="db" />

    <DatabaseLogs v-else-if="subTab === 'logs'" :database="db" />

    <DatabaseAdvanced v-else-if="subTab === 'advanced'" :database="db" />

    <ServerDockerComingSoon
      v-else-if="!READY_SUBTABS[subTab]"
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      description="This tab is reserved for future use."
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerDatabase,
} from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

// Reveal-on-demand for credentials. We never load passwords into the
// page unless the user explicitly asks — matches dokploy + the
// principle that a stray screenshare doesn't leak prod creds.
const revealed = ref<DockerDatabase | null>(null);
const isRevealing = ref(false);
const showPassword = ref(false);

const reveal = async () => {
  if (revealed.value) {
    showPassword.value = !showPassword.value;
    return;
  }
  isRevealing.value = true;
  try {
    const res = await dockerService.databases.get(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      { reveal: true },
    );
    revealed.value = res.data;
    showPassword.value = true;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load credentials");
  } finally {
    isRevealing.value = false;
  }
};

const copyValue = async (label: string, value: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label}`);
  }
};

// Engine catalog — drives icon + tint + default port for the
// per-engine display. Single source of truth so future engines just
// add a row here.
const engineInfo = computed(() => {
  switch (props.database.engine) {
    case "postgres":
      return {
        label: "Postgres",
        icon: "simple-icons:postgresql",
        iconBg: "bg-sky-500/10",
        iconColor: "text-sky-500",
        defaultPort: 5432,
      };
    case "mysql":
      return {
        label: "MySQL",
        icon: "simple-icons:mysql",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
        defaultPort: 3306,
      };
    case "mariadb":
      return {
        label: "MariaDB",
        icon: "simple-icons:mariadb",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
        defaultPort: 3306,
      };
    case "redis":
      return {
        label: "Redis",
        icon: "simple-icons:redis",
        iconBg: "bg-rose-500/10",
        iconColor: "text-rose-500",
        defaultPort: 6379,
      };
    case "mongo":
      return {
        label: "MongoDB",
        icon: "simple-icons:mongodb",
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-500",
        defaultPort: 27017,
      };
    default:
      return {
        label: props.database.engine,
        icon: "lucide:database",
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        defaultPort: 0,
      };
  }
});

const internalPort = computed(() => engineInfo.value.defaultPort);
const internalHost = computed(() => props.database.name);
// The navbar already loaded the server (it powers the project +
// workload breadcrumbs) and stashed its public IP in a shared useState
// bus — re-use it here so the External Connection URL renders the real
// address instead of a literal "<server-ip>" placeholder. Falls back to
// the placeholder if the navbar hasn't populated it yet.
const sharedServerIp = useState<string | null>(
  "currentServerPublicIp",
  () => null,
);
const externalHost = computed(() => sharedServerIp.value || "<server-ip>");

const username = computed(
  () => revealed.value?.credentials?.username ?? props.database.name,
);
const databaseName = computed(
  () => revealed.value?.credentials?.database ?? props.database.name,
);
const rawPassword = computed(() => revealed.value?.credentials?.password ?? "");
const passwordDisplay = computed(() => {
  if (!revealed.value?.credentials) return "•••••••••••••";
  return showPassword.value
    ? revealed.value.credentials.password
    : "•".repeat(Math.min(16, revealed.value.credentials.password.length));
});

const buildConnectionURL = (host: string, port: number) => {
  const u = username.value;
  const p = rawPassword.value || "•••••";
  const d = databaseName.value;
  switch (props.database.engine) {
    case "postgres":
      return `postgres://${u}:${p}@${host}:${port}/${d}`;
    case "mysql":
    case "mariadb":
      return `mysql://${u}:${p}@${host}:${port}/${d}`;
    case "redis":
      return `redis://:${p}@${host}:${port}`;
    case "mongo":
      return `mongodb://${u}:${p}@${host}:${port}`;
    default:
      return "";
  }
};

// Internal/External connection switcher. Defaults to internal — the
// host-side connection only makes sense when the user has explicitly
// exposed an external port, so we hide the switcher and pin to
// internal when there's no external option.
const hasExternal = computed(() => Boolean(props.database.external_port));
type ConnectionMode = "internal" | "external";
const connectionMode = ref<ConnectionMode>("internal");

const activeHost = computed(() =>
  connectionMode.value === "external" ? externalHost.value : internalHost.value,
);
const activePort = computed(() =>
  connectionMode.value === "external"
    ? (props.database.external_port ?? 0)
    : internalPort.value,
);
const activeConnectionURL = computed(() =>
  buildConnectionURL(activeHost.value, activePort.value),
);

// Container name on the host — same slug pattern the worker uses
// when running the container. Useful for `docker exec` / `docker logs`
// from a terminal session.
const containerName = computed(() => `launch-db-${props.database.name}`);
</script>

<template>
  <!--
    Status + lifecycle actions live in the navbar (workload action
    buttons next to Terminal) — see components/layout/Navbar.vue. The
    page body is just facts + credentials, no section headings.
    Same shape SiteOverview has: 4-up info-card grid, then a single
    Connection card with an internal/external segmented switcher.
  -->
  <div class="space-y-8">
    <!-- ── Database Details (no heading, header is in the page) ── -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Engine -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="engineInfo.iconBg"
        >
          <Icon
            :name="engineInfo.icon"
            class="h-5 w-5"
            :class="engineInfo.iconColor"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Engine</p>
          <p class="text-sm font-medium text-foreground">
            {{ engineInfo.label }}
          </p>
        </div>
      </div>

      <!-- Version -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"
        >
          <Icon name="lucide:tag" class="h-5 w-5 text-violet-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Version</p>
          <p class="text-sm font-medium text-foreground">
            {{ database.engine_version }}
          </p>
        </div>
      </div>

      <!-- Internal Port -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"
        >
          <Icon name="lucide:plug-zap" class="h-5 w-5 text-blue-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Internal Port</p>
          <p class="font-mono text-sm font-medium text-foreground">
            {{ internalPort }}
          </p>
        </div>
      </div>

      <!-- External Port -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="
            database.external_port ? 'bg-emerald-500/10' : 'bg-zinc-500/10'
          "
        >
          <Icon
            name="lucide:globe"
            class="h-5 w-5"
            :class="
              database.external_port ? 'text-emerald-500' : 'text-zinc-500'
            "
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">External Port</p>
          <p class="font-mono text-sm font-medium text-foreground">
            {{ database.external_port ?? "Not exposed" }}
          </p>
        </div>
      </div>

      <!-- Image (full width on sm, 2-col on lg) -->
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
        >
          <Icon name="simple-icons:docker" class="h-5 w-5 text-zinc-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Image</p>
          <p class="truncate font-mono text-sm font-medium text-foreground">
            {{ database.image_tag || "—" }}
          </p>
        </div>
      </div>

      <!-- Container name on host -->
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10"
        >
          <Icon name="lucide:container" class="h-5 w-5 text-orange-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Container</p>
          <p class="truncate font-mono text-xs font-medium text-foreground">
            {{ containerName }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Connection (single card, internal/external switcher) ── -->
    <div class="rounded-lg border bg-card">
      <!-- Switcher header. When no external port is set we hide the
           segmented control and just show "Connection" as a heading. -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3"
      >
        <div v-if="hasExternal" class="inline-flex rounded-md bg-muted p-0.5">
          <button
            class="rounded px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              connectionMode === 'internal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="connectionMode = 'internal'"
          >
            <Icon name="lucide:network" class="mr-1.5 inline h-4 w-4" />
            Internal
          </button>
          <button
            class="rounded px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              connectionMode === 'external'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="connectionMode = 'external'"
          >
            <Icon name="lucide:globe" class="mr-1.5 inline h-4 w-4" />
            External
          </button>
        </div>
        <div v-else>
          <p class="text-sm font-medium">Connection</p>
          <p class="text-xs text-muted-foreground">
            Internal — reachable only from sibling containers on
            <code>launch-network</code>.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          :disabled="isRevealing"
          @click="reveal"
        >
          <Icon
            v-if="isRevealing"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon
            v-else
            :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
            class="mr-2 h-4 w-4"
          />
          {{ revealed ? (showPassword ? "Hide" : "Reveal") : "Reveal" }}
        </Button>
      </div>

      <!--
        Body. One layout regardless of internal/external — host + port
        + URL switch values based on the active mode, everything else
        stays put. Keeps muscle memory consistent when the user
        toggles between the two.
      -->
      <div class="space-y-3 px-5 py-4">
        <!-- Hint line under the switcher describing the active mode. -->
        <p v-if="hasExternal" class="text-xs text-muted-foreground">
          <template v-if="connectionMode === 'internal'">
            <Icon name="lucide:info" class="-mt-0.5 inline h-3.5 w-3.5" />
            Resolves over <code>launch-network</code> from sibling
            containers. Replace
            <code>&lt;server-ip&gt;</code> isn't needed here.
          </template>
          <template v-else>
            <Icon name="lucide:info" class="-mt-0.5 inline h-3.5 w-3.5" />
            Reach the database from outside the docker server. Ensure
            the external port is open through the host firewall.
          </template>
        </p>

        <!-- Connection URL (full row, monospace + copy) -->
        <div>
          <p class="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Connection URL
          </p>
          <div class="flex items-center gap-2">
            <Input
              :model-value="activeConnectionURL"
              readonly
              class="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              :disabled="!revealed"
              @click="copyValue('Connection URL', activeConnectionURL)"
            >
              <Icon name="lucide:copy" class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <!-- User / Database -->
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p
              class="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
            >
              User
            </p>
            <div class="flex items-center gap-2">
              <Input
                :model-value="username"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue('User', username)"
              >
                <Icon name="lucide:copy" class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <p
              class="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
            >
              Database
            </p>
            <div class="flex items-center gap-2">
              <Input
                :model-value="databaseName"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue('Database name', databaseName)"
              >
                <Icon name="lucide:copy" class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Password / Host -->
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p
              class="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
            >
              Password
            </p>
            <div class="flex items-center gap-2">
              <Input
                :model-value="passwordDisplay"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                :disabled="!rawPassword"
                @click="copyValue('Password', rawPassword)"
              >
                <Icon name="lucide:copy" class="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <p
              class="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
            >
              {{ connectionMode === "external" ? "External Host" : "Internal Host" }}
            </p>
            <div class="flex items-center gap-2">
              <Input
                :model-value="activeHost"
                readonly
                class="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                @click="copyValue('Host', activeHost)"
              >
                <Icon name="lucide:copy" class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

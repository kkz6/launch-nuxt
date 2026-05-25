<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerDatabase,
} from "~/services/dockerService";

// Database connection-info dialog. Opens from the navbar's Actions
// dropdown ("Connection info") on the database detail page. Replaces
// the old Connection card that sat on General — General is now a
// clean info-card grid like application + compose.
//
// Two reasons the dialog wins over the in-page card:
//   - Credentials are sensitive. A modal is dismissible; a card
//     that's always on the page risks accidental screenshots.
//   - The data is read-only and consulted occasionally, not every
//     page visit. Dialog matches that frequency.

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

const open = defineModel<boolean>("open", { default: false });

// Reveal-on-demand for credentials — same pattern the previous card
// used. We never load passwords into the page unless the user
// explicitly asks, so a stray screenshare doesn't leak prod creds.
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

// Reset reveal state every time the dialog opens so a stale reveal
// from a previous session doesn't carry over. The fetch ran for a
// reason — keep that contract.
watch(open, (isOpen) => {
  if (!isOpen) {
    revealed.value = null;
    showPassword.value = false;
    connectionMode.value = "internal";
  }
});

const copyValue = async (label: string, value: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label}`);
  }
};

// Engine catalog — per-engine icon + default port. Single source of
// truth so future engines just add a row here.
const engineInfo = computed(() => {
  switch (props.database.engine) {
    case "postgres":
      return { label: "Postgres", defaultPort: 5432 };
    case "mysql":
      return { label: "MySQL", defaultPort: 3306 };
    case "mariadb":
      return { label: "MariaDB", defaultPort: 3306 };
    case "redis":
      return { label: "Redis", defaultPort: 6379 };
    case "mongo":
      return { label: "MongoDB", defaultPort: 27017 };
    default:
      return { label: props.database.engine, defaultPort: 0 };
  }
});

const internalPort = computed(() => engineInfo.value.defaultPort);
// CRITICAL — Use the backend-computed `container_name`
// (`launch-db-<project>-<db>`), NOT the bare database name. Sibling
// containers on launch-network resolve the database via its
// container name, not its row label. The old General-card UI used
// `props.database.name` here, which produced a connection URL that
// looked right but didn't resolve (a stale screenshot is the only
// evidence; bug fixed in this refactor).
const internalHost = computed(
  () => props.database.container_name || props.database.name,
);

// The navbar already loaded the server (it powers the project +
// workload breadcrumbs) and stashed its public IP in a shared
// useState bus — re-use it here so External Host renders the real
// address instead of a literal "<server-ip>" placeholder.
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
const rawPassword = computed(
  () => revealed.value?.credentials?.password ?? "",
);
const passwordDisplay = computed(() => {
  if (!revealed.value?.credentials) return "•".repeat(12);
  return showPassword.value
    ? revealed.value.credentials.password
    : "•".repeat(Math.min(16, revealed.value.credentials.password.length));
});

// The password slot in the connection URL respects the same
// reveal+show state as the standalone password field. Three states:
//
//   - Not revealed yet → "<password>" literal placeholder. Clear
//     signal that the URL isn't usable until reveal.
//   - Revealed but hidden → dot mask. The toggle is now actually
//     doing something to the URL view; Hide really hides.
//   - Revealed and shown → real password.
//
// Mirrors `passwordDisplay`'s logic so the two fields can never
// disagree about what state they're in.
const urlPasswordSlot = computed(() => {
  if (!revealed.value) return "<password>";
  if (!showPassword.value) return "•".repeat(8);
  return rawPassword.value;
});

const buildConnectionURL = (host: string, port: number) => {
  const u = username.value;
  const p = urlPasswordSlot.value;
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

// Internal/External switcher. External tab disabled when no external
// port is exposed — explicit feedback rather than hiding the option.
const hasExternal = computed(() => Boolean(props.database.external_port));
type ConnectionMode = "internal" | "external";
const connectionMode = ref<ConnectionMode>("internal");

const activeHost = computed(() =>
  connectionMode.value === "external"
    ? externalHost.value
    : internalHost.value,
);
const activePort = computed(() =>
  connectionMode.value === "external"
    ? (props.database.external_port ?? 0)
    : internalPort.value,
);
const activeConnectionURL = computed(() =>
  buildConnectionURL(activeHost.value, activePort.value),
);

// Copy-the-URL builds with the REAL password regardless of whether
// the password field is currently masked. The toggle controls what's
// on screen (shoulder-surfing protection); Copy is for "I want to
// use this URL." Once revealed, the user has already consented to
// the password being in memory — masking is purely visual.
//
// Both branches still gate on `revealed.value` so we don't ship a
// `<password>` placeholder into the clipboard.
const copyableConnectionURL = computed(() => {
  if (!revealed.value) return "";
  const host = activeHost.value;
  const port = activePort.value;
  const u = username.value;
  const p = rawPassword.value;
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
});

// Copy-Connection-URL stays disabled until reveal so users don't
// paste a `<password>` placeholder into a config.
const urlCopyDisabled = computed(() => !revealed.value);

// --- Public Access (expose-to-internet toggle) --------------------
//
// Moved here from the Advanced tab. The Connection dialog is where
// users see "External" is disabled and naturally ask "how do I
// enable it?" — having the toggle right here closes that loop
// instead of pushing them to a different tab. Backend wiring is
// unchanged: POST /expose recreates the container with/without the
// `-p` flag.

const exposeEnabled = ref(Boolean(props.database.external_port));
const exposePort = ref<number | undefined>(
  props.database.external_port ?? undefined,
);
const exposeSaving = ref(false);

// Engine default port — placeholder + auto-fill when toggling on.
const defaultExposePort = computed(() => {
  switch (props.database.engine) {
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
      return undefined;
  }
});

// Re-seed from the prop when the parent refetches (the WS event
// after a successful recreate updates props.database). Without
// this, the toggle keeps its stale local value after the round-trip.
watch(
  () => props.database.external_port,
  (port) => {
    exposeEnabled.value = Boolean(port);
    exposePort.value = port ?? undefined;
  },
);

const onExposeToggle = (next: boolean) => {
  exposeEnabled.value = next;
  if (next && !exposePort.value) {
    exposePort.value = defaultExposePort.value;
  }
};

const saveExpose = async () => {
  if (exposeEnabled.value && !exposePort.value) {
    toast.error("Port is required to expose this database");
    return;
  }
  exposeSaving.value = true;
  try {
    await dockerService.databases.setExpose(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      {
        enabled: exposeEnabled.value,
        port: exposeEnabled.value ? exposePort.value : null,
      },
    );
    toast.success(
      exposeEnabled.value
        ? "Database is being recreated with the external port"
        : "Database is being recreated without an external port",
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update expose setting");
    // Roll back the local state to what the backend last persisted.
    exposeEnabled.value = Boolean(props.database.external_port);
    exposePort.value = props.database.external_port ?? undefined;
  } finally {
    exposeSaving.value = false;
  }
};

// Dirty flag — Save button only enabled when the toggle / port has
// changed from what the backend currently has. Keeps the user from
// firing a no-op recreate.
const exposeDirty = computed(() => {
  const wasEnabled = Boolean(props.database.external_port);
  const wasPort = props.database.external_port ?? undefined;
  if (exposeEnabled.value !== wasEnabled) return true;
  if (exposeEnabled.value && exposePort.value !== wasPort) return true;
  return false;
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Connection</DialogTitle>
        <DialogDescription>
          Connect to <span class="font-mono">{{ database.name }}</span>
          ({{ engineInfo.label }}). Sibling containers reach the database
          over <code class="font-mono text-xs">launch-network</code> via
          its container name; external clients use the server's public
          IP when the database exposes an external port.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Internal/External segmented switcher.
             External tab is disabled (not hidden) when no external
             port is exposed so the user can SEE the option exists,
             and the disabled state nudges them toward the Advanced
             tab to enable it. -->
        <div class="inline-flex rounded-md border bg-muted p-0.5">
          <button
            type="button"
            class="rounded px-3 py-1 text-xs font-medium transition-colors"
            :class="
              connectionMode === 'internal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="connectionMode = 'internal'"
          >
            <Icon name="lucide:network" class="mr-1.5 inline h-3.5 w-3.5" />
            Internal
          </button>
          <button
            type="button"
            class="rounded px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              connectionMode === 'external' && hasExternal
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            :disabled="!hasExternal"
            :title="
              hasExternal
                ? undefined
                : 'No external port — enable it from the Advanced tab'
            "
            @click="hasExternal && (connectionMode = 'external')"
          >
            <Icon name="lucide:globe" class="mr-1.5 inline h-3.5 w-3.5" />
            External
          </button>
        </div>

        <!-- Connection URL — the headline value. Single full-width
             row with a Reveal toggle + Copy on the right. URL Copy
             is disabled until reveal so users can't paste a
             placeholder-password URL into config. -->
        <div class="rounded-lg border bg-card p-3">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Connection URL
            </p>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                :disabled="isRevealing"
                @click="reveal"
              >
                <Icon
                  v-if="isRevealing"
                  name="lucide:loader-2"
                  class="h-3.5 w-3.5 animate-spin"
                />
                <Icon
                  v-else
                  :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="h-3.5 w-3.5"
                />
                {{ revealed ? (showPassword ? "Hide" : "Show") : "Reveal" }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="urlCopyDisabled"
                :title="
                  urlCopyDisabled
                    ? 'Reveal credentials before copying'
                    : 'Copy connection URL'
                "
                @click="copyValue('Connection URL', copyableConnectionURL)"
              >
                <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
          </div>
          <!--
            truncate (not overflow-x-auto) so a longer revealed URL
            doesn't pop a horizontal scrollbar that adds ~16px of
            vertical chrome and jolts the dialog height. The Copy
            button still grabs the full URL — visible characters are
            for orientation, not full reading.
          -->
          <code
            class="block w-full truncate rounded bg-muted/60 px-2 py-1.5 font-mono text-xs transition-colors duration-150"
            :title="activeConnectionURL"
          >{{ activeConnectionURL }}</code>
        </div>

        <!-- Field grid — host / port / database / user / password.
             Each row is a label + value + small copy icon. Keeps the
             dialog compact vs the previous "input + button" pairs
             that used 4× the vertical space for the same content. -->
        <div class="divide-y rounded-lg border bg-card text-sm">
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">
              {{ connectionMode === "external" ? "External Host" : "Host" }}
            </span>
            <code class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs">
              <span class="truncate">{{ activeHost }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Copy host"
                @click="copyValue('Host', activeHost)"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">Port</span>
            <code class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs">
              <span>{{ activePort }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Copy port"
                @click="copyValue('Port', String(activePort))"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">Database</span>
            <code class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs">
              <span class="truncate">{{ databaseName }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Copy database"
                @click="copyValue('Database', databaseName)"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">User</span>
            <code class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs">
              <span class="truncate">{{ username }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Copy user"
                @click="copyValue('User', username)"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">Password</span>
            <code class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs">
              <span class="truncate">{{ passwordDisplay }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!rawPassword"
                title="Copy password"
                @click="copyValue('Password', rawPassword)"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
        </div>

        <!-- Active-mode hint. Plain prose, no chrome. -->
        <p class="text-xs text-muted-foreground">
          <template v-if="connectionMode === 'internal'">
            <Icon name="lucide:info" class="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            Use this from another container running on
            <code class="font-mono">launch-network</code> (an application
            in the same project, a worker, etc.).
          </template>
          <template v-else>
            <Icon name="lucide:info" class="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            Reachable from outside the docker server. Make sure the
            host firewall allows the external port.
          </template>
        </p>

        <!--
          Public Access — moved here from the Advanced tab.
          This is the natural place: the External tab next to the
          Internal one is disabled when no external port is set, and
          users immediately ask "how do I enable it?". Toggle right
          here closes that loop. Backend wiring unchanged
          (POST /expose recreates the container).
        -->
        <div class="rounded-lg border bg-card">
          <div class="flex items-start justify-between gap-4 px-4 py-3">
            <div class="min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <Icon name="lucide:globe" class="h-4 w-4 text-muted-foreground" />
                <Label class="text-sm font-medium">
                  Expose to the internet
                </Label>
              </div>
              <p class="text-xs text-muted-foreground">
                Publish the database on the host's public IP so
                clients outside the docker network can connect.
                Toggling triggers a container recreate.
              </p>
            </div>
            <Switch
              :model-value="exposeEnabled"
              :disabled="exposeSaving"
              class="mt-0.5 shrink-0"
              @update:model-value="onExposeToggle"
            />
          </div>

          <!-- Port input + Save are part of the same card so the
               two settings sit visually together. Port slot is
               only rendered when the toggle is on; Save is only
               enabled when something actually changed (no no-op
               recreates). -->
          <div
            v-if="exposeEnabled || exposeDirty"
            class="flex items-end gap-3 border-t px-4 py-3"
          >
            <div class="flex-1 space-y-1">
              <Label for="db-expose-port" class="text-[11px] uppercase tracking-wide text-muted-foreground">
                External Port
              </Label>
              <Input
                id="db-expose-port"
                v-model.number="exposePort"
                type="number"
                class="h-8 text-sm"
                :disabled="!exposeEnabled"
                :placeholder="defaultExposePort?.toString() || 'e.g. 5432'"
                autocomplete="off"
              />
            </div>
            <Button
              size="sm"
              :disabled="exposeSaving || !exposeDirty"
              @click="saveExpose"
            >
              <Icon
                v-if="exposeSaving"
                name="lucide:loader-2"
                class="mr-1.5 h-3.5 w-3.5 animate-spin"
              />
              Save
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

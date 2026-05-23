<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerTraefikSnapshot,
} from "~/services/dockerService";

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

const snap = ref<DockerTraefikSnapshot | null>(null);
const isLoading = ref(true);
const refreshing = ref(false);

const fetchSnap = async () => {
  refreshing.value = true;
  try {
    const res = await dockerService.host.traefik(props.serverId);
    snap.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load Traefik config");
  } finally {
    isLoading.value = false;
    refreshing.value = false;
  }
};

// Dynamic files sorted alphabetically so the order is stable across
// refreshes. middlewares.yml shows up first by sort order — convenient
// since it's typically the only file present pre-deployment.
const dynamicEntries = computed(() => {
  if (!snap.value) return [];
  return Object.entries(snap.value.dynamic_files).sort(([a], [b]) =>
    a.localeCompare(b),
  );
});

// The file the editor is currently showing. We treat the static
// traefik.yml as a virtual entry alongside the dynamic files so users
// can flip between them with one click.
type SelectedFile =
  | { kind: "static"; name: "traefik.yml"; path: string }
  | { kind: "dynamic"; name: string; path: string };

const selected = ref<SelectedFile | null>(null);

// Default to the static config once the snapshot loads — it's the
// file most-asked-for when debugging Traefik plumbing.
watch(snap, (s) => {
  if (s && !selected.value) {
    selected.value = {
      kind: "static",
      name: "traefik.yml",
      path: "/etc/launch/traefik/traefik.yml",
    };
  }
});

const selectedContents = computed(() => {
  if (!snap.value || !selected.value) return "";
  if (selected.value.kind === "static") return snap.value.static_config;
  return snap.value.dynamic_files[selected.value.name] ?? "";
});

const totalFileCount = computed(
  () => (snap.value ? 1 + dynamicEntries.value.length : 0),
);

onMounted(fetchSnap);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold">Traefik</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Static + dynamic config Traefik is reading from
          <code>/etc/launch/traefik</code>. Read-only — the dynamic
          directory is rewritten by Launch when domains change.
        </p>
      </div>
      <Button variant="outline" :disabled="refreshing" @click="fetchSnap">
        <Icon
          :name="refreshing ? 'lucide:loader-2' : 'lucide:refresh-cw'"
          :class="['mr-2 h-4 w-4', refreshing && 'animate-spin']"
        />
        Refresh
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <!--
      Two-pane layout: file list on the left, editor on the right.
      Dokploy's File System view is richer because it walks the whole
      /etc/dokploy tree; we deliberately keep the scope narrower —
      Launch owns these files and exposing the rest of the filesystem
      tempts users into edits we can't replay across deploys.
    -->
    <div
      v-else-if="snap"
      class="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"
    >
      <aside class="space-y-1 rounded-lg border bg-card p-2">
        <p
          class="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Files ({{ totalFileCount }})
        </p>

        <p
          class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Static
        </p>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
          :class="
            selected?.kind === 'static'
              ? 'bg-primary/10 font-medium text-foreground'
              : 'hover:bg-muted/50'
          "
          @click="
            selected = {
              kind: 'static',
              name: 'traefik.yml',
              path: '/etc/launch/traefik/traefik.yml',
            }
          "
        >
          <Icon name="lucide:file-cog" class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate font-mono">traefik.yml</span>
        </button>

        <p
          class="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Dynamic
        </p>
        <p
          v-if="dynamicEntries.length === 0"
          class="px-2 text-[11px] text-muted-foreground"
        >
          No dynamic files yet. One lands here for each application
          domain you add.
        </p>
        <button
          v-for="[name] in dynamicEntries"
          :key="name"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
          :class="
            selected?.kind === 'dynamic' && selected.name === name
              ? 'bg-primary/10 font-medium text-foreground'
              : 'hover:bg-muted/50'
          "
          @click="
            selected = {
              kind: 'dynamic',
              name,
              path: `/etc/launch/traefik/dynamic/${name}`,
            }
          "
        >
          <Icon name="lucide:file-code" class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate font-mono">{{ name }}</span>
        </button>
      </aside>

      <section class="rounded-lg border bg-card">
        <header class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div class="min-w-0">
            <p class="truncate font-mono text-xs">
              {{ selected?.path || "—" }}
            </p>
            <p class="text-[11px] text-muted-foreground">
              {{
                selected?.kind === "static"
                  ? "Static configuration — entrypoints, providers, ACME resolver."
                  : "Dynamic router/middleware config. Re-rendered by Launch when domains change."
              }}
            </p>
          </div>
          <span
            class="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            read-only
          </span>
        </header>

        <!--
          Reuse the project-wide SharedCodeEditor (CodeMirror + GitHub
          theme + line numbers + folding). Same component the
          Scripts / Files / Deployment-settings pages use, so the
          look-and-feel carries across the app.
        -->
        <div class="p-4">
          <SharedCodeEditor
            :model-value="selectedContents"
            :disabled="true"
            class="h-[480px]"
          />
        </div>
      </section>
    </div>
  </div>
</template>

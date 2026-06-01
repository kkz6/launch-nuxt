<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();

const apps = ref<DockerApplication[]>([]);
const isLoading = ref(true);

// Shared with the navbar "+ New Application" button — see
// components/layout/Navbar.vue. Keeps the trigger affordance next to
// Terminal where the eye expects it, without the page reaching into
// navbar internals or vice versa.
const createSheetOpen = useState<boolean>(
  "dockerCreateApplicationOpen",
  () => false,
);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchApps = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.list(
      props.serverId,
      props.projectId,
    );
    apps.value = res.data;
  } catch {
    toast.error("Failed to load applications");
  } finally {
    isLoading.value = false;
  }
};

const onCreated = (app: DockerApplication) => {
  // Optimistic prepend; matches how ServerDockerProjects.vue handles the
  // create response so the UX is consistent across the docker module.
  apps.value = [app, ...apps.value];
  createSheetOpen.value = false;
};

const deleteApp = async (app: DockerApplication) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Application",
    description:
      app.status === "running"
        ? `"${app.name}" is currently running. Deleting it will stop and remove the container.`
        : `Are you sure you want to delete "${app.name}"?`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
    inputVerificationText: app.name,
    helpText: "Type the application name to confirm:",
    // Same opt-in volume cleanup as the app-detail Advanced delete.
    // Off by default — only the user's explicit tick wipes data.
    checkbox: {
      label: "Also delete attached named volumes (data will be lost)",
      checked: false,
    },
  });
  if (!result.ok) return;
  const removeVolumes = !!result.checkbox?.checked;
  try {
    await dockerService.applications.delete(
      props.serverId,
      props.projectId,
      app.id,
      { removeVolumes },
    );
    apps.value = apps.value.filter((a) => a.id !== app.id);
    toast.success(removeVolumes ? "Application + volumes deleted" : "Application deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete application");
  }
};

const sourceSummary = (app: DockerApplication): string => {
  const cfg = app.source_config ?? {};
  switch (app.source_type) {
    case "image":
      return (cfg.image as string) || "image";
    case "git": {
      const repo = cfg.repo as string | undefined;
      const branch = cfg.branch as string | undefined;
      if (repo && branch) return `${repo} @ ${branch}`;
      return repo ?? "git";
    }
    case "dockerfile":
      return "Custom Dockerfile";
  }
};

const statusColor = (status: string): string => {
  switch (status) {
    case "running":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "building":
    case "idle":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "deleting":
      // Distinct from "failed" — we're still mid-action, not done.
      // Blue signals "in flight, no panic" the same way the agent
      // update banner does.
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "stopped":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const relative = (iso?: string | null): string => {
  if (!iso) return "never";
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
};

// Right-side "last deploy" subtext. The status pill on the left
// already shows the lifecycle state; this column should add the
// *time dimension* — when did the last attempt land, did it succeed.
//
// The old version said "Never deployed" whenever `last_deployed_at`
// was null, even if status was "failed" — visually two states (Failed
// + Never deployed) side-by-side and the customer couldn't tell which
// was authoritative. lastDeployText fixes that by branching:
//   1. We have a successful deploy timestamp → "Deployed <ago>"
//   2. In-flight (deploying/building) → "Deploying…"
//   3. Last attempt failed, never succeeded → "Last deploy failed"
//   4. Otherwise idle → "Never deployed"
const lastDeployText = (app: DockerApplication): string => {
  // "Deleting" wins over every other subtext — when the operator
  // clicked Delete they want clear feedback that the row is in
  // flight; the deploy history is irrelevant during that window.
  if (app.status === "deleting") {
    return "Deleting…";
  }
  if (app.last_deployed_at) {
    return `Deployed ${relative(app.last_deployed_at)}`;
  }
  // `building` is the in-flight state on the row while the worker is
  // running the deploy task; `running` only flips on after the
  // container has come up, which also sets last_deployed_at — so the
  // above branch wins. (There's no separate "deploying" enum value
  // even though the team-channel event is named that.)
  if (app.status === "building") {
    return "Deploying…";
  }
  if (app.status === "failed") {
    return "Last deploy failed";
  }
  return "Never deployed";
};

// WS keeps the list live across deploy lifecycle. The backend
// broadcasts deploying / deployed / failed with the application's
// id; we refetch silently so status badges + last_deployed_at stay
// accurate without a manual reload. Audit 2026-05-23 flagged this
// as the worst HALF-WIRED gap on the list views.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerApplicationEvents(teamId, (data) => {
  if (data.project_id && data.project_id !== props.projectId) return;
  void fetchApps();
});

onMounted(fetchApps);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!--
      Heading-only row — the "New Application" trigger now lives in
      the project navbar next to Terminal so it's symmetric with how
      Sites are created. Empty state below still has its own CTA for
      first-time discovery.
    -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold">Applications</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Single-container workloads. Deploy from a public image, a git
        repo, or a pasted Dockerfile.
      </p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="apps.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:box" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No applications yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Register your first application to start deploying containers in
        this project.
      </p>
      <Button class="mt-6" @click="createSheetOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Application
      </Button>
    </div>

    <!--
      Card layout mirrors ServerDockerProjects.vue / Databases.vue.
      Same brand-icon-bg pattern across all three workload kinds so
      the grids read as siblings.
    -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="app in apps"
        :key="app.id"
        :to="`/servers/${props.serverId}/projects/${props.projectId}/applications/${app.id}`"
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
                name="lucide:box"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="truncate font-semibold">{{ app.name }}</h3>
                <!--
                  GHA pill on the card — quickly signals to operators
                  scanning the list which workloads have a CI pipeline
                  attached, vs. the server-build default. Click target
                  is the whole card so we don't make the pill itself
                  a link (keeps the card click area uniform).
                -->
                <span
                  v-if="app.build_location === 'github_actions'"
                  class="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  title="Builds run in GitHub Actions"
                >
                  <Icon name="simple-icons:github" class="h-3 w-3" />
                  GHA
                </span>
              </div>
              <p class="line-clamp-1 text-sm text-muted-foreground">
                {{ sourceSummary(app) }}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="-mr-1 -mt-1 shrink-0 opacity-0 transition group-hover:opacity-100"
              @click.stop.prevent="deleteApp(app)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4" />
            </Button>
          </div>

          <div class="relative mt-auto flex min-h-7 items-center justify-between pt-4 text-sm">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="statusColor(app.status)"
            >
              {{ app.status }}
            </span>
            <!--
              Right-side timestamp text. The old version showed both
              "Failed" (status) and "Never deployed" (last_deployed_at
              is null) when a workload's only deploy attempt failed —
              two mutually-exclusive states side by side. lastDeployText
              encodes the actual semantics: "Never deployed" only fires
              when status is idle; failure-without-success says so
              explicitly; in-flight states show "Deploying…" without
              also implying a successful deploy timestamp.
            -->
            <span class="text-xs text-muted-foreground">
              {{ lastDeployText(app) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <ProjectCreateApplicationSheet
      v-model:open="createSheetOpen"
      :server-id="props.serverId"
      :project-id="props.projectId"
      @created="onCreated"
    />
  </div>
</template>

<style scoped>
/*
  Hover-fill for the icon block, matching ServerDockerProjects.vue +
  Databases.vue. Single theme primary tone across all source types
  (image / git / dockerfile) — simpler than per-source brand colours.
*/
.group:hover .brand-icon-bg {
  background-color: hsl(var(--primary));
}

.group:hover .brand-icon {
  color: hsl(var(--primary-foreground));
}
</style>

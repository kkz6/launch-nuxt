<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();

const composes = ref<DockerCompose[]>([]);
const isLoading = ref(true);

// Shared with the navbar "+ New Compose Stack" button — see
// components/layout/Navbar.vue.
const createOpen = useState<boolean>(
  "dockerCreateComposeOpen",
  () => false,
);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchComposes = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.composes.list(props.serverId, props.projectId);
    composes.value = res.data;
  } catch {
    toast.error("Failed to load compose stacks");
  } finally {
    isLoading.value = false;
  }
};

const onCreated = (c: DockerCompose) => {
  composes.value = [c, ...composes.value];
  createOpen.value = false;
};

const deleteCompose = async (c: DockerCompose) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Compose Stack",
    description: `Remove "${c.name}"? The running containers won't be torn down automatically yet — bring them down on the server first.`,
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
    inputVerificationText: c.name,
    helpText: "Type the stack name to confirm:",
  });
  if (!result.ok) return;
  try {
    await dockerService.composes.delete(props.serverId, props.projectId, c.id);
    composes.value = composes.value.filter((x) => x.id !== c.id);
    toast.success("Compose stack deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete compose stack");
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

const sourceSummary = (c: DockerCompose): string => {
  const cfg = c.source_config ?? {};
  if (c.compose_source_type === "git") {
    const repo = cfg.repo as string | undefined;
    const branch = cfg.branch as string | undefined;
    if (repo && branch) return `${repo} @ ${branch}`;
    return repo ?? "git";
  }
  return "Inline YAML";
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

// See components/project/Applications.vue#lastDeployText for the
// rationale. Same semantics for compose stacks — status pill +
// timestamp must not contradict each other.
const lastDeployText = (c: DockerCompose): string => {
  if (c.last_deployed_at) {
    return `Deployed ${relative(c.last_deployed_at)}`;
  }
  if (c.status === "building") {
    return "Deploying…";
  }
  if (c.status === "failed") {
    return "Last deploy failed";
  }
  return "Never deployed";
};

// WS so status badges + names stay live across renames and deploys.
// The backend's composeBroadcast helper guarantees every event
// carries compose_id alongside id — see compose_service.go.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerComposeEvents(teamId, (data) => {
  if (data.project_id && data.project_id !== props.projectId) return;
  void fetchComposes();
});

onMounted(fetchComposes);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!--
      Heading-only row — the "New Compose Stack" trigger now lives in
      the project navbar next to Terminal.
    -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold">Compose</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Multi-container stacks deployed with <code>docker compose up</code>.
        Use these for apps that need a database alongside, sidecars, or
        anything beyond a single container.
      </p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="composes.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:layers" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No compose stacks yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Define a <code>docker-compose.yml</code> file (git repo or pasted
        inline) and deploy it here.
      </p>
      <Button class="mt-6" @click="createOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Compose Stack
      </Button>
    </div>

    <!--
      Card layout mirrors ServerDockerProjects.vue / Databases.vue /
      Applications.vue. All four card grids share the same brand-icon-bg
      pattern so the project's three workload tabs read consistently.
    -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="c in composes"
        :key="c.id"
        :to="`/servers/${props.serverId}/projects/${props.projectId}/composes/${c.id}`"
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
                name="lucide:layers"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="truncate font-semibold">{{ c.name }}</h3>
                <!-- GHA pill — see components/project/Applications.vue for rationale. -->
                <span
                  v-if="c.build_location === 'github_actions'"
                  class="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  title="Builds run in GitHub Actions"
                >
                  <Icon name="simple-icons:github" class="h-3 w-3" />
                  GHA
                </span>
              </div>
              <p class="line-clamp-1 text-sm text-muted-foreground">
                {{ sourceSummary(c) }}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="-mr-1 -mt-1 shrink-0 opacity-0 transition group-hover:opacity-100"
              @click.stop.prevent="deleteCompose(c)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4" />
            </Button>
          </div>

          <div class="relative mt-auto flex min-h-7 items-center justify-between pt-4 text-sm">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="statusColor(c.status)"
            >
              {{ c.status }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ lastDeployText(c) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <ProjectCreateComposeSheet
      v-model:open="createOpen"
      :server-id="props.serverId"
      :project-id="props.projectId"
      @created="onCreated"
    />
  </div>
</template>

<style scoped>
/*
  Hover-fill for the icon block, matching the project/database/app
  cards. Single theme primary tone keeps the four workload grids
  visually unified.
*/
.group:hover .brand-icon-bg {
  background-color: hsl(var(--primary));
}

.group:hover .brand-icon {
  color: hsl(var(--primary-foreground));
}
</style>

<script setup lang="ts">
import { toast } from "vue-sonner";
import { dockerService, type DockerCompose } from "~/services/dockerService";

interface Props {
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();
const { t } = useI18n();

const composes = ref<DockerCompose[]>([]);
const isLoading = ref(true);

// Shared with the navbar "+ New Compose Stack" button — see
// components/layout/Navbar.vue.
const createOpen = useState<boolean>("dockerCreateComposeOpen", () => false);

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchComposes = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.composes.list(
      props.serverId,
      props.projectId,
    );
    composes.value = res.data;
  } catch {
    toast.error(t("workload.project.composes.loadFailed"));
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
    title: t("workload.compose.delete.title"),
    description: t("workload.compose.delete.listDescription", { name: c.name }),
    confirmText: t("workload.actions.delete"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    inputVerificationText: c.name,
    helpText: t("workload.compose.delete.confirmHelp"),
  });
  if (!result.ok) return;
  try {
    await dockerService.composes.delete(props.serverId, props.projectId, c.id);
    composes.value = composes.value.filter((x) => x.id !== c.id);
    toast.success(t("workload.compose.delete.success"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.compose.delete.failed"));
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
  return t("workload.sources.inlineYaml");
};

// Static fallback for compose rows that don't have a successful
// deploy timestamp to render. The deployed-timestamp branch lives
// in the template directly so it can use SharedDateTooltip (live
// "Deployed 3 minutes ago" with browser-TZ tooltip). Same shape as
// components/project/Applications.vue#lastDeployFallback.
const lastDeployFallback = (c: DockerCompose): string | null => {
  if (c.last_deployed_at) return null;
  if (c.status === "building") return t("workload.status.deploying");
  if (c.status === "failed") return t("workload.status.lastDeployFailed");
  return t("workload.status.neverDeployed");
};

const statusLabel = (status: string) => t(`workload.status.${status}`, status);

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
      <h2 class="text-xl font-semibold">
        {{ t("workload.project.composes.title") }}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ t("workload.project.composes.descriptionBefore") }}
        <code>docker compose up</code>{{ t("workload.punctuation.period") }}
        {{ t("workload.project.composes.descriptionAfter") }}
      </p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="composes.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:layers" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">
        {{ t("workload.project.composes.emptyTitle") }}
      </h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {{ t("workload.project.composes.emptyBefore") }}
        <code>docker-compose.yml</code>
        {{ t("workload.project.composes.emptyAfter") }}
      </p>
      <Button class="mt-6" @click="createOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("workload.project.composes.new") }}
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
                  :title="t('workload.githubActions.buildsRunThere')"
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

          <div
            class="relative mt-auto flex min-h-7 items-center justify-between pt-4 text-sm"
          >
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="statusColor(c.status)"
            >
              {{ statusLabel(c.status) }}
            </span>
            <span class="text-xs text-muted-foreground">
              <template v-if="c.last_deployed_at">
                {{ t("workload.status.deployed") }}&nbsp;<SharedDateTooltip
                  :date="c.last_deployed_at"
                />
              </template>
              <template v-else>
                {{ lastDeployFallback(c) }}
              </template>
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

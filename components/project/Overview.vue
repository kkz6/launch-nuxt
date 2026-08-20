<script setup lang="ts">
import {
  dockerService,
  type DockerApplication,
  type DockerCompose,
  type DockerDatabase,
  type DockerProject,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  project: DockerProject;
}
const props = defineProps<Props>();
const { t } = useI18n();

// Per-workload lists live here so the Overview can show status
// breakdowns + recent-activity without hitting a project-wide
// aggregate endpoint. Same WS subscriptions the list pages use keep
// this fresh — sibling Applications/Composes/Databases tabs already
// listen for the same events.
const applications = ref<DockerApplication[]>([]);
const composes = ref<DockerCompose[]>([]);
const databases = ref<DockerDatabase[]>([]);
const isLoading = ref(true);

const fetchAll = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const [apps, comps, dbs] = await Promise.all([
      dockerService.applications.list(props.serverId, props.project.id),
      dockerService.composes.list(props.serverId, props.project.id),
      dockerService.databases.list(props.serverId, props.project.id),
    ]);
    applications.value = apps.data;
    composes.value = comps.data;
    databases.value = dbs.data;
  } finally {
    isLoading.value = false;
  }
};

// Each kind's "running / building / failed / stopped / idle" counts.
// Shared shape so the breakdown lines render identically across the
// three cards regardless of workload type.
interface StatusBreakdown {
  running: number;
  building: number;
  failed: number;
  stopped: number;
  idle: number;
}
const emptyBreakdown = (): StatusBreakdown => ({
  running: 0,
  building: 0,
  failed: 0,
  stopped: 0,
  idle: 0,
});
const breakdownFor = (rows: { status: string }[]): StatusBreakdown => {
  const out = emptyBreakdown();
  for (const r of rows) {
    if (r.status === "running") out.running++;
    else if (r.status === "building") out.building++;
    else if (r.status === "failed") out.failed++;
    else if (r.status === "stopped") out.stopped++;
    else out.idle++;
  }
  return out;
};

const applicationsBreakdown = computed(() => breakdownFor(applications.value));
const composesBreakdown = computed(() => breakdownFor(composes.value));
const databasesBreakdown = computed(() => breakdownFor(databases.value));

const totalWorkloads = computed(
  () =>
    applications.value.length + composes.value.length + databases.value.length,
);

const hasAny = computed(() => totalWorkloads.value > 0);

// Most recent deploy across all workloads — pulled from the
// last_deployed_at fields on each list item. Used as the "Last
// activity" card's value.
const lastDeploy = computed(() => {
  const dates: number[] = [];
  for (const a of applications.value)
    if (a.last_deployed_at) dates.push(Date.parse(a.last_deployed_at));
  for (const c of composes.value)
    if (c.last_deployed_at) dates.push(Date.parse(c.last_deployed_at));
  if (!dates.length) return null;
  return new Date(Math.max(...dates));
});

// Combined "recent activity" feed: every workload + its
// last_deployed_at (or last status change). Sort desc by date and
// take top 6.
interface Activity {
  id: string;
  kind: "application" | "compose" | "database";
  name: string;
  status: string;
  icon: string;
  to: string;
  timestamp: string | null;
}
const recentActivity = computed<Activity[]>(() => {
  const rows: Activity[] = [];
  for (const a of applications.value) {
    rows.push({
      id: a.id,
      kind: "application",
      name: a.name,
      status: a.status,
      // A docker application is a container workload — show the app icon,
      // not its source-control icon (a git-sourced app is still an app,
      // not a repo). Matches the section header + empty-state icon.
      icon: "lucide:box",
      to: `/servers/${props.serverId}/projects/${props.project.id}/applications/${a.id}`,
      timestamp: a.last_deployed_at ?? a.updated_at ?? a.created_at ?? null,
    });
  }
  for (const c of composes.value) {
    rows.push({
      id: c.id,
      kind: "compose",
      name: c.name,
      status: c.status,
      icon: "lucide:layers",
      to: `/servers/${props.serverId}/projects/${props.project.id}/composes/${c.id}`,
      timestamp: c.last_deployed_at ?? c.updated_at ?? c.created_at ?? null,
    });
  }
  for (const d of databases.value) {
    rows.push({
      id: d.id,
      kind: "database",
      name: d.name,
      status: d.status,
      icon: engineIcon(d.engine),
      to: `/servers/${props.serverId}/projects/${props.project.id}/databases/${d.id}`,
      timestamp: d.updated_at ?? d.created_at ?? null,
    });
  }
  rows.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });
  return rows.slice(0, 6);
});

function engineIcon(engine: string): string {
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
}

const statusBadgeClass = (status: string): string => {
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

const statusLabel = (status: string) => t(`workload.status.${status}`, status);
const kindLabel = (kind: Activity["kind"]) => t(`workload.kind.${kind}`, kind);

// formatDate + relative used to live here as one-off helpers. Both
// got replaced by SharedDateTooltip — it ticks via useNow(), shows
// the absolute time in the browser's TZ in a hover tooltip, and
// handles the same edge cases (null, invalid, future) consistently
// across every place that renders a timestamp.

// WS subscriptions so the overview reflects state changes from the
// other tabs without polling. Filtered to this project so a sibling
// project's events don't refetch us.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerApplicationEvents(teamId, (data) => {
  if (data.project_id && data.project_id !== props.project.id) return;
  void fetchAll(true);
});
useDockerComposeEvents(teamId, (data) => {
  if (data.project_id && data.project_id !== props.project.id) return;
  void fetchAll(true);
});
const channel = computed(() => `team.${teamId.value}`);
useChannelEvents(
  channel,
  [
    "docker.database.created",
    "docker.database.starting",
    "docker.database.running",
    "docker.database.failed",
    "docker.database.lifecycle_done",
    "docker.database.deleted",
  ],
  (data) => {
    if (data.project_id && data.project_id !== props.project.id) return;
    void fetchAll(true);
  },
);

onMounted(fetchAll);
</script>

<template>
  <div class="space-y-6">
    <!--
      Top header — same shape SiteOverview uses ("Site Details" +
      grid of info cards). We use a single h3, then a four-up info
      grid with kind-specific colour tints to make the page feel
      anchored and scannable.
    -->
    <div>
      <h3 class="mb-4 text-lg font-semibold">
        {{ t("workload.project.overview.title") }}
      </h3>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Applications -->
        <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"
          >
            <Icon name="lucide:box" class="h-5 w-5 text-blue-500" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">
              {{ t("workload.kind.applications") }}
            </p>
            <p class="text-2xl font-semibold leading-tight text-foreground">
              {{ applications.length }}
            </p>
            <p
              v-if="applications.length"
              class="mt-1 text-xs text-muted-foreground"
            >
              <span
                v-if="applicationsBreakdown.running"
                class="text-emerald-600 dark:text-emerald-400"
              >
                {{
                  t("workload.project.overview.runningCount", {
                    count: applicationsBreakdown.running,
                  })
                }}
              </span>
              <span
                v-if="applicationsBreakdown.failed"
                class="text-rose-600 dark:text-rose-400"
              >
                <span v-if="applicationsBreakdown.running"> · </span>
                {{
                  t("workload.project.overview.failedCount", {
                    count: applicationsBreakdown.failed,
                  })
                }}
              </span>
              <span
                v-if="
                  applicationsBreakdown.idle ||
                  applicationsBreakdown.building ||
                  applicationsBreakdown.stopped
                "
                class="text-muted-foreground"
              >
                <span
                  v-if="
                    applicationsBreakdown.running ||
                    applicationsBreakdown.failed
                  "
                >
                  ·
                </span>
                {{
                  applicationsBreakdown.idle +
                  applicationsBreakdown.building +
                  applicationsBreakdown.stopped
                }}
                {{ t("workload.project.overview.other") }}
              </span>
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">
              {{ t("workload.project.overview.noneYet") }}
            </p>
          </div>
        </div>

        <!-- Compose stacks -->
        <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"
          >
            <Icon name="lucide:layers" class="h-5 w-5 text-violet-500" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">
              {{ t("workload.kind.composeStacks") }}
            </p>
            <p class="text-2xl font-semibold leading-tight text-foreground">
              {{ composes.length }}
            </p>
            <p
              v-if="composes.length"
              class="mt-1 text-xs text-muted-foreground"
            >
              <span
                v-if="composesBreakdown.running"
                class="text-emerald-600 dark:text-emerald-400"
              >
                {{
                  t("workload.project.overview.runningCount", {
                    count: composesBreakdown.running,
                  })
                }}
              </span>
              <span
                v-if="composesBreakdown.failed"
                class="text-rose-600 dark:text-rose-400"
              >
                <span v-if="composesBreakdown.running"> · </span>
                {{
                  t("workload.project.overview.failedCount", {
                    count: composesBreakdown.failed,
                  })
                }}
              </span>
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">
              {{ t("workload.project.overview.noneYet") }}
            </p>
          </div>
        </div>

        <!-- Databases -->
        <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10"
          >
            <Icon name="lucide:database" class="h-5 w-5 text-emerald-500" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">
              {{ t("workload.kind.databases") }}
            </p>
            <p class="text-2xl font-semibold leading-tight text-foreground">
              {{ databases.length }}
            </p>
            <p
              v-if="databases.length"
              class="mt-1 text-xs text-muted-foreground"
            >
              <span
                v-if="databasesBreakdown.running"
                class="text-emerald-600 dark:text-emerald-400"
              >
                {{
                  t("workload.project.overview.runningCount", {
                    count: databasesBreakdown.running,
                  })
                }}
              </span>
              <span
                v-if="databasesBreakdown.failed"
                class="text-rose-600 dark:text-rose-400"
              >
                <span v-if="databasesBreakdown.running"> · </span>
                {{
                  t("workload.project.overview.failedCount", {
                    count: databasesBreakdown.failed,
                  })
                }}
              </span>
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">
              {{ t("workload.project.overview.noneYet") }}
            </p>
          </div>
        </div>

        <!-- Last activity -->
        <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10"
          >
            <Icon name="lucide:activity" class="h-5 w-5 text-orange-500" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">
              {{ t("workload.project.overview.lastDeploy") }}
            </p>
            <p class="text-2xl font-semibold leading-tight text-foreground">
              <SharedDateTooltip
                v-if="lastDeploy"
                :date="lastDeploy.toISOString()"
              />
              <span v-else>—</span>
            </p>
            <!--
              No "Created" subtext here anymore — the project's
              creation date doesn't belong as a footnote on the
              "Last deploy" card; the labels said two different
              things ("Last deploy" / "Created") on the same card,
              which read like a contradiction at a glance. Project
              age is now an inline note next to the project name in
              the header above, where it's clearly about the
              project itself.
            -->
          </div>
        </div>
      </div>
    </div>

    <!--
      Recent activity / workloads list. When the project has any
      workloads we show the top 6 sorted by last touch; otherwise we
      surface a friendly empty state with a path to the create
      affordances (in the navbar).
    -->
    <div v-if="isLoading" class="rounded-lg border bg-card p-8">
      <div class="flex items-center justify-center">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>
    </div>

    <div v-else-if="hasAny" class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h3 class="text-sm font-semibold">
            {{ t("workload.project.overview.recentActivity") }}
          </h3>
          <p class="text-xs text-muted-foreground">
            {{ t("workload.project.overview.recentDescription") }}
          </p>
        </div>
      </div>
      <ul class="divide-y">
        <li v-for="row in recentActivity" :key="`${row.kind}:${row.id}`">
          <NuxtLink
            :to="row.to"
            class="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
          >
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"
            >
              <Icon :name="row.icon" class="h-4 w-4 text-muted-foreground" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium">{{ row.name }}</p>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                  :class="statusBadgeClass(row.status)"
                >
                  {{ statusLabel(row.status) }}
                </span>
              </div>
              <p
                class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
              >
                <span class="capitalize">{{ kindLabel(row.kind) }}</span>
                <template v-if="row.timestamp">
                  <span>·</span>
                  <SharedDateTooltip :date="row.timestamp" />
                </template>
              </p>
            </div>
            <Icon
              name="lucide:chevron-right"
              class="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </NuxtLink>
        </li>
      </ul>
    </div>

    <!--
      Empty state — same shape Site Overview uses when the page would
      otherwise be sparse. Three icon-bg cards point the user at each
      workload kind; the actual "+ New" trigger lives in the navbar.
    -->
    <div v-else class="rounded-lg border bg-card p-10">
      <div class="mx-auto max-w-2xl text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted"
        >
          <Icon name="lucide:rocket" class="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 class="mt-4 text-lg font-semibold">
          {{ t("workload.project.overview.emptyTitle") }}
        </h3>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t("workload.project.overview.emptyDescription") }}
        </p>
      </div>
      <div class="mt-6 grid gap-3 sm:grid-cols-3">
        <div class="flex items-start gap-3 rounded-md border p-4">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"
          >
            <Icon name="lucide:box" class="h-4 w-4 text-blue-500" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ t("workload.kind.applications") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.project.overview.applicationsDescription") }}
            </p>
          </div>
        </div>
        <div class="flex items-start gap-3 rounded-md border p-4">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"
          >
            <Icon name="lucide:layers" class="h-4 w-4 text-violet-500" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ t("workload.kind.compose") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.project.overview.composeDescriptionBefore") }}
              <code>docker compose up</code
              >{{ t("workload.punctuation.period") }}
            </p>
          </div>
        </div>
        <div class="flex items-start gap-3 rounded-md border p-4">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10"
          >
            <Icon name="lucide:database" class="h-4 w-4 text-emerald-500" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ t("workload.kind.databases") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.project.overview.databasesDescription") }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

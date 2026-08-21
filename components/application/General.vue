<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerDeployment,
  type DockerDomain,
  type DockerSchedule,
} from "~/services/dockerService";
import { getDeploymentReliability } from "~/utils/operationalInsights";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const route = useRoute();
const { t, locale } = useI18n();
const dateLocale = computed(() => (locale.value === "ja" ? "ja-JP" : "en-US"));

const deployments = ref<DockerDeployment[] | null>(null);
const domains = ref<DockerDomain[] | null>(null);
const schedules = ref<DockerSchedule[] | null>(null);
const isSummaryLoading = ref(true);

const subtabLink = (subtab: string) => ({
  path: route.path,
  query: { ...route.query, subtab },
});

const fetchOperationalSummary = async (silent = false) => {
  if (!silent) isSummaryLoading.value = true;
  const args = [
    props.application.server_id,
    props.application.project_id,
    props.application.id,
  ] as const;
  const [deploymentResult, domainResult, scheduleResult] =
    await Promise.allSettled([
      dockerService.applications.listDeployments(...args),
      dockerService.applications.listDomains(...args),
      dockerService.applications.listSchedules(...args),
    ]);

  deployments.value =
    deploymentResult.status === "fulfilled"
      ? deploymentResult.value.data
      : null;
  domains.value =
    domainResult.status === "fulfilled" ? domainResult.value.data : null;
  schedules.value =
    scheduleResult.status === "fulfilled" ? scheduleResult.value.data : null;
  isSummaryLoading.value = false;
};

const sortedDeployments = computed(() =>
  [...(deployments.value ?? [])].sort((a, b) => {
    const aTime = new Date(a.created_at || a.started_at || 0).getTime();
    const bTime = new Date(b.created_at || b.started_at || 0).getTime();
    return bTime - aTime;
  }),
);
const latestDeployment = computed(() => sortedDeployments.value[0] ?? null);
const recentDeployments = computed(() => sortedDeployments.value.slice(0, 3));
const reliability = computed(() =>
  getDeploymentReliability(sortedDeployments.value),
);

const secureDomainCount = computed(
  () => domains.value?.filter((domain) => domain.https).length ?? 0,
);
const enabledScheduleCount = computed(
  () => schedules.value?.filter((schedule) => schedule.enabled).length ?? 0,
);
const failedScheduleCount = computed(
  () =>
    schedules.value?.filter(
      (schedule) =>
        schedule.enabled &&
        ["failed", "error", "errored"].includes(
          (schedule.last_status || "").toLowerCase(),
        ),
    ).length ?? 0,
);

const operationalMessage = computed(() => {
  switch (props.application.status) {
    case "running":
      if (domains.value === null)
        return t("workload.application.general.operational.running");
      return domains.value.length > 0
        ? t("workload.application.general.operational.runningPublic", {
            count: domains.value.length,
          })
        : t("workload.application.general.operational.runningInternal");
    case "building":
      return t("workload.application.general.operational.building");
    case "failed":
      return t("workload.application.general.operational.failed");
    case "stopped":
      return t("workload.application.general.operational.stopped");
    case "idle":
      return t("workload.application.general.operational.idle");
    case "deleting":
      return t("workload.application.general.operational.deleting");
    default:
      return t("workload.application.general.operational.reconciling");
  }
});

const operationalAction = computed(() => {
  if (props.application.status === "failed") {
    return {
      label: t("workload.application.general.operational.reviewDeployment"),
      subtab: "deployments",
    };
  }
  if (props.application.status === "running" && domains.value?.length === 0) {
    return {
      label: t("workload.application.general.operational.addDomain"),
      subtab: "domains",
    };
  }
  if (props.application.status === "idle") {
    return {
      label: t("workload.application.general.operational.deployApplication"),
      subtab: "deployments",
    };
  }
  if (props.application.gha_out_of_sync) {
    return {
      label: t("workload.application.general.operational.reviewPendingChanges"),
      subtab: "environment",
    };
  }
  return null;
});

const sourceCfg = computed(
  () => (props.application.source_config ?? {}) as Record<string, unknown>,
);
const imageRef = computed(() => sourceCfg.value.image as string | undefined);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);
const dockerfileContents = computed(
  () => sourceCfg.value.contents as string | undefined,
);

const buildConfig = computed(
  () => (props.application.build_config ?? {}) as Record<string, unknown>,
);
const dockerfilePath = computed(
  () => buildConfig.value.dockerfile_path as string | undefined,
);

const sourceLabel = computed(() => {
  switch (props.application.source_type) {
    case "image":
      return t("workload.sources.dockerImage");
    case "git":
      return t("workload.sources.gitRepository");
    case "dockerfile":
      return t("workload.sources.dockerfile");
    default:
      return props.application.source_type;
  }
});
const buildLocationLabel = computed(() =>
  props.application.build_location === "github_actions"
    ? t("workload.githubActions.title")
    : t("workload.application.general.onServer"),
);

const formatShort = (iso?: string | null) => {
  if (!iso) return t("workload.application.general.never");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(dateLocale.value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(dateLocale.value);
};
const formatDuration = (deployment: DockerDeployment) => {
  if (!deployment.started_at || !deployment.finished_at) return "—";
  const milliseconds =
    new Date(deployment.finished_at).getTime() -
    new Date(deployment.started_at).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};
const titleCase = (value?: string | null) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const triggerLabel = (deployment: DockerDeployment) => {
  switch (deployment.trigger_source) {
    case "github_actions":
      return t("workload.githubActions.title");
    case "auto":
      return t("workload.application.general.operational.autoDeploy");
    default:
      return t("workload.application.general.operational.manual");
  }
};
const statusLabel = (status: string) => t(`workload.status.${status}`, status);
const pendingChangesLabel = computed(() => {
  const count = props.application.gha_pending_changes;
  if (!count) {
    return t(
      "workload.application.general.operational.ghaPendingChangesUnknown",
    );
  }
  return t("workload.application.general.operational.ghaPendingChanges", {
    count,
  });
});

const deploymentReference = (deployment: DockerDeployment) => {
  if (deployment.commit_msg) return deployment.commit_msg;
  if (deployment.commit_sha) return deployment.commit_sha.slice(0, 8);
  if (deployment.image_ref) return deployment.image_ref;
  return t("workload.application.general.operational.deployment");
};

const buildValue = computed(() => {
  if (props.application.source_type === "image")
    return t("workload.application.general.prebuiltImage");
  return (
    titleCase(props.application.build_type) ||
    t("workload.application.general.autoDetect")
  );
});

const redactRepository = (value: string) => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/token|key|secret|password|credential/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return value.replace(/:\/\/[^/@\s]+@/, "://");
  }
};

const details = computed(() => {
  const rows: {
    label: string;
    value: string;
    mono?: boolean;
    copy?: string;
  }[] = [
    { label: t("workload.fields.source"), value: sourceLabel.value },
    { label: t("workload.fields.build"), value: buildValue.value },
    {
      label: t("workload.application.general.buildRuns"),
      value: buildLocationLabel.value,
    },
    {
      label: t("workload.fields.internalPort"),
      value: String(props.application.internal_port ?? "—"),
      mono: true,
    },
  ];
  if (props.application.source_type === "image" && imageRef.value) {
    rows.push({
      label: t("workload.fields.image"),
      value: imageRef.value,
      mono: true,
      copy: imageRef.value,
    });
  }
  if (props.application.source_type === "git") {
    if (gitRepo.value) {
      rows.push({
        label: t("workload.fields.repository"),
        value: redactRepository(gitRepo.value),
        mono: true,
        copy: gitRepo.value,
      });
    }
    if (gitBranch.value) {
      rows.push({
        label: t("workload.fields.branch"),
        value: gitBranch.value,
        mono: true,
      });
    }
  }
  if (dockerfilePath.value) {
    rows.push({
      label: t("workload.fields.dockerfilePath"),
      value: dockerfilePath.value,
      mono: true,
    });
  }
  if (props.application.container_name) {
    rows.push({
      label: t("workload.application.general.operational.container"),
      value: props.application.container_name,
      mono: true,
      copy: props.application.container_name,
    });
  }
  if (props.application.container_id) {
    rows.push({
      label: t("workload.fields.containerId"),
      value: props.application.container_id,
      mono: true,
      copy: props.application.container_id,
    });
  }
  rows.push({
    label: t("workload.fields.created"),
    value: formatDate(props.application.created_at),
  });
  return rows;
});

const copyValue = async (label: string, value?: string | null) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(
      t("workload.application.general.operational.copySuccess", { label }),
    );
  } catch {
    toast.error(
      t("workload.application.general.operational.copyFailed", { label }),
    );
  }
};

const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
let refetchTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleSummaryRefetch = () => {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => void fetchOperationalSummary(true), 350);
};
const eventBelongsToApplication = (data: Record<string, unknown>) =>
  data.application_id === props.application.id ||
  (data.target_type === "application" &&
    data.target_id === props.application.id);

useDockerApplicationEvents(teamId, (data) => {
  if (eventBelongsToApplication(data)) scheduleSummaryRefetch();
});
useDeploymentEvents(teamId, (data) => {
  if (eventBelongsToApplication(data)) scheduleSummaryRefetch();
});

onMounted(fetchOperationalSummary);
watch(
  () => props.application.id,
  (current, previous) => {
    if (previous && current !== previous) void fetchOperationalSummary();
  },
);
onUnmounted(() => {
  if (refetchTimer) clearTimeout(refetchTimer);
});
</script>

<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-lg font-semibold">
        {{ t("workload.application.general.title") }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ t("workload.application.general.operational.description") }}
      </p>
    </div>

    <section class="border-y">
      <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <span
            class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            :class="{
              'bg-emerald-500': application.status === 'running',
              'bg-amber-500 animate-pulse': application.status === 'building',
              'bg-rose-500': application.status === 'failed',
              'bg-muted-foreground/60': ![
                'running',
                'building',
                'failed',
              ].includes(application.status),
            }"
          />
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h4 class="text-sm font-semibold">{{ operationalMessage }}</h4>
              <DockerStatusIndicator
                :status="application.status"
                :label="statusLabel(application.status)"
              />
            </div>
            <p
              v-if="application.gha_out_of_sync"
              class="mt-1 text-[13px] text-amber-700 dark:text-amber-400"
            >
              {{ pendingChangesLabel }}
            </p>
            <p
              v-else-if="
                latestDeployment?.error && application.status === 'failed'
              "
              class="mt-1 truncate text-[13px] text-rose-700 dark:text-rose-400"
              :title="latestDeployment.error"
            >
              {{ latestDeployment.error }}
            </p>
          </div>
        </div>
        <NuxtLink
          v-if="operationalAction"
          :to="subtabLink(operationalAction.subtab)"
          class="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {{ operationalAction.label }}
          <Icon name="lucide:arrow-right" class="h-3.5 w-3.5" />
        </NuxtLink>
      </div>

      <div
        v-if="isSummaryLoading"
        class="grid border-t sm:grid-cols-2 lg:grid-cols-4"
      >
        <div v-for="index in 4" :key="index" class="px-4 py-4">
          <div class="h-3 w-24 animate-pulse bg-muted" />
          <div class="mt-3 h-5 w-32 animate-pulse bg-muted" />
        </div>
      </div>
      <div v-else class="grid border-t sm:grid-cols-2 lg:grid-cols-4">
        <div class="px-4 py-3 sm:border-r">
          <p class="text-xs font-medium text-muted-foreground">
            {{ t("workload.application.general.operational.latestDeployment") }}
          </p>
          <template v-if="deployments === null">
            <p class="mt-2 text-sm text-muted-foreground">
              {{ t("workload.application.general.operational.unavailable") }}
            </p>
          </template>
          <template v-else-if="latestDeployment">
            <div class="mt-2 flex items-center gap-2">
              <DockerStatusIndicator
                :status="latestDeployment.status"
                :label="statusLabel(latestDeployment.status)"
              />
              <span class="text-xs text-muted-foreground">
                {{ formatDuration(latestDeployment) }}
              </span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ formatShort(latestDeployment.created_at) }} ·
              {{ triggerLabel(latestDeployment) }}
            </p>
          </template>
          <p v-else class="mt-2 text-sm text-muted-foreground">
            {{ t("workload.application.general.operational.noDeployments") }}
          </p>
        </div>

        <div class="border-t px-4 py-3 sm:border-t-0 lg:border-r">
          <p class="text-xs font-medium text-muted-foreground">
            {{
              t(
                "workload.application.general.operational.deploymentReliability",
              )
            }}
          </p>
          <p
            v-if="deployments !== null && reliability.attempted > 0"
            class="mt-2 text-sm font-semibold tabular-nums"
          >
            {{
              t("workload.application.general.operational.succeeded", {
                successful: reliability.successful,
                attempted: reliability.attempted,
              })
            }}
          </p>
          <p v-else class="mt-2 text-sm text-muted-foreground">
            {{
              deployments === null
                ? t("workload.application.general.operational.unavailable")
                : t(
                    "workload.application.general.operational.noCompletedDeploys",
                  )
            }}
          </p>
          <p
            v-if="deployments !== null"
            class="mt-1 text-xs text-muted-foreground"
          >
            {{
              t("workload.application.general.operational.completedSummary", {
                count: Math.min(reliability.attempted, 10) || 0,
                failed: reliability.failed,
              })
            }}
          </p>
        </div>

        <div class="border-t px-4 py-3 sm:border-r lg:border-t-0">
          <p class="text-xs font-medium text-muted-foreground">
            {{ t("workload.application.general.operational.publicAccess") }}
          </p>
          <p v-if="domains !== null" class="mt-2 text-sm font-semibold">
            {{
              t("workload.application.general.operational.endpointCount", {
                count: domains.length,
              })
            }}
          </p>
          <p v-else class="mt-2 text-sm text-muted-foreground">
            {{ t("workload.application.general.operational.unavailable") }}
          </p>
          <p v-if="domains !== null" class="mt-1 text-xs text-muted-foreground">
            {{
              t("workload.application.general.operational.httpsProtected", {
                count: secureDomainCount,
              })
            }}
          </p>
        </div>

        <div class="border-t px-4 py-3 lg:border-t-0">
          <p class="text-xs font-medium text-muted-foreground">
            {{ t("workload.application.general.operational.schedules") }}
          </p>
          <p v-if="schedules !== null" class="mt-2 text-sm font-semibold">
            {{
              t("workload.application.general.operational.enabledCount", {
                count: enabledScheduleCount,
              })
            }}
          </p>
          <p v-else class="mt-2 text-sm text-muted-foreground">
            {{ t("workload.application.general.operational.unavailable") }}
          </p>
          <p
            v-if="schedules !== null"
            class="mt-1 text-xs"
            :class="
              failedScheduleCount > 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-muted-foreground'
            "
          >
            {{
              t("workload.application.general.operational.failingCount", {
                count: failedScheduleCount,
              })
            }}
          </p>
        </div>
      </div>
    </section>

    <div
      class="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]"
    >
      <section class="min-w-0 space-y-3">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h4 class="text-sm font-semibold">
              {{ t("workload.application.general.operational.recentTitle") }}
            </h4>
            <p class="text-[13px] text-muted-foreground">
              {{
                t("workload.application.general.operational.recentDescription")
              }}
            </p>
          </div>
          <NuxtLink
            :to="subtabLink('deployments')"
            class="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            {{ t("workload.application.general.operational.viewAll") }}
          </NuxtLink>
        </div>
        <div class="border-y">
          <div
            v-if="isSummaryLoading"
            class="flex items-center justify-center py-10"
          >
            <Icon
              name="lucide:loader-2"
              class="h-5 w-5 animate-spin text-muted-foreground"
            />
          </div>
          <div
            v-else-if="deployments === null"
            class="px-4 py-8 text-center text-sm text-muted-foreground"
          >
            {{
              t("workload.application.general.operational.historyUnavailable")
            }}
          </div>
          <div
            v-else-if="recentDeployments.length === 0"
            class="px-4 py-8 text-center"
          >
            <p class="text-sm font-medium">
              {{ t("workload.application.general.operational.noHistoryTitle") }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{
                t(
                  "workload.application.general.operational.noHistoryDescription",
                )
              }}
            </p>
          </div>
          <template v-else>
            <NuxtLink
              v-for="deployment in recentDeployments"
              :key="deployment.id"
              :to="subtabLink('deployments')"
              class="grid gap-2 border-t px-4 py-3 first:border-t-0 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ deploymentReference(deployment) }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ triggerLabel(deployment) }} ·
                  {{ formatShort(deployment.created_at) }}
                </p>
              </div>
              <div class="flex items-center gap-3 sm:justify-end">
                <span class="text-xs tabular-nums text-muted-foreground">
                  {{ formatDuration(deployment) }}
                </span>
                <DockerStatusIndicator
                  :status="deployment.status"
                  :label="statusLabel(deployment.status)"
                />
              </div>
            </NuxtLink>
          </template>
        </div>
      </section>

      <section class="min-w-0 space-y-3">
        <div>
          <h4 class="text-sm font-semibold">
            {{ t("workload.application.general.operational.runtimeTitle") }}
          </h4>
          <p class="text-[13px] text-muted-foreground">
            {{
              t("workload.application.general.operational.runtimeDescription")
            }}
          </p>
        </div>
        <dl class="divide-y border-y">
          <div
            v-for="detail in details"
            :key="detail.label"
            class="flex items-baseline gap-4 px-3 py-2.5"
          >
            <dt class="w-28 shrink-0 text-xs text-muted-foreground">
              {{ detail.label }}
            </dt>
            <dd class="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                class="truncate text-xs font-medium"
                :class="detail.mono ? 'font-mono' : ''"
                :title="detail.value"
              >
                {{ detail.value }}
              </span>
              <button
                v-if="detail.copy"
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                :title="t('workload.actions.copy')"
                @click="copyValue(detail.label, detail.copy)"
              >
                <Icon name="lucide:copy" class="h-3.5 w-3.5" />
              </button>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <section
      v-if="application.source_type === 'dockerfile' && dockerfileContents"
      class="space-y-3"
    >
      <div>
        <h4 class="text-sm font-semibold">
          {{ t("workload.sources.dockerfile") }}
        </h4>
        <p class="text-[13px] text-muted-foreground">
          {{
            t("workload.application.general.operational.dockerfileSnapshotHelp")
          }}
        </p>
      </div>
      <pre
        class="max-h-72 overflow-auto border-y bg-muted/20 p-4 font-mono text-[13px] leading-relaxed"
        >{{ dockerfileContents }}</pre
      >
    </section>
  </div>
</template>

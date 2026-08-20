<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";
import type { Server } from "~/types";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const applicationId = computed(() => route.params.applicationId as string);

const app = ref<DockerApplication | null>(null);
const isLoading = ref(true);

// Canonical order — must match the same sequence in
// components/layout/Navbar.vue applicationSubTabs. See that file's
// top-of-file comment for the canonical workload tab ordering.
// `gha` only appears when the workload is actually GHA-backed —
// declared in the canonical list so navbar / order stays consistent,
// but filtered out of the rendered subtab strip by `visibleSubtabs`
// below for server-side builds. (Show: SUBTABS, Render: visibleSubtabs.)
const SUBTAB_DEFINITIONS = [
  { value: "general", labelKey: "overview", icon: "lucide:layout-dashboard" },
  { value: "deployments", labelKey: "deployments", icon: "lucide:git-branch" },
  { value: "environment", labelKey: "environment", icon: "lucide:key" },
  { value: "domains", labelKey: "domains", icon: "lucide:globe" },
  { value: "redirects", labelKey: "redirects", icon: "lucide:corner-up-right" },
  { value: "schedules", labelKey: "schedules", icon: "lucide:clock" },
  { value: "logs", labelKey: "logs", icon: "lucide:scroll" },
  {
    value: "advanced",
    labelKey: "advanced",
    icon: "lucide:sliders-horizontal",
  },
] as const;
type SubTabId = (typeof SUBTAB_DEFINITIONS)[number]["value"];
const SUBTABS = computed(() =>
  SUBTAB_DEFINITIONS.map(({ labelKey, ...subtab }) => ({
    ...subtab,
    label: t(`server.workloadTabs.${labelKey}`),
  })),
);

// Read straight from the URL — navbar subtab links are the source of
// truth. Setting via `setSubTab` updates the URL; everything else
// follows from the computed reading route.query.subtab.
const validIds = SUBTAB_DEFINITIONS.map((s) => s.value);
const subTab = computed<SubTabId>(() => {
  const q = route.query.subtab as string | undefined;
  return q && (validIds as readonly string[]).includes(q)
    ? (q as SubTabId)
    : "general";
});
const setSubTab = (v: SubTabId) => {
  router.replace({ query: { ...route.query, subtab: v } });
};

// Header-level "Deploy" button. Flip subtab to Deployments after kick-off
// so the user lands on the live history table.
const isDeploying = ref(false);
const quickDeploy = async () => {
  if (!app.value) return;
  isDeploying.value = true;
  try {
    await dockerService.applications.deploy(
      app.value.server_id,
      app.value.project_id,
      app.value.id,
    );
    setSubTab("deployments");
    toast.success(t("server.workload.deploymentStarted"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("server.workload.deploymentStartFailed"));
  } finally {
    isDeploying.value = false;
  }
};

// Reload from the route — keeps the back-button working when navigating
// between sibling applications.
const fetchApp = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.get(
      serverId.value,
      projectId.value,
      applicationId.value,
    );
    app.value = res.data;
    useHead({ title: app.value.name });
  } catch {
    toast.error(t("server.workload.applicationNotFound"));
    navigateTo(
      `/servers/${serverId.value}/projects/${projectId.value}?tab=applications`,
    );
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchApp);

// Server fetch + Terminal mount — see databases/[databaseId]/index.vue
// for the same pattern. Required so the navbar's Terminal button has
// somewhere to render the bottom pane.
const server = ref<Server | null>(null);
const isTerminalOpen = useState("serverTerminalOpen", () => false);
const loadServer = async () => {
  try {
    const res = await $api<{ data: Server }>(`/servers/${serverId.value}`);
    server.value = res.data;
  } catch {
    server.value = null;
  }
};
onMounted(loadServer);

// Subtabs that have a real implementation in phase 2b/2c. The rest
// still render the ComingSoon placeholder until later slices fill them
// in. Bump entries as each subtab goes live so the routing here stays
// a single source of truth.
const READY_SUBTABS: Record<string, boolean> = {
  general: true,
  deployments: true,
  domains: true,
  logs: true,
  environment: true,
  schedules: true,
  advanced: true,
};

// Every subtab renders for every app now. The GitHub Actions settings
// panel moved into the Advanced tab (shown there only for
// github_actions builds) and build-time secrets moved to the
// Environment tab — so there's no longer a GHA-only subtab to hide.
const visibleSubtabs = computed(() => SUBTABS.value);
// Expose to a child <Navbar> or layout in future; for now the local
// SUBTABS array drives the strip via the layout's slot.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _exposedSubtabs = visibleSubtabs;

// Refetch the application when WS events tell us its status changed —
// the header status badge stays accurate without a manual refresh.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

useDockerApplicationEvents(teamId, (data, event) => {
  if (data.application_id !== applicationId.value) return;
  // Status fields live on the application row; the Deployments tab
  // owns deployment-history refetches.
  if (
    data.status === "running" ||
    data.status === "failed" ||
    data.status === "building" ||
    data.status === "stopped"
  ) {
    void fetchApp();
    return;
  }
  // GHA sync state (out-of-sync banner, synced/broken/disabled) all
  // live on the application row's source_config — refetch so the
  // Environment Build-time banner + Advanced GHA card stay current.
  if (
    event === "docker.application.gha_out_of_sync" ||
    event === "docker.application.gha_synced" ||
    event === "docker.application.gha_install_broken" ||
    event === "docker.application.gha_disabled"
  ) {
    void fetchApp();
  }
});
</script>

<template>
  <div class="space-y-6 pb-10">
    <!--
      No on-page header — name + status are in the navbar breadcrumb.
      Deploy button lives on the Deployments subtab.
    -->

    <!--
      Content body waits on `app` so child components don't receive a
      null prop. Skeleton card mirrors the eventual layout so the
      page doesn't jump when data arrives.
    -->
    <div
      v-if="!app"
      class="flex items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <ApplicationGeneral
      v-else-if="subTab === 'general'"
      :application="app"
      @updated="fetchApp"
    />

    <ApplicationDeployments
      v-else-if="subTab === 'deployments'"
      :application="app"
    />

    <ApplicationDomains v-else-if="subTab === 'domains'" :application="app" />

    <ApplicationRedirects
      v-else-if="subTab === 'redirects'"
      :application="app"
    />

    <ApplicationEnvironment
      v-else-if="subTab === 'environment'"
      :application="app"
    />

    <ApplicationSchedules
      v-else-if="subTab === 'schedules'"
      :application="app"
    />

    <ApplicationAdvanced
      v-else-if="subTab === 'advanced'"
      :application="app"
      @updated="fetchApp"
      @deleted="
        navigateTo(
          `/servers/${serverId}/projects/${projectId}?tab=applications`,
        )
      "
    />

    <ApplicationLogs v-else-if="subTab === 'logs'" :application="app" />

    <ServerDockerComingSoon
      v-else-if="!READY_SUBTABS[subTab]"
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      :description="t('server.workload.applicationComingSoon')"
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />

    <!--
      Bottom Terminal pane — `container` switches the WS handler to
      `docker exec -it <container> sh` so the shell opens INSIDE the
      application container, not on the host root.
    -->
    <ServerTerminalBottom
      v-if="server && server.connected"
      :server="server"
      :is-open="isTerminalOpen"
      :container="app?.container_name || ''"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";
import type { Server } from "~/types";

definePageMeta({
  layout: "default",
  middleware: ["auth"],
});

const route = useRoute();
const router = useRouter();
const serverId = computed(() => route.params.id as string);
const projectId = computed(() => route.params.projectId as string);
const composeId = computed(() => route.params.composeId as string);

const compose = ref<DockerCompose | null>(null);
const isLoading = ref(true);
const isDeploying = ref(false);

// Compose subtabs mirror the application's where the concept maps
// 1:1 at the stack level. Per-service tabs (Domains, Redirects,
// Volumes, Schedulers) are deliberately skipped — the YAML owns
// those, and surfacing a service picker for each of them is its
// own slice. Logs gets a service picker inside the component since
// every compose stack has multiple containers.
const SUBTABS = [
  { value: "general", label: "General", icon: "lucide:info" },
  { value: "deployments", label: "Deployments", icon: "lucide:git-branch" },
  { value: "environment", label: "Environment", icon: "lucide:key" },
  { value: "logs", label: "Logs", icon: "lucide:scroll" },
  { value: "advanced", label: "Advanced", icon: "lucide:sliders-horizontal" },
] as const;
type SubTabId = (typeof SUBTABS)[number]["value"];

// Kept for parity with the application/database detail pages — every
// subtab in the SUBTABS list is "ready" here because unready ones
// don't appear at all.
const READY_SUBTABS: Record<string, boolean> = {
  general: true,
  deployments: true,
  environment: true,
  logs: true,
  advanced: true,
};

// Read straight from the URL — navbar subtab links are the source of
// truth. setSubTab updates the URL; the computed reacts.
const validIds = SUBTABS.map((s) => s.value);
const subTab = computed<SubTabId>(() => {
  const q = route.query.subtab as string | undefined;
  return q && (validIds as readonly string[]).includes(q)
    ? (q as SubTabId)
    : "general";
});
const setSubTab = (v: SubTabId) => {
  router.replace({ query: { ...route.query, subtab: v } });
};

const fetchCompose = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.composes.get(
      serverId.value,
      projectId.value,
      composeId.value,
    );
    compose.value = res.data;
    useHead({ title: compose.value.name });
  } catch {
    toast.error("Compose stack not found");
    navigateTo(
      `/servers/${serverId.value}/projects/${projectId.value}?tab=compose`,
    );
  } finally {
    isLoading.value = false;
  }
};

const quickDeploy = async () => {
  if (!compose.value) return;
  isDeploying.value = true;
  try {
    await dockerService.composes.deploy(
      compose.value.server_id,
      compose.value.project_id,
      compose.value.id,
    );
    setSubTab("deployments");
    toast.success("Deployment started");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to start deployment");
  } finally {
    isDeploying.value = false;
  }
};

onMounted(fetchCompose);

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

const statusBadge = computed(() => {
  if (!compose.value) return "";
  switch (compose.value.status) {
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
</script>

<template>
  <!--
    Chrome renders immediately; only the per-subtab body waits on the
    `compose` ref. No inline back link — navbar breadcrumb handles
    the trail.
  -->
  <div class="space-y-6 pb-10">
    <!--
      No on-page header — name + status are in the navbar breadcrumb.
      Deploy button lives on the Deployments subtab.
    -->

    <!-- Content body waits on `compose` so children don't get null. -->
    <div
      v-if="!compose"
      class="flex items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <ComposeGeneral
      v-else-if="subTab === 'general'"
      :compose="compose"
      @updated="fetchCompose"
    />

    <ComposeDeployments
      v-else-if="subTab === 'deployments'"
      :compose="compose"
    />

    <ComposeEnvironment
      v-else-if="subTab === 'environment'"
      :compose="compose"
    />

    <ComposeLogs v-else-if="subTab === 'logs'" :compose="compose" />

    <ComposeAdvanced
      v-else-if="subTab === 'advanced'"
      :compose="compose"
      @updated="fetchCompose"
      @deleted="navigateTo(`/servers/${serverId}/projects/${projectId}?tab=compose`)"
    />

    <ServerDockerComingSoon
      v-else-if="!READY_SUBTABS[subTab]"
      :title="SUBTABS.find((s) => s.value === subTab)?.label ?? subTab"
      description="Compose subtab is per-service which needs its own design pass — landing in a future slice."
      :icon="SUBTABS.find((s) => s.value === subTab)?.icon ?? 'lucide:hammer'"
    />

    <!-- Bottom Terminal pane — opens via the navbar's Terminal button. -->
    <ServerTerminalBottom
      v-if="server && server.connected"
      :server="server"
      :is-open="isTerminalOpen"
      @close="isTerminalOpen = false"
    />
  </div>
</template>

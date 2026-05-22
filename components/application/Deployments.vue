<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerDeployment,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

const deployments = ref<DockerDeployment[]>([]);
const isLoading = ref(true);
const isDeploying = ref(false);

const fetchDeployments = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.applications.listDeployments(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    deployments.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load deployments");
  } finally {
    isLoading.value = false;
  }
};

const triggerDeploy = async () => {
  isDeploying.value = true;
  try {
    const res = await dockerService.applications.deploy(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    // Prepend the new pending row immediately — WS broadcasts will then
    // flip its status as the worker runs.
    deployments.value = [res.data, ...deployments.value];
    toast.success("Deployment started");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to start deployment");
  } finally {
    isDeploying.value = false;
  }
};

const expanded = ref<Set<string>>(new Set());
const toggle = (id: string) => {
  if (expanded.value.has(id)) {
    expanded.value.delete(id);
  } else {
    expanded.value.add(id);
  }
  // Vue 3 doesn't react to Set mutations — force a refresh by reassigning.
  expanded.value = new Set(expanded.value);
};

const statusBadge = (status: string): string => {
  switch (status) {
    case "success":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "pending":
    case "building":
    case "deploying":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "cancelled":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

const duration = (d: DockerDeployment): string => {
  if (!d.started_at) return "—";
  const start = new Date(d.started_at).getTime();
  const end = d.finished_at ? new Date(d.finished_at).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

// Subscribe to docker.application.* events so the table reflects worker
// progress without polling. Filter strictly on application_id so a sibling
// app's deploy doesn't refresh ours.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

useDockerApplicationEvents(teamId, (data) => {
  if (data.application_id !== props.application.id) return;
  // Cheap debounce: just refetch.
  fetchDeployments(true);
});

onMounted(fetchDeployments);
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Deployments</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Build + run history. Most recent first.
        </p>
      </div>
      <Button :disabled="isDeploying" @click="triggerDeploy">
        <Icon
          v-if="isDeploying"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:rocket" class="mr-2 h-4 w-4" />
        Deploy now
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="deployments.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:rocket" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No deployments yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Click <span class="font-medium">Deploy now</span> to pull the
        image and start the container on the server.
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Started</th>
            <th class="px-4 py-3">Duration</th>
            <th class="px-4 py-3">Image</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="d in deployments" :key="d.id">
            <tr class="border-t">
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                  :class="statusBadge(d.status)"
                >
                  {{ d.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ formatDate(d.started_at) }}
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                {{ duration(d) }}
              </td>
              <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
                {{ d.image_ref || "—" }}
              </td>
              <td class="px-4 py-3 text-right">
                <Button
                  v-if="d.error"
                  variant="ghost"
                  size="sm"
                  @click="toggle(d.id)"
                >
                  <Icon
                    :name="expanded.has(d.id) ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                    class="h-4 w-4"
                  />
                </Button>
              </td>
            </tr>
            <tr
              v-if="expanded.has(d.id) && d.error"
              class="border-t bg-muted/20"
            >
              <td colspan="5" class="px-4 py-3">
                <pre
                  class="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 font-mono text-xs"
                >{{ d.error }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

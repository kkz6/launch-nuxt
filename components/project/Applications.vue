<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerSourceType,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();

const apps = ref<DockerApplication[]>([]);
const isLoading = ref(true);

const createSheetOpen = ref(false);

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
  });
  if (!result.ok) return;
  try {
    await dockerService.applications.delete(
      props.serverId,
      props.projectId,
      app.id,
    );
    apps.value = apps.value.filter((a) => a.id !== app.id);
    toast.success("Application deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to delete application");
  }
};

const sourceIcon = (t: DockerSourceType): string => {
  switch (t) {
    case "image":
      return "simple-icons:docker";
    case "git":
      return "lucide:git-branch";
    case "dockerfile":
      return "lucide:file-code";
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

onMounted(fetchApps);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Applications</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Single-container workloads. Deploy from a public image, a git
          repo, or a pasted Dockerfile.
        </p>
      </div>
      <Button @click="createSheetOpen = true">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        New Application
      </Button>
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

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="app in apps"
        :key="app.id"
        :to="`/servers/${props.serverId}/projects/${props.projectId}/applications/${app.id}`"
        class="group block rounded-lg border bg-card p-5 transition hover:border-primary"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <Icon
                :name="sourceIcon(app.source_type)"
                class="h-4 w-4 text-muted-foreground"
              />
              <h3 class="truncate text-lg font-semibold group-hover:text-primary">
                {{ app.name }}
              </h3>
            </div>
            <p class="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {{ sourceSummary(app) }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="ml-2 shrink-0 opacity-0 transition group-hover:opacity-100"
            @click.prevent="deleteApp(app)"
          >
            <Icon name="lucide:trash-2" class="h-4 w-4" />
          </Button>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="statusColor(app.status)"
          >
            {{ app.status }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{
              app.last_deployed_at
                ? `Deployed ${relative(app.last_deployed_at)}`
                : "Never deployed"
            }}
          </span>
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

<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerEnvVar,
  type DockerBuildSecret,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

// Build secrets only apply when there's a build step (git / dockerfile
// source). Pre-built image apps never build, so the section is hidden.
const isBuildable = computed(() => props.application.source_type !== "image");
const isGHA = computed(
  () => props.application.build_location === "github_actions",
);

// ---- Runtime env vars (docker run -e) -------------------------------
// Thin wrapper around SharedEnvVarsEditor: owns the `vars` ref and the
// initial fetch; delegates UI + mutation flow to the editor.
const vars = ref<DockerEnvVar[]>([]);
const isLoading = ref(true);

const fetchVars = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.listEnvVars(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    vars.value = res.data;
  } catch {
    toast.error("Failed to load env vars");
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchVars);

const onCreate = async (data: { key: string; value: string; is_secret?: boolean }) => {
  const res = await dockerService.applications.createEnvVar(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    data,
  );
  return res.data;
};
const onUpdate = async (
  id: string,
  patch: { value?: string; is_secret?: boolean },
) => {
  const res = await dockerService.applications.updateEnvVar(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    id,
    patch,
  );
  return res.data;
};
const onDelete = async (id: string) => {
  await dockerService.applications.deleteEnvVar(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    id,
  );
};
const onSetBulk = async (
  rows: { key: string; value: string; is_secret?: boolean }[],
) => {
  const res = await dockerService.applications.setEnvVars(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    { vars: rows },
  );
  return res.data;
};
const onRestart = async () => {
  await dockerService.applications.lifecycle(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    "reload",
  );
};

// ---- Build-time secrets (docker build --mount=type=secret) ----------
// Write-only values; the API never echoes them back. On GHA apps these
// are pushed to GitHub Actions as LAUNCH_BUILD_<NAME> on the next
// workflow re-sync (see the banner below), not on every save.
const buildSecrets = ref<DockerBuildSecret[]>([]);
const isLoadingBuildSecrets = ref(true);

const fetchBuildSecrets = async () => {
  isLoadingBuildSecrets.value = true;
  try {
    const res = await dockerService.applications.listBuildSecrets(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    buildSecrets.value = res.data;
  } catch {
    toast.error("Failed to load build secrets");
  } finally {
    isLoadingBuildSecrets.value = false;
  }
};

onMounted(() => {
  if (isBuildable.value) void fetchBuildSecrets();
});

const onCreateBuildSecret = async (data: { name: string; value: string }) => {
  const res = await dockerService.applications.createBuildSecret(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    data,
  );
  return res.data;
};
const onUpdateBuildSecret = async (id: string, patch: { value: string }) => {
  const res = await dockerService.applications.updateBuildSecret(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    id,
    patch,
  );
  return res.data;
};
const onDeleteBuildSecret = async (id: string) => {
  await dockerService.applications.deleteBuildSecret(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    id,
  );
};

// ---- GHA "re-sync workflow" action (banner) -------------------------
// Build-secret edits no longer commit the workflow YAML on every save;
// they mark the workflow out-of-sync. The user pushes the changes
// explicitly here, which re-renders + commits the YAML and pushes the
// repo secrets in one go.
const isResyncing = ref(false);
const resyncWorkflow = async () => {
  isResyncing.value = true;
  try {
    await dockerService.applications.resyncGhaWorkflow(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    toast.success("Workflow re-sync queued");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to queue workflow re-sync");
  } finally {
    isResyncing.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Tab header — same title/subtitle pattern as Deployments,
         Redirects, Schedulers, etc. -->
    <div>
      <h3 class="text-lg font-semibold">Environment</h3>
      <p class="text-sm text-muted-foreground">
        Variables and secrets for this application, split by when they
        apply — runtime values are passed to the running container,
        build-time values are available only while the image builds.
      </p>
    </div>

    <!--
      GHA re-sync banner — pinned to the top of the tab so the "needs
      re-sync" state is the first thing seen. Build-secret edits mark
      the committed workflow + repo secrets stale; the user applies
      them explicitly via re-sync.
    -->
    <div
      v-if="isGHA && application.gha_out_of_sync"
      class="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-4 shadow-[0_1px_2px_rgba(17,17,26,0.04)] sm:flex-row sm:items-center sm:justify-between dark:bg-amber-500/[0.06]"
    >
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"
        >
          <Icon name="lucide:refresh-cw" class="h-4 w-4" />
        </div>
        <div class="min-w-0 space-y-0.5">
          <h4 class="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
            Workflow out of sync
          </h4>
          <p class="text-[13px] leading-relaxed text-amber-700/80 dark:text-amber-300/70">
            <span class="tabular-nums">{{ application.gha_pending_changes || 0 }}</span>
            pending {{ (application.gha_pending_changes || 0) === 1 ? "change" : "changes" }} —
            re-sync to push your build secrets and update the committed workflow file.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        :disabled="isResyncing"
        class="shrink-0 border-amber-500/40 bg-background/60 text-amber-800 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-200"
        @click="resyncWorkflow"
      >
        <Icon
          :name="isResyncing ? 'lucide:loader-2' : 'lucide:refresh-cw'"
          :class="['mr-1.5 h-4 w-4', isResyncing && 'animate-spin']"
        />
        Re-sync workflow
      </Button>
    </div>

    <!-- Runtime -->
    <SharedEnvVarsEditor
      :vars="vars"
      :loading="isLoading"
      :show-project-hint="true"
      :is-running="application.status === 'running'"
      :on-restart="onRestart"
      restart-label="Reload"
      title="Runtime environment"
      description="Env vars passed to the container as -e KEY=VALUE — available while it runs. Save, then Reload to apply (recreates the container, no rebuild)."
      :on-create="onCreate"
      :on-update="onUpdate"
      :on-delete="onDelete"
      :on-set-bulk="onSetBulk"
      @update:vars="(v) => (vars = v as unknown as DockerEnvVar[])"
    />

    <Separator v-if="isBuildable" />

    <!-- Build-time -->
    <section v-if="isBuildable" class="space-y-4">
      <SharedBuildSecretsEditor
        :secrets="buildSecrets"
        :loading="isLoadingBuildSecrets"
        owner-label="application"
        :github-actions="isGHA"
        :on-create="onCreateBuildSecret"
        :on-update="onUpdateBuildSecret"
        :on-delete="onDeleteBuildSecret"
        @update:secrets="(v) => (buildSecrets = v as unknown as DockerBuildSecret[])"
      />
    </section>
  </div>
</template>

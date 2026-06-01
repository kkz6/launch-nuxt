<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerCompose,
  type DockerBuildSecret,
} from "~/services/dockerService";

// Compose mirror of components/application/GHA.vue. Same surfaces +
// same backend endpoints, just calling the compose methods on the
// service, watching docker.compose.gha_* events, and tweaking copy
// where compose semantics differ (multi-service image namespace).
//
// If you change the structure here, change application/GHA.vue too —
// they're intentionally parallel.

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "updated"): void;
}>();

type SourceConfig = {
  repo?: string;
  branch?: string;
  gha_workflow_sha?: string;
  gha_image_repository?: string;
  source_control_id?: string;
};

const sc = computed<SourceConfig>(
  () => (props.compose.source_config || {}) as SourceConfig,
);

const repoSlug = computed(() => {
  const raw = (sc.value.repo || "").trim();
  if (!raw) return "";
  let s = raw.replace(/\.git$/, "");
  if (s.startsWith("git@")) {
    const idx = s.indexOf(":");
    if (idx >= 0) s = s.slice(idx + 1);
  }
  const proto = s.indexOf("://");
  if (proto >= 0) {
    const rest = s.slice(proto + 3);
    const slash = rest.indexOf("/");
    if (slash >= 0) s = rest.slice(slash + 1);
  }
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return parts.slice(-2).join("/");
});

const branch = computed(() => sc.value.branch || "main");

const workflowURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/blob/${branch.value}/.github/workflows/launch-deploy.yml`;
});

const repoActionsURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/actions`;
});

const repoSettingsSecretsURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/settings/secrets/actions`;
});

const installBroken = ref(false);

type Status = {
  kind: "ready" | "setting-up" | "incomplete" | "broken";
  label: string;
  icon: string;
  iconClass: string;
  badgeClass: string;
  subtitle: string;
};

const status = computed<Status>(() => {
  if (installBroken.value) {
    return {
      kind: "broken",
      label: "App access lost",
      icon: "lucide:shield-alert",
      iconClass: "text-red-600 dark:text-red-400",
      badgeClass:
        "bg-red-500/10 ring-1 ring-inset ring-red-500/40 text-red-700 dark:text-red-300",
      subtitle:
        "Reinstall the Launch GitHub App to restore workflow syncing and builds.",
    };
  }
  if (!props.compose.gha_build_ready) {
    return {
      kind: "setting-up",
      label: "Setting up",
      icon: "lucide:loader-2",
      iconClass: "animate-spin text-amber-600 dark:text-amber-400",
      badgeClass:
        "bg-amber-500/10 ring-1 ring-inset ring-amber-500/40 text-amber-800 dark:text-amber-300",
      subtitle:
        "Builds run on GitHub Actions. Launch publishes a workflow into your repo that builds each service image and triggers a deploy.",
    };
  }
  if (!sc.value.gha_workflow_sha) {
    return {
      kind: "incomplete",
      label: "Setup incomplete",
      icon: "lucide:alert-triangle",
      iconClass: "text-amber-600 dark:text-amber-400",
      badgeClass:
        "bg-amber-500/10 ring-1 ring-inset ring-amber-500/40 text-amber-800 dark:text-amber-300",
      subtitle:
        "Builds run on GitHub Actions. The workflow file isn't recorded in Launch yet — re-sync below.",
    };
  }
  return {
    kind: "ready",
    label: "Ready",
    icon: "lucide:check-circle-2",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/40 text-emerald-800 dark:text-emerald-300",
    subtitle: `Builds run on GitHub Actions. Each push to ${branch.value} builds the per-service images, publishes to GHCR, and triggers a redeploy.`,
  };
});

// Build secrets — same hydrate + adapter pattern as application/GHA.vue.
const buildSecrets = ref<DockerBuildSecret[]>([]);
const isLoadingBuildSecrets = ref(true);

const fetchBuildSecrets = async () => {
  isLoadingBuildSecrets.value = true;
  try {
    const res = await dockerService.composes.listBuildSecrets(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    buildSecrets.value = res.data;
  } catch {
    toast.error("Failed to load build secrets");
  } finally {
    isLoadingBuildSecrets.value = false;
  }
};

onMounted(fetchBuildSecrets);

const onCreateBuildSecret = async (data: { name: string; value: string }) => {
  const res = await dockerService.composes.createBuildSecret(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
    data,
  );
  return res.data;
};

const onUpdateBuildSecret = async (id: string, patch: { value: string }) => {
  const res = await dockerService.composes.updateBuildSecret(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
    id,
    patch,
  );
  return res.data;
};

const onDeleteBuildSecret = async (id: string) => {
  await dockerService.composes.deleteBuildSecret(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
    id,
  );
};

const isRotating = ref(false);
const isResyncing = ref(false);
const isDisabling = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const rotateToken = async () => {
  isRotating.value = true;
  try {
    await dockerService.composes.rotateGhaToken(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    toast.success(
      "Token rotation queued — the new value will land in GitHub Actions shortly.",
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to queue token rotation");
  } finally {
    isRotating.value = false;
  }
};

const resyncWorkflow = async () => {
  isResyncing.value = true;
  try {
    await dockerService.composes.resyncGhaWorkflow(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    toast.success("Workflow re-sync queued");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to queue workflow re-sync");
  } finally {
    isResyncing.value = false;
  }
};

const disableGHA = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Disable GitHub Actions builds?",
    description:
      "Future deploys will use the server-side build path again. The workflow file in your repository is left in place — delete it manually if you want.",
    confirmText: "Disable",
    cancelText: "Keep enabled",
    destructive: true,
  });
  if (!result.ok) return;
  isDisabling.value = true;
  try {
    await dockerService.composes.disableGha(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    toast.success("GitHub Actions builds disabled for this stack.");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to disable GitHub Actions builds");
  } finally {
    isDisabling.value = false;
  }
};

const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerComposeEvents(teamId, (data, event) => {
  if (data.compose_id !== props.compose.id) return;
  if (event === "docker.compose.gha_install_broken") {
    installBroken.value = true;
    emit("updated");
    return;
  }
  if (event === "docker.compose.gha_synced") {
    installBroken.value = false;
    emit("updated");
    return;
  }
  if (event === "docker.compose.gha_disabled") {
    emit("updated");
  }
});
</script>

<template>
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Broken-install banner (compose mirror of application/GHA.vue). -->
    <div
      v-if="installBroken"
      class="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-start gap-3">
        <Icon
          name="lucide:shield-alert"
          class="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <div class="min-w-0 space-y-1">
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-300">
            GitHub App access was lost
          </h3>
          <p class="text-xs text-red-700/80 dark:text-red-300/80">
            The Launch GitHub App was uninstalled or its permissions
            changed. We can't sync your workflow or push deploy tokens
            until it's reinstalled.
          </p>
        </div>
      </div>
      <NuxtLink to="https://github.com/settings/installations" target="_blank">
        <Button
          size="sm"
          variant="outline"
          class="border-red-500/40 bg-white/60 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:bg-black/20 dark:text-red-300 dark:hover:text-red-200"
        >
          Open installations
          <Icon name="lucide:external-link" class="ml-1.5 h-3 w-3 opacity-70" />
        </Button>
      </NuxtLink>
    </div>

    <!-- Page header with inline status chip + optional CTA. -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold">GitHub Actions builds</h2>
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="status.badgeClass"
          >
            <Icon :name="status.icon" class="h-3 w-3" :class="status.iconClass" />
            {{ status.label }}
          </span>
        </div>
        <p class="text-sm text-muted-foreground">{{ status.subtitle }}</p>
      </div>
      <NuxtLink
        v-if="status.kind === 'ready' && repoActionsURL"
        :to="repoActionsURL"
        target="_blank"
        class="shrink-0"
      >
        <Button size="sm" variant="outline">
          <Icon name="lucide:play-circle" class="mr-1.5 h-3.5 w-3.5" />
          View workflow runs
          <Icon name="lucide:external-link" class="ml-1.5 h-3 w-3 opacity-70" />
        </Button>
      </NuxtLink>
    </div>

    <!-- Configuration -->
    <section class="space-y-3">
      <div class="flex items-baseline justify-between gap-3 border-b pb-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configuration
        </h3>
        <span class="text-[10px] uppercase tracking-wider text-muted-foreground/60">
          Read only
        </span>
      </div>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[160px_1fr]">
        <dt class="text-xs uppercase tracking-wide text-muted-foreground">Repository</dt>
        <dd class="font-mono">
          <NuxtLink
            v-if="repoSlug"
            :to="`https://github.com/${repoSlug}`"
            target="_blank"
            class="inline-flex items-center gap-1 hover:underline"
          >
            {{ repoSlug }}
            <Icon name="lucide:external-link" class="h-3 w-3 opacity-70" />
          </NuxtLink>
          <span v-else class="text-muted-foreground">—</span>
        </dd>

        <dt class="text-xs uppercase tracking-wide text-muted-foreground">Branch</dt>
        <dd class="font-mono">{{ branch }}</dd>

        <dt class="text-xs uppercase tracking-wide text-muted-foreground">Workflow file</dt>
        <dd>
          <NuxtLink
            v-if="workflowURL"
            :to="workflowURL"
            target="_blank"
            class="inline-flex items-center gap-1 font-mono hover:underline"
          >
            .github/workflows/launch-deploy.yml
            <Icon name="lucide:external-link" class="h-3 w-3 opacity-70" />
          </NuxtLink>
          <span v-else class="font-mono text-muted-foreground">—</span>
          <span
            v-if="sc.gha_workflow_sha"
            class="ml-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            title="Commit SHA of the workflow file Launch committed to your repository"
          >
            <Icon name="lucide:git-commit" class="h-3 w-3" />
            {{ sc.gha_workflow_sha.slice(0, 7) }}
          </span>
        </dd>

        <dt class="text-xs uppercase tracking-wide text-muted-foreground">Image namespace</dt>
        <dd class="flex items-center gap-1.5 font-mono">
          {{ sc.gha_image_repository || "—" }}
          <span
            v-if="sc.gha_image_repository"
            class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-muted-foreground"
            title="Each service in your compose file builds to a tag under this prefix. Launch only accepts deploy notifications whose image refs start here — even if your deploy token leaked, an attacker couldn't redirect us to other images."
          >
            <Icon name="lucide:info" class="h-3 w-3" />
          </span>
        </dd>
      </dl>
    </section>

    <!--
      Build-time secrets — one secret name is available to every
      service in the stack that references it via id=NAME from its
      own Dockerfile. Editor + storage are the same as the application
      path; the per-service routing happens at build time on whichever
      compose service mounts it.
    -->
    <section class="space-y-3">
      <div class="border-b pb-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Build-time secrets
        </h3>
      </div>
      <p class="text-sm text-muted-foreground">
        Values mounted into <span class="font-mono">docker build</span>
        via <span class="font-mono">--mount=type=secret</span>. One
        secret here is available to every service in the stack that
        references it from its <span class="font-mono">Dockerfile</span>.
        Different from runtime env vars (those live on the Environment
        tab and are only visible to <span class="font-mono">docker run</span>).
      </p>
      <SharedBuildSecretsEditor
        :secrets="buildSecrets"
        :loading="isLoadingBuildSecrets"
        owner-label="stack"
        github-actions
        :on-create="onCreateBuildSecret"
        :on-update="onUpdateBuildSecret"
        :on-delete="onDeleteBuildSecret"
        @update:secrets="(v) => (buildSecrets = v as unknown as DockerBuildSecret[])"
      />
    </section>

    <!-- Maintenance -->
    <section class="space-y-3">
      <div class="border-b pb-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Maintenance
        </h3>
      </div>
      <ul class="divide-y">
        <li class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5 text-muted-foreground" />
              Re-sync workflow file
            </div>
            <p class="text-xs text-muted-foreground">
              Re-render <span class="font-mono">launch-deploy.yml</span>
              from the current template and commit it back over the
              file in your repo. Run after you change a build setting
              in Launch.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isResyncing"
            class="shrink-0"
            @click="resyncWorkflow"
          >
            <Icon
              v-if="isResyncing"
              name="lucide:loader-2"
              class="mr-1.5 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:refresh-cw" class="mr-1.5 h-3.5 w-3.5" />
            Re-sync
          </Button>
        </li>
        <li class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Icon name="lucide:key-round" class="h-3.5 w-3.5 text-muted-foreground" />
              Rotate deploy token
            </div>
            <p class="text-xs text-muted-foreground">
              Mint a new token and replace
              <span class="font-mono">LAUNCH_DEPLOY_TOKEN</span> on
              your repo. The next workflow run picks it up.
              <NuxtLink
                v-if="repoSettingsSecretsURL"
                :to="repoSettingsSecretsURL"
                target="_blank"
                class="ml-1 inline-flex items-center gap-0.5 underline hover:no-underline"
              >
                View secrets
                <Icon name="lucide:external-link" class="h-3 w-3 opacity-70" />
              </NuxtLink>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isRotating || !compose.gha_build_ready"
            :title="
              !compose.gha_build_ready
                ? 'Available once the workflow is live'
                : ''
            "
            class="shrink-0"
            @click="rotateToken"
          >
            <Icon
              v-if="isRotating"
              name="lucide:loader-2"
              class="mr-1.5 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:key-round" class="mr-1.5 h-3.5 w-3.5" />
            Rotate
          </Button>
        </li>
      </ul>
    </section>

    <!-- Danger zone (boxed) -->
    <div class="rounded-lg border border-red-500/30 bg-red-500/5">
      <div class="border-b border-red-500/20 px-4 py-2.5">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
          Danger zone
        </h3>
      </div>
      <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0 space-y-1">
          <div class="text-sm font-medium">Disable GitHub Actions builds</div>
          <p class="text-xs text-muted-foreground">
            Switch this stack back to server-side builds. The
            <span class="font-mono">launch-deploy.yml</span> file stays
            in your repo — delete it manually if you no longer want it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="isDisabling"
          class="shrink-0 border-red-500/40 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          @click="disableGHA"
        >
          <Icon
            v-if="isDisabling"
            name="lucide:loader-2"
            class="mr-1.5 h-3.5 w-3.5 animate-spin"
          />
          <Icon v-else name="lucide:power-off" class="mr-1.5 h-3.5 w-3.5" />
          Disable
        </Button>
      </div>
    </div>
  </div>
</template>

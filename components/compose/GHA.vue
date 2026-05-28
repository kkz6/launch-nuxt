<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

// Compose mirror of components/application/GHA.vue. Same surfaces +
// same backend endpoints, just calling the compose methods on the
// service and showing a slightly different image-repository caption
// (per-service multi-image instead of single-image).

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

const workflowURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/blob/${sc.value.branch || "main"}/.github/workflows/launch-deploy.yml`;
});
const repoActionsURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/actions`;
});
const repoSettingsSecretsURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/settings/secrets/actions`;
});

const isRotating = ref(false);
const isResyncing = ref(false);
const isDisabling = ref(false);

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
  if (
    !window.confirm(
      "Switch this stack back to building on the server?\n\n" +
        "The workflow file in your repository will be left in place — " +
        "you can delete it manually. Future deploys will use the SSH " +
        "build path.",
    )
  ) {
    return;
  }
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
  if (
    event === "docker.compose.gha_synced" ||
    event === "docker.compose.gha_install_broken" ||
    event === "docker.compose.gha_disabled"
  ) {
    emit("updated");
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold">GitHub Actions builds</h2>
        <p class="text-sm text-muted-foreground">
          This compose stack's per-service images are built in GitHub
          Actions, pushed to GHCR, and Launch deploys them by
          rewriting your <span class="font-mono">image:</span> refs.
        </p>
      </div>
      <Badge
        v-if="compose.gha_build_ready"
        class="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15"
      >
        <Icon name="lucide:check-circle" class="mr-1 h-3 w-3" />
        Ready
      </Badge>
      <Badge
        v-else
        class="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"
      >
        <Icon name="lucide:loader-2" class="mr-1 h-3 w-3 animate-spin" />
        Provisioning…
      </Badge>
    </div>

    <div class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-sm font-medium">Pipeline</h3>
      <dl class="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Repository</dt>
          <dd class="mt-0.5 font-mono">
            <NuxtLink
              v-if="repoSlug"
              :to="`https://github.com/${repoSlug}`"
              target="_blank"
              class="hover:underline"
            >
              {{ repoSlug }}
              <Icon name="lucide:external-link" class="ml-0.5 inline h-3 w-3" />
            </NuxtLink>
            <span v-else class="text-muted-foreground">—</span>
          </dd>
        </div>

        <div>
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Branch</dt>
          <dd class="mt-0.5 font-mono">{{ sc.branch || "main" }}</dd>
        </div>

        <div class="sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Workflow file</dt>
          <dd class="mt-0.5">
            <NuxtLink
              v-if="workflowURL"
              :to="workflowURL"
              target="_blank"
              class="font-mono hover:underline"
            >
              .github/workflows/launch-deploy.yml
              <Icon name="lucide:external-link" class="ml-0.5 inline h-3 w-3" />
            </NuxtLink>
            <span v-else class="text-muted-foreground">—</span>
            <span
              v-if="sc.gha_workflow_sha"
              class="ml-2 font-mono text-xs text-muted-foreground"
            >
              @ {{ sc.gha_workflow_sha.slice(0, 7) }}
            </span>
          </dd>
        </div>

        <div class="sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Image repository prefix</dt>
          <dd class="mt-0.5 font-mono">
            {{ sc.gha_image_repository || "—" }}
          </dd>
          <p class="mt-1 text-xs text-muted-foreground">
            Compose builds one image per service whose path stays
            inside this prefix (e.g. <span class="font-mono">{{
              sc.gha_image_repository || "ghcr.io/owner/repo"
            }}/<em>service</em>:launch-<em>sha</em></span>). The
            webhook handler rejects callbacks for any service image
            that doesn't match.
          </p>
        </div>
      </dl>
    </div>

    <div class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-sm font-medium">Actions</h3>

      <div class="space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">Rotate deploy token</div>
            <p class="text-xs text-muted-foreground">
              Mints a new token, hashes it on our side, and replaces
              the <span class="font-mono">LAUNCH_DEPLOY_TOKEN</span>
              secret on your repo.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isRotating || !compose.gha_build_ready"
            @click="rotateToken"
          >
            <Icon
              v-if="isRotating"
              name="lucide:loader-2"
              class="mr-1.5 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:key-round" class="mr-1.5 h-3.5 w-3.5" />
            Rotate token
          </Button>
        </div>

        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">Re-sync workflow file</div>
            <p class="text-xs text-muted-foreground">
              Re-renders <span class="font-mono">launch-deploy.yml</span>
              from the current template and PUTs it back over the
              file in your repo.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isResyncing"
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
        </div>

        <div class="flex items-start justify-between gap-4 border-t pt-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">Disable GitHub Actions builds</div>
            <p class="text-xs text-muted-foreground">
              Switches this stack back to building on the server. The
              workflow file in your repository is left in place — you
              can delete it manually if you want.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isDisabling"
            class="text-red-600 hover:text-red-700"
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

    <div class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-sm font-medium">In your repository</h3>
      <ul class="space-y-2 text-sm">
        <li v-if="repoActionsURL">
          <NuxtLink :to="repoActionsURL" target="_blank" class="hover:underline">
            <Icon name="lucide:play-circle" class="mr-1 inline h-3.5 w-3.5" />
            Workflow runs
            <Icon name="lucide:external-link" class="ml-0.5 inline h-3 w-3 text-muted-foreground" />
          </NuxtLink>
        </li>
        <li v-if="repoSettingsSecretsURL">
          <NuxtLink :to="repoSettingsSecretsURL" target="_blank" class="hover:underline">
            <Icon name="lucide:key" class="mr-1 inline h-3.5 w-3.5" />
            Secrets and variables
            <Icon name="lucide:external-link" class="ml-0.5 inline h-3 w-3 text-muted-foreground" />
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

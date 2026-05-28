<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "updated"): void;
}>();

// Build the customer-facing summary of the bootstrap pipeline state.
// The backend exposes the bits we need in `source_config`:
//   - source_control_id  → which connected GitHub install owns the repo
//   - repo               → git clone URL ("git@github.com:owner/name.git")
//   - branch             → branch the workflow listens to (push trigger)
//   - gha_workflow_sha   → commit SHA of the workflow file Launch
//                          committed; populated by the bootstrap job
//                          on success. Missing = bootstrap hasn't
//                          completed yet (or has been failing).
//   - gha_image_repository → "ghcr.io/<owner>/<repo>", lowercased.
//                            Used by the webhook handler to gate which
//                            image refs are accepted; the UI also
//                            shows it so customers can see the
//                            registry path their builds will publish to.
type SourceConfig = {
  repo?: string;
  branch?: string;
  gha_workflow_sha?: string;
  gha_image_repository?: string;
  source_control_id?: string;
};

const sc = computed<SourceConfig>(
  () => (props.application.source_config || {}) as SourceConfig,
);

// repoSlug renders the customer-friendly "owner/name" from whatever
// shape the row was stored as. Handles the URL forms the backend
// writes (`git@github.com:owner/name.git`, `https://github.com/owner/name`)
// AND a bare "owner/name" — same parsing the bootstrap job uses
// server-side, kept consistent so the value the customer sees here
// matches the prefix that gates webhook auth.
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

// Each of these mirrors the backend endpoint. They're queued (not
// run-to-completion) so the UI doesn't block — the bootstrap job
// fires `docker.application.gha_synced` (or `_install_broken`) when
// it actually finishes. The parent application page already
// subscribes to those events and refetches on them, so we don't have
// to do anything else here.
const isRotating = ref(false);
const isResyncing = ref(false);
const isDisabling = ref(false);

const rotateToken = async () => {
  isRotating.value = true;
  try {
    await dockerService.applications.rotateGhaToken(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
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

const disableGHA = async () => {
  if (
    !window.confirm(
      "Switch this application back to building on the server?\n\n" +
        "The workflow file in your repository will be left in place — " +
        "you can delete it manually. Future deploys will use the SSH " +
        "build path.",
    )
  ) {
    return;
  }
  isDisabling.value = true;
  try {
    await dockerService.applications.disableGha(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    toast.success("GitHub Actions builds disabled for this application.");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to disable GitHub Actions builds");
  } finally {
    isDisabling.value = false;
  }
};

// Refetch the app when the bootstrap job's WS events fire, so the
// "Ready" badge and workflow SHA reflect reality without a manual
// page reload. We listen here (instead of relying on the parent) so
// the subtab is self-contained.
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerApplicationEvents(teamId, (data, event) => {
  if (data.application_id !== props.application.id) return;
  if (
    event === "docker.application.gha_synced" ||
    event === "docker.application.gha_install_broken" ||
    event === "docker.application.gha_disabled"
  ) {
    emit("updated");
  }
});
</script>

<template>
  <div class="space-y-6">
    <!--
      Header — sets expectations on what this subtab does + makes the
      build_location flag visible. Customers landing here should
      immediately know "this app is wired to GitHub Actions" without
      digging into source_config.
    -->
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold">GitHub Actions builds</h2>
        <p class="text-sm text-muted-foreground">
          This application's builds run in GitHub Actions. Launch
          committed a workflow into your repository which builds the
          image, pushes it to GHCR, and notifies us to deploy.
        </p>
      </div>
      <Badge
        v-if="application.gha_build_ready"
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

    <!--
      Pipeline snapshot — what's wired up in GitHub, with deep links
      where possible. We deliberately don't show the deploy token (the
      backend doesn't return it; only the hash is stored) — customers
      who need to read it can read the GitHub Actions secret they
      already manage.
    -->
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
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">Image repository</dt>
          <dd class="mt-0.5 font-mono">
            {{ sc.gha_image_repository || "—" }}
          </dd>
          <p class="mt-1 text-xs text-muted-foreground">
            Launch only accepts deploy notifications whose image tag
            matches this prefix — even if your deploy token leaked, an
            attacker couldn't redirect us to a different image.
          </p>
        </div>
      </dl>
    </div>

    <!--
      Actions — three buttons mapped to the three slice-I endpoints.
      Each row carries a "why would I click this?" caption so the
      customer doesn't have to dig in the docs.
    -->
    <div class="rounded-lg border bg-card p-4">
      <h3 class="mb-3 text-sm font-medium">Actions</h3>

      <div class="space-y-4">
        <!-- Rotate token -->
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">Rotate deploy token</div>
            <p class="text-xs text-muted-foreground">
              Mints a new token, hashes it on our side, and replaces
              the <span class="font-mono">LAUNCH_DEPLOY_TOKEN</span>
              secret on your repo. The next workflow run will pick it
              up automatically.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isRotating || !application.gha_build_ready"
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

        <!-- Re-sync workflow -->
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">Re-sync workflow file</div>
            <p class="text-xs text-muted-foreground">
              Re-renders <span class="font-mono">launch-deploy.yml</span>
              from the current template and PUTs it back over the
              file in your repo. Use after you've made a change in
              Launch that should be reflected in the workflow
              (build tweaks, etc.).
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

        <!-- Disable GHA -->
        <div class="flex items-start justify-between gap-4 border-t pt-4">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium">Disable GitHub Actions builds</div>
            <p class="text-xs text-muted-foreground">
              Switches this application back to building on the
              server. The workflow file in your repository is left in
              place — you can delete it manually if you want.
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

    <!-- Outbound deep links to GitHub for power users -->
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

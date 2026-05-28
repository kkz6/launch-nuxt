<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from "reka-ui";
import type { Repository, SourceControl } from "~/types";
import {
  dockerService,
  type CreateDockerComposeData,
  type DockerCompose,
  type DockerComposeSourceType,
  type DockerRegistryCredential,
} from "~/services/dockerService";

interface Props {
  open: boolean;
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [c: DockerCompose];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

// ---- form state ---------------------------------------------------------
const sourceType = ref<DockerComposeSourceType>("git");
const name = ref("");

// Git fields. We track sourceControlId separately so the API gets the
// connection used for cloning private repos; gitRepo is the cloneable URL
// (full_name → cloned via the connection's auth). For convenience the
// user can also paste a public URL directly (no source-control needed).
const sourceControls = ref<SourceControl[]>([]);
const repositories = ref<Repository[]>([]);
const isLoadingRepositories = ref(false);
const repositorySearchTerm = ref("");

const sourceControlId = ref("");
const selectedRepo = ref<Repository | null>(null);
const gitRepoFallback = ref(""); // when no provider connected, paste URL
const gitBranch = ref("main");
// Mirror of the application sheet's gitBuildLocation toggle. Only
// meaningful when sourceType === 'git'. See the matching ref in
// CreateApplicationSheet.vue for the rationale.
const gitBuildLocation = ref<"server" | "github_actions">("server");
const composeFilePath = ref("");

const rawYAML = ref("");
const isSubmitting = ref(false);

// --- Registry credentials (many-to-many) ---------------------------
//
// Compose stacks can pull from N registries in one YAML. We track
// selected IDs as a Set so toggle interaction stays O(1); on submit
// the Set is serialized to an array. Empty selection → no `docker
// login` step in the deploy script.
const registryCredentials = ref<DockerRegistryCredential[]>([]);
const selectedRegistryCredentialIds = ref<Set<string>>(new Set());

const fetchRegistryCredentials = async () => {
  try {
    const res = await dockerService.registryCredentials.list();
    registryCredentials.value = res.data;
  } catch {
    registryCredentials.value = [];
  }
};

const toggleRegistryCredential = (id: string) => {
  const next = new Set(selectedRegistryCredentialIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedRegistryCredentialIds.value = next;
};

// ---- data loading -------------------------------------------------------
const fetchSourceControls = async () => {
  try {
    const res = await sourceControlService.list();
    sourceControls.value = res.data;
  } catch {
    // Silent — the form falls back to the public-URL input below.
    sourceControls.value = [];
  }
};

const fetchRepositories = async (scId: string) => {
  if (!scId) {
    repositories.value = [];
    return;
  }
  isLoadingRepositories.value = true;
  try {
    const res = await sourceControlService.repositories(scId);
    repositories.value = res.data ?? [];
  } catch {
    repositories.value = [];
  } finally {
    isLoadingRepositories.value = false;
  }
};

const handleSourceControlChange = (scId: string) => {
  sourceControlId.value = scId;
  selectedRepo.value = null;
  gitBranch.value = "main";
  void fetchRepositories(scId);
};

const handleRepoSelect = (repo: Repository) => {
  selectedRepo.value = repo;
  gitBranch.value = repo.default_branch || "main";
  repositorySearchTerm.value = "";
};

const filteredRepositories = computed(() => {
  if (!repositorySearchTerm.value) return repositories.value;
  const q = repositorySearchTerm.value.toLowerCase();
  return repositories.value.filter(
    (r) =>
      r.full_name.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q),
  );
});

// `selectedSourceControl` shown next to the picker (label + icon).
const selectedSourceControl = computed(() =>
  sourceControls.value.find((sc) => sc.id === sourceControlId.value) ?? null,
);

// ---- lifecycle ---------------------------------------------------------
watch(isOpen, (open) => {
  if (open) {
    sourceType.value = "git";
    name.value = "";
    sourceControlId.value = "";
    selectedRepo.value = null;
    gitRepoFallback.value = "";
    gitBranch.value = "main";
    gitBuildLocation.value = "server";
    composeFilePath.value = "";
    rawYAML.value = "";
    repositorySearchTerm.value = "";
    repositories.value = [];
    selectedRegistryCredentialIds.value = new Set();
    // Lazy load source-control accounts + registry credentials. Both
    // endpoints are cheap and idempotent.
    void fetchSourceControls();
    void fetchRegistryCredentials();
  }
});

// ---- submit ------------------------------------------------------------
const submit = async () => {
  const trimmedName = name.value.trim();
  if (!trimmedName) {
    toast.error("Name is required");
    return;
  }

  const payload: CreateDockerComposeData = {
    name: trimmedName,
    compose_source_type: sourceType.value,
  };

  if (sourceType.value === "git") {
    // Three valid combos:
    //   - source-control + repo picked → repo.full_name + sc id
    //   - public URL only             → URL only, no sc id
    //   - source-control + URL fallback (rare) → URL + sc id
    let repoUrl = "";
    if (selectedRepo.value) {
      // ssh_url is what the deploy job clones with when there's a
      // source-control connection; for public URLs we use html_url.
      repoUrl =
        selectedRepo.value.ssh_url ||
        `https://github.com/${selectedRepo.value.full_name}.git`;
    } else if (gitRepoFallback.value.trim()) {
      repoUrl = gitRepoFallback.value.trim();
    }
    const branch = gitBranch.value.trim();
    if (!repoUrl || !branch) {
      toast.error("Pick a repository and branch");
      return;
    }
    if (gitBuildLocation.value === "github_actions" && !sourceControlId.value) {
      toast.error("GitHub Actions builds require a connected GitHub source control");
      return;
    }
    payload.git = {
      repo: repoUrl,
      branch,
      ...(sourceControlId.value ? { source_control_id: sourceControlId.value } : {}),
      ...(composeFilePath.value.trim()
        ? { compose_file_path: composeFilePath.value.trim() }
        : {}),
      ...(gitBuildLocation.value !== "server"
        ? { build_location: gitBuildLocation.value }
        : {}),
    };
  } else {
    if (!rawYAML.value.trim()) {
      toast.error("Paste a docker-compose YAML body");
      return;
    }
    payload.raw_yaml = { contents: rawYAML.value };
  }

  // Many-to-many registry credentials. Only include the field when
  // the user picked at least one — sending an empty array would be
  // a no-op anyway, but omitting keeps the wire small.
  if (selectedRegistryCredentialIds.value.size > 0) {
    payload.registry_credential_ids = Array.from(selectedRegistryCredentialIds.value);
  }

  isSubmitting.value = true;
  try {
    const res = await dockerService.composes.create(
      props.serverId,
      props.projectId,
      payload,
    );
    toast.success("Compose stack created");
    emit("created", res.data);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to create compose stack");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>New Compose Stack</DialogTitle>
        <DialogDescription>
          Register a docker-compose stack. Source can be a git repo
          (via a connected Git provider for private repos, or a public
          URL) or a YAML body pasted inline. To route through Traefik,
          declare <code>launch-network</code> as
          <code>external: true</code> on services you want exposed.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="compose-name">Name</Label>
          <Input
            id="compose-name"
            v-model="name"
            placeholder="e.g. monitoring, db-stack"
            autocomplete="off"
            required
          />
        </div>

        <div class="space-y-2">
          <Label>Source</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in [
                { value: 'git' as const, label: 'Git repository', icon: 'lucide:git-branch' },
                { value: 'raw_yaml' as const, label: 'Paste YAML', icon: 'lucide:file-code' },
              ]"
              :key="opt.value"
              type="button"
              class="flex flex-col items-center gap-1 rounded-md border px-3 py-3 text-xs transition"
              :class="
                sourceType === opt.value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-input text-muted-foreground hover:border-foreground/40'
              "
              @click="sourceType = opt.value"
            >
              <Icon :name="opt.icon" class="h-5 w-5" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Git source: picker + repo combobox if a provider is
             connected, otherwise a plain URL fallback. -->
        <div v-if="sourceType === 'git'" class="space-y-4">
          <div
            v-if="sourceControls.length === 0"
            class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
          >
            <Icon
              name="lucide:triangle-alert"
              class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom"
            />
            No Git provider connected. Paste a public repo URL below,
            or connect GitHub / GitLab / Bitbucket in Settings &rarr;
            Integrations to pick from a list.
          </div>

          <div v-if="sourceControls.length > 0" class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Git provider</Label>
              <Select
                :model-value="sourceControlId"
                @update:model-value="(v) => handleSourceControlChange(v as string)"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select git provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="sc in sourceControls" :key="sc.id" :value="sc.id">
                    <div class="flex items-center gap-2">
                      <Icon :name="`simple-icons:${sc.provider}`" class="h-4 w-4" />
                      <span>
                        {{ sc.login }}
                        <span class="text-muted-foreground">
                          ({{ sc.repository_count }}
                          {{ sc.repository_count === 1 ? 'repo' : 'repos' }})
                        </span>
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>Repository</Label>
              <ComboboxRoot
                v-model:search-term="repositorySearchTerm"
                :model-value="selectedRepo"
                :disabled="!sourceControlId || isLoadingRepositories"
                :filter-function="(list: Repository[]) => list"
                class="relative"
                @update:model-value="(val: Repository | null) => val && handleRepoSelect(val)"
              >
                <ComboboxAnchor
                  class="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                >
                  <ComboboxInput
                    class="h-full flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    :placeholder="isLoadingRepositories ? 'Loading...' : 'Search repository...'"
                    :display-value="(repo: Repository) => repo?.full_name || ''"
                  />
                  <ComboboxTrigger class="flex items-center justify-center">
                    <Icon name="lucide:chevron-down" class="h-4 w-4 opacity-50" />
                  </ComboboxTrigger>
                </ComboboxAnchor>
                <ComboboxPortal>
                  <ComboboxContent
                    position="popper"
                    :side-offset="4"
                    class="z-[200] max-h-60 w-[--reka-combobox-trigger-width] overflow-hidden rounded-md border bg-popover shadow-md"
                  >
                    <ComboboxEmpty class="py-6 text-center text-sm text-muted-foreground">
                      No repository found.
                    </ComboboxEmpty>
                    <ComboboxGroup class="overflow-auto p-1">
                      <ComboboxItem
                        v-for="repo in filteredRepositories"
                        :key="repo.id"
                        :value="repo"
                        class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        @select="handleRepoSelect(repo)"
                      >
                        <ComboboxItemIndicator class="mr-2 h-4 w-4">
                          <Icon name="lucide:check" class="h-4 w-4" />
                        </ComboboxItemIndicator>
                        <Icon
                          :name="repo.public ? 'lucide:globe' : 'lucide:lock-keyhole'"
                          class="mr-2 h-4 w-4 shrink-0 text-muted-foreground"
                        />
                        <span class="truncate">{{ repo.full_name }}</span>
                      </ComboboxItem>
                    </ComboboxGroup>
                  </ComboboxContent>
                </ComboboxPortal>
              </ComboboxRoot>
            </div>
          </div>

          <!-- Public URL fallback (always visible — quick path for
               public repos even when a provider is connected). -->
          <div v-if="!selectedRepo" class="space-y-2">
            <Label for="compose-repo-url">Or paste a public repository URL</Label>
            <Input
              id="compose-repo-url"
              v-model="gitRepoFallback"
              placeholder="https://github.com/owner/repo.git"
              autocomplete="off"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="compose-branch">Branch</Label>
              <Input
                id="compose-branch"
                v-model="gitBranch"
                placeholder="main"
                autocomplete="off"
              />
            </div>
            <div class="space-y-2">
              <Label for="compose-file">Compose file path</Label>
              <Input
                id="compose-file"
                v-model="composeFilePath"
                placeholder="docker-compose.yml"
                autocomplete="off"
              />
              <p class="text-xs text-muted-foreground">
                Optional. Relative to the repository root.
              </p>
            </div>
          </div>

          <!-- Build location picker — same shape as CreateApplicationSheet.
               For composes the GHA workflow matrix-builds every service
               declared with a `build:` directive in the compose file and
               pushes each as a service-tagged image to GHCR. If the
               compose has only `image:` services (everything prebuilt),
               selecting GitHub Actions is harmless: the bootstrap job
               still commits the workflow file but the matrix lands
               empty and the build job is skipped at run time. -->
          <div class="space-y-2 rounded-md border bg-muted/40 p-4">
            <Label>Build location</Label>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                :class="[
                  'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                  gitBuildLocation === 'server'
                    ? 'border-primary bg-background ring-1 ring-primary'
                    : 'border-input bg-background hover:bg-accent/40',
                ]"
                @click="gitBuildLocation = 'server'"
              >
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Icon name="lucide:server" class="h-4 w-4" />
                  On the server
                </span>
                <span class="text-xs text-muted-foreground">
                  Worker SSHes into the docker host and runs the compose
                  build there. Default.
                </span>
              </button>
              <button
                type="button"
                :class="[
                  'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                  gitBuildLocation === 'github_actions'
                    ? 'border-primary bg-background ring-1 ring-primary'
                    : 'border-input bg-background hover:bg-accent/40',
                ]"
                @click="gitBuildLocation = 'github_actions'"
              >
                <span class="flex items-center gap-2 text-sm font-medium">
                  <Icon name="simple-icons:github" class="h-4 w-4" />
                  GitHub Actions
                </span>
                <span class="text-xs text-muted-foreground">
                  Matrix build per service with a <code>build:</code> in
                  the compose file. Images push to GHCR.
                </span>
              </button>
            </div>
            <p
              v-if="gitBuildLocation === 'github_actions' && !sourceControlId"
              class="text-xs text-amber-700 dark:text-amber-300"
            >
              <Icon name="lucide:triangle-alert" class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom" />
              Requires a connected GitHub source control above.
            </p>
          </div>
        </div>

        <div v-else class="space-y-2">
          <Label for="compose-yaml">docker-compose.yml</Label>
          <Textarea
            id="compose-yaml"
            v-model="rawYAML"
            rows="14"
            class="font-mono text-xs"
            placeholder="version: '3'&#10;services:&#10;  web:&#10;    image: nginx:1.27"
          />
          <p class="text-xs text-muted-foreground">
            Stored as-is. Redeploy uses the same YAML — edit the stack
            to change it. Cap is 128 KB.
          </p>
        </div>

        <!--
          Registry-credential multi-select. Compose stacks can pull
          from N registries in one YAML (e.g. ghcr.io + quay), so the
          picker takes 0..N saved credentials. Deploy script runs
          `docker login` for each before `docker compose pull/up`,
          then `docker logout` after. Empty selection = no auth step.
        -->
        <div class="space-y-2 rounded-md border bg-muted/20 p-3">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-medium">Registry credentials</Label>
            <span class="text-[11px] text-muted-foreground">
              {{ selectedRegistryCredentialIds.size }} selected
            </span>
          </div>
          <p class="text-[11px] text-muted-foreground">
            Pick the saved registry logins this stack needs. Manage
            them in Settings → Connections.
          </p>
          <div
            v-if="registryCredentials.length === 0"
            class="rounded border border-dashed p-3 text-center text-[11px] text-muted-foreground"
          >
            No saved registry credentials yet — all images in this
            stack must be public.
          </div>
          <div v-else class="space-y-1">
            <button
              v-for="c in registryCredentials"
              :key="c.id"
              type="button"
              class="flex w-full items-start justify-between rounded-md border px-3 py-2 text-left text-xs transition"
              :class="
                selectedRegistryCredentialIds.has(c.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-foreground/40'
              "
              @click="toggleRegistryCredential(c.id)"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 font-medium">
                  <Icon
                    :name="
                      selectedRegistryCredentialIds.has(c.id)
                        ? 'lucide:check-square'
                        : 'lucide:square'
                    "
                    class="h-3.5 w-3.5"
                  />
                  {{ c.name }}
                </div>
                <p class="ml-5 text-[11px] text-muted-foreground">
                  {{ c.registry_url || 'Docker Hub' }} · {{ c.username }}
                </p>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSubmitting"
            @click="isOpen = false"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            <Icon
              v-if="isSubmitting"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Create Compose Stack
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

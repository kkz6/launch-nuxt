<script setup lang="ts">
import { reactive, toRefs } from "vue";
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
  type CreateDockerApplicationData,
  type DockerApplication,
  type DockerRegistryCredential,
  type DockerSourceType,
} from "~/services/dockerService";

interface Props {
  open: boolean;
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [app: DockerApplication];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

type RegistryAuthMode = "public" | "saved" | "inline";

interface CreateApplicationState {
  sourceType: DockerSourceType;
  name: string;
  internalPort: number;
  imageRef: string;
  sourceControls: SourceControl[];
  repositories: Repository[];
  isLoadingRepositories: boolean;
  repositorySearchTerm: string;
  sourceControlId: string;
  selectedRepo: Repository | null;
  gitRepoFallback: string;
  gitBranch: string;
  gitBuildType: "auto" | "nixpacks" | "dockerfile";
  gitDockerfilePath: string;
  gitBuildLocation: "server" | "github_actions";
  dockerfileContents: string;
  registryAuthMode: RegistryAuthMode;
  registryCredentials: DockerRegistryCredential[];
  selectedRegistryCredentialId: string;
  inlineRegistryUsername: string;
  inlineRegistryPassword: string;
  inlineRegistryUrl: string;
  isSubmitting: boolean;
}

const state = reactive({
  sourceType: "image",
  name: "",
  internalPort: 80,
  imageRef: "",
  sourceControls: [],
  repositories: [],
  isLoadingRepositories: false,
  repositorySearchTerm: "",
  sourceControlId: "",
  selectedRepo: null,
  gitRepoFallback: "",
  gitBranch: "main",
  gitBuildType: "auto",
  gitDockerfilePath: "",
  gitBuildLocation: "server",
  dockerfileContents: "",
  registryAuthMode: "public",
  registryCredentials: [],
  selectedRegistryCredentialId: "",
  inlineRegistryUsername: "",
  inlineRegistryPassword: "",
  inlineRegistryUrl: "",
  isSubmitting: false,
}) as CreateApplicationState;

const {
  sourceType,
  name,
  internalPort,
  imageRef,
  sourceControls,
  repositories,
  isLoadingRepositories,
  repositorySearchTerm,
  sourceControlId,
  selectedRepo,
  gitRepoFallback,
  gitBranch,
  gitBuildType,
  gitDockerfilePath,
  gitBuildLocation,
  dockerfileContents,
  registryAuthMode,
  registryCredentials,
  selectedRegistryCredentialId,
  inlineRegistryUsername,
  inlineRegistryPassword,
  inlineRegistryUrl,
  isSubmitting,
} = toRefs(state);

const fetchRegistryCredentials = async () => {
  try {
    const res = await dockerService.registryCredentials.list();
    registryCredentials.value = res.data;
  } catch {
    registryCredentials.value = [];
  }
};

const fetchSourceControls = async () => {
  try {
    const res = await sourceControlService.list();
    sourceControls.value = res.data;
  } catch {
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
      r.full_name.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
  );
});

watch(isOpen, (open) => {
  if (open) {
    sourceType.value = "image";
    name.value = "";
    internalPort.value = 80;
    imageRef.value = "";
    sourceControlId.value = "";
    selectedRepo.value = null;
    repositories.value = [];
    repositorySearchTerm.value = "";
    gitRepoFallback.value = "";
    gitBranch.value = "main";
    gitBuildType.value = "auto";
    gitBuildLocation.value = "server";
    gitDockerfilePath.value = "";
    dockerfileContents.value = "";
    registryAuthMode.value = "public";
    selectedRegistryCredentialId.value = "";
    inlineRegistryUsername.value = "";
    inlineRegistryPassword.value = "";
    inlineRegistryUrl.value = "";
    void fetchSourceControls();
    void fetchRegistryCredentials();
  }
});

const submit = async () => {
  const trimmedName = name.value.trim();
  if (!trimmedName) {
    toast.error("Application name is required");
    return;
  }

  const port = Number(internalPort.value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    toast.error("Internal port must be between 1 and 65535");
    return;
  }

  const payload: CreateDockerApplicationData = {
    name: trimmedName,
    source_type: sourceType.value,
    internal_port: port,
  };

  switch (sourceType.value) {
    case "image": {
      const v = imageRef.value.trim();
      if (!v) {
        toast.error("Image reference is required (e.g. nginx:1.27)");
        return;
      }
      payload.image = { image: v };
      if (
        registryAuthMode.value === "saved" &&
        selectedRegistryCredentialId.value
      ) {
        payload.image.registry_credential_id =
          selectedRegistryCredentialId.value;
      } else if (registryAuthMode.value === "inline") {
        const u = inlineRegistryUsername.value.trim();
        const p = inlineRegistryPassword.value;
        if (!u || !p) {
          toast.error(
            "Inline registry auth requires both username AND password",
          );
          return;
        }
        payload.image.registry_username = u;
        payload.image.registry_password = p;
        if (inlineRegistryUrl.value.trim()) {
          payload.image.registry_url = inlineRegistryUrl.value.trim();
        }
      }
      break;
    }
    case "git": {
      let repoUrl = "";
      if (selectedRepo.value) {
        repoUrl =
          selectedRepo.value.ssh_url ||
          `https://github.com/${selectedRepo.value.full_name}.git`;
      } else if (gitRepoFallback.value.trim()) {
        repoUrl = gitRepoFallback.value.trim();
      }
      const branch = gitBranch.value.trim();
      if (!repoUrl) {
        toast.error("Pick a repository or paste a public URL");
        return;
      }
      if (!branch) {
        toast.error("Git branch is required");
        return;
      }
      payload.git = {
        repo: repoUrl,
        branch,
        ...(sourceControlId.value
          ? { source_control_id: sourceControlId.value }
          : {}),
        ...(gitBuildType.value !== "auto"
          ? { build_type: gitBuildType.value }
          : {}),
        ...(gitDockerfilePath.value.trim()
          ? { dockerfile_path: gitDockerfilePath.value.trim() }
          : {}),
        ...(gitBuildLocation.value !== "server"
          ? { build_location: gitBuildLocation.value }
          : {}),
      };
      if (
        gitBuildLocation.value === "github_actions" &&
        !sourceControlId.value
      ) {
        toast.error(
          "GitHub Actions builds require a connected GitHub source control",
        );
        return;
      }
      break;
    }
    case "dockerfile": {
      const contents = dockerfileContents.value;
      if (!contents.trim()) {
        toast.error("Dockerfile contents are required");
        return;
      }
      payload.dockerfile = { contents };
      break;
    }
  }

  isSubmitting.value = true;
  try {
    const res = await dockerService.applications.create(
      props.serverId,
      props.projectId,
      payload,
    );
    toast.success("Application created");
    emit("created", res.data);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to create application");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>New Application</DialogTitle>
        <DialogDescription>
          Register a single-container workload. Once created, deploying will
          pull or build the image and start the container on the docker server.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="app-name">Name</Label>
            <Input
              id="app-name"
              v-model="name"
              placeholder="e.g. api, web, worker"
              autocomplete="off"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="app-port">Internal port</Label>
            <Input
              id="app-port"
              v-model.number="internalPort"
              type="number"
              min="1"
              max="65535"
              required
            />
            <p class="text-xs text-muted-foreground">
              What your container listens on internally.
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <Label>Source</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="opt in [
                {
                  value: 'image' as const,
                  label: 'Docker image',
                  icon: 'simple-icons:docker',
                },
                {
                  value: 'git' as const,
                  label: 'Git repo',
                  icon: 'lucide:git-branch',
                },
                {
                  value: 'dockerfile' as const,
                  label: 'Dockerfile',
                  icon: 'lucide:file-code',
                },
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

        <div v-if="sourceType === 'image'" class="space-y-4">
          <div class="space-y-2">
            <Label for="app-image">Image reference</Label>
            <Input
              id="app-image"
              v-model="imageRef"
              placeholder="nginx:1.27 or ghcr.io/acme/api:v3"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              Include a specific tag — we don't silently use
              <code>:latest</code>.
            </p>
          </div>

          <div class="space-y-2 rounded-md border bg-muted/20 p-3">
            <Label class="text-sm font-medium">Image authentication</Label>
            <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <button
                type="button"
                class="rounded-md border px-3 py-2 text-left text-xs transition"
                :class="
                  registryAuthMode === 'public'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-foreground/40'
                "
                @click="registryAuthMode = 'public'"
              >
                <div class="flex items-center gap-1.5 font-medium">
                  <Icon name="lucide:globe" class="h-3.5 w-3.5" /> Public
                </div>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  No login.
                </p>
              </button>
              <button
                type="button"
                class="rounded-md border px-3 py-2 text-left text-xs transition"
                :class="
                  registryAuthMode === 'saved'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-foreground/40'
                "
                @click="registryAuthMode = 'saved'"
              >
                <div class="flex items-center gap-1.5 font-medium">
                  <Icon name="lucide:key-round" class="h-3.5 w-3.5" /> Saved
                </div>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  From Settings.
                </p>
              </button>
              <button
                type="button"
                class="rounded-md border px-3 py-2 text-left text-xs transition"
                :class="
                  registryAuthMode === 'inline'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-foreground/40'
                "
                @click="registryAuthMode = 'inline'"
              >
                <div class="flex items-center gap-1.5 font-medium">
                  <Icon name="lucide:lock" class="h-3.5 w-3.5" /> Inline
                </div>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  One-off creds.
                </p>
              </button>
            </div>

            <div v-if="registryAuthMode === 'saved'" class="space-y-1.5 pt-2">
              <div
                v-if="registryCredentials.length === 0"
                class="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-900 dark:text-amber-200"
              >
                <Icon
                  name="lucide:triangle-alert"
                  class="mr-1 inline-block h-3 w-3 align-text-bottom"
                />
                No saved registry credentials. Add one in Settings →
                Connections, or switch to Inline.
              </div>
              <select
                v-else
                v-model="selectedRegistryCredentialId"
                class="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Pick a saved credential…</option>
                <option
                  v-for="c in registryCredentials"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }} — {{ c.registry_url || "Docker Hub" }} /
                  {{ c.username }}
                </option>
              </select>
            </div>

            <div v-if="registryAuthMode === 'inline'" class="space-y-2 pt-2">
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div class="space-y-1">
                  <Label for="reg-inline-user" class="text-xs">Username</Label>
                  <Input
                    id="reg-inline-user"
                    v-model="inlineRegistryUsername"
                    autocomplete="off"
                  />
                </div>
                <div class="space-y-1">
                  <Label for="reg-inline-pass" class="text-xs">Password</Label>
                  <Input
                    id="reg-inline-pass"
                    v-model="inlineRegistryPassword"
                    type="password"
                    autocomplete="new-password"
                  />
                </div>
              </div>
              <div class="space-y-1">
                <Label for="reg-inline-url" class="text-xs">
                  Registry URL
                  <span class="font-normal text-muted-foreground">
                    (leave blank for Docker Hub)
                  </span>
                </Label>
                <Input
                  id="reg-inline-url"
                  v-model="inlineRegistryUrl"
                  placeholder="ghcr.io"
                  autocomplete="off"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="sourceType === 'git'" class="space-y-4">
          <div
            v-if="sourceControls.length === 0"
            class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
          >
            <Icon
              name="lucide:triangle-alert"
              class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom"
            />
            No Git provider connected. Paste a public repo URL below, or connect
            GitHub / GitLab / Bitbucket in Settings &rarr; Integrations to pick
            from a list.
          </div>

          <div v-if="sourceControls.length > 0" class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Git provider</Label>
              <Select
                :model-value="sourceControlId"
                @update:model-value="
                  (v) => handleSourceControlChange(v as string)
                "
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select git provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="sc in sourceControls"
                    :key="sc.id"
                    :value="sc.id"
                  >
                    <div class="flex items-center gap-2">
                      <Icon
                        :name="`simple-icons:${sc.provider}`"
                        class="h-4 w-4"
                      />
                      <span>
                        {{ sc.login }}
                        <span class="text-muted-foreground">
                          ({{ sc.repository_count }}
                          {{ sc.repository_count === 1 ? "repo" : "repos" }})
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
                @update:model-value="
                  (val: Repository | null) => val && handleRepoSelect(val)
                "
              >
                <ComboboxAnchor
                  class="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                >
                  <ComboboxInput
                    class="h-full flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                    :placeholder="
                      isLoadingRepositories
                        ? 'Loading...'
                        : 'Search repository...'
                    "
                    :display-value="(repo: Repository) => repo?.name || ''"
                  />
                  <ComboboxTrigger class="flex items-center justify-center">
                    <Icon
                      name="lucide:chevron-down"
                      class="h-4 w-4 opacity-50"
                    />
                  </ComboboxTrigger>
                </ComboboxAnchor>
                <ComboboxPortal>
                  <ComboboxContent
                    position="popper"
                    :side-offset="4"
                    class="z-[200] max-h-60 w-[--reka-combobox-trigger-width] overflow-hidden rounded-md border bg-popover shadow-md"
                  >
                    <ComboboxEmpty
                      class="py-6 text-center text-sm text-muted-foreground"
                    >
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
                          :name="
                            repo.public ? 'lucide:globe' : 'lucide:lock-keyhole'
                          "
                          class="mr-2 h-4 w-4 shrink-0 text-muted-foreground"
                        />
                        <span class="truncate">{{ repo.name }}</span>
                      </ComboboxItem>
                    </ComboboxGroup>
                  </ComboboxContent>
                </ComboboxPortal>
              </ComboboxRoot>
            </div>
          </div>

          <div v-if="!selectedRepo" class="space-y-2">
            <Label for="app-git-repo-url"
              >Or paste a public repository URL</Label
            >
            <Input
              id="app-git-repo-url"
              v-model="gitRepoFallback"
              placeholder="https://github.com/owner/repo.git"
              autocomplete="off"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="app-git-branch">Branch</Label>
              <Input
                id="app-git-branch"
                v-model="gitBranch"
                placeholder="main"
                autocomplete="off"
              />
            </div>
            <div class="space-y-2">
              <Label>Builder</Label>
              <Select v-model="gitBuildType">
                <SelectTrigger>
                  <SelectValue placeholder="Choose builder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Auto-detect (Dockerfile, else Nixpacks)
                  </SelectItem>
                  <SelectItem value="dockerfile">Dockerfile</SelectItem>
                  <SelectItem value="nixpacks">Nixpacks</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div v-if="gitBuildType === 'dockerfile'" class="space-y-2">
            <Label for="app-dockerfile-path">Dockerfile path</Label>
            <Input
              id="app-dockerfile-path"
              v-model="gitDockerfilePath"
              placeholder="./Dockerfile"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              Relative to the repository root. Leave blank for
              <code>./Dockerfile</code>.
            </p>
          </div>

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
                  Worker SSHes into the docker host and runs the build there.
                  Default — works for any size repo.
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
                  Launch commits a workflow into your repo. CI builds + pushes
                  to GHCR; we deploy the image. Recommended for large apps.
                </span>
              </button>
            </div>
            <p
              v-if="gitBuildLocation === 'github_actions' && !sourceControlId"
              class="text-xs text-amber-700 dark:text-amber-300"
            >
              <Icon
                name="lucide:triangle-alert"
                class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom"
              />
              Requires a connected GitHub source control above.
            </p>
            <p
              v-if="gitBuildLocation === 'github_actions' && sourceControlId"
              class="text-xs text-muted-foreground"
            >
              <Icon
                name="lucide:git-commit-horizontal"
                class="mr-1 inline-block h-3.5 w-3.5 align-text-bottom"
              />
              On create, Launch commits a workflow file to
              <span class="font-mono">.github/workflows/</span> in this repo.
              Changing the build settings later re-syncs that file.
            </p>

            <div
              v-if="gitBuildLocation === 'github_actions'"
              class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200"
            >
              <div class="mb-1 flex items-center gap-1.5 font-medium">
                <Icon name="lucide:check-circle" class="h-3.5 w-3.5" />
                Private GHCR packages work automatically
              </div>
              <p class="text-emerald-900/90 dark:text-emerald-200/90">
                Each workflow run mints a short-lived (<span class="font-mono"
                  >~1 hour</span
                >) GHCR pull token scoped to this repository and hands it to
                Launch as part of the deploy callback. Your built images can
                stay <span class="font-mono">Private</span> on GitHub — no
                Personal Access Token, no visibility flip, no long-lived secret
                to rotate.
              </p>
            </div>
          </div>
        </div>

        <div v-else class="space-y-2">
          <Label for="app-dockerfile">Dockerfile contents</Label>
          <SharedCodeEditor
            v-model="dockerfileContents"
            language="shell"
            class="h-72 rounded-md border"
            :line-numbers="true"
            placeholder='FROM alpine:3.20&#10;CMD ["echo", "hello"]'
          />
          <p class="text-xs text-muted-foreground">
            The Dockerfile is stored as-is; deploying re-uses it without
            re-fetching. Cap is 64 KB.
          </p>
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
            Create Application
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

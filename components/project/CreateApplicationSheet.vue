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
  type CreateDockerApplicationData,
  type DockerApplication,
  type DockerSourceType,
} from "~/services/dockerService";

interface Props {
  /** Two-way binding for the parent's open state. */
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

// Form state. Reset on open so reopening doesn't replay the user's last
// abandoned input — leaking a half-typed Dockerfile across opens is the
// kind of surprise that breeds bugs.
const sourceType = ref<DockerSourceType>("image");
const name = ref("");
// Internal port — what the container listens on inside docker. Traefik
// routes here. Default 80 covers most images; user overrides for non-
// standard images (Node on 3000, Go on 8080, etc.).
const internalPort = ref<number>(80);

const imageRef = ref(""); // for source_type=image

// Git: source-control picker → repository combobox → branch.
// Same shape as AddSite.vue. Public repos can still be entered via
// the URL fallback so we don't force a provider connection.
const sourceControls = ref<SourceControl[]>([]);
const repositories = ref<Repository[]>([]);
const isLoadingRepositories = ref(false);
const repositorySearchTerm = ref("");
const sourceControlId = ref("");
const selectedRepo = ref<Repository | null>(null);
const gitRepoFallback = ref("");
const gitBranch = ref("main");
const gitBuildType = ref<"auto" | "nixpacks" | "dockerfile">("auto");
const gitDockerfilePath = ref("");

const dockerfileContents = ref("");

const isSubmitting = ref(false);

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
      r.full_name.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q),
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
    gitDockerfilePath.value = "";
    dockerfileContents.value = "";
    // Pre-load source controls so the combobox is ready when the
    // user clicks "Git repo". Idempotent — bails if already loaded.
    void fetchSourceControls();
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
      break;
    }
    case "git": {
      // Repo URL either comes from the picked repository (preferred —
      // we know the clone URL is correct + we can use the connection's
      // auth for private repos) or from the fallback public-URL input.
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
      };
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
          Register a single-container workload. Once created, deploying
          will pull or build the image and start the container on the
          docker server.
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
                { value: 'image' as const, label: 'Docker image', icon: 'simple-icons:docker' },
                { value: 'git' as const, label: 'Git repo', icon: 'lucide:git-branch' },
                { value: 'dockerfile' as const, label: 'Dockerfile', icon: 'lucide:file-code' },
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

        <!-- Image source -->
        <div v-if="sourceType === 'image'" class="space-y-2">
          <Label for="app-image">Image reference</Label>
          <Input
            id="app-image"
            v-model="imageRef"
            placeholder="nginx:1.27 or ghcr.io/acme/api:v3"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            Include a specific tag — we don't silently use <code>:latest</code>.
          </p>
        </div>

        <!-- Git source — same picker AddSite uses: connected provider
             selector + repository combobox. Falls back to a public URL
             input when no provider is connected. -->
        <div v-else-if="sourceType === 'git'" class="space-y-4">
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

          <div v-if="!selectedRepo" class="space-y-2">
            <Label for="app-git-repo-url">Or paste a public repository URL</Label>
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
        </div>

        <!-- Dockerfile source -->
        <div v-else class="space-y-2">
          <Label for="app-dockerfile">Dockerfile contents</Label>
          <Textarea
            id="app-dockerfile"
            v-model="dockerfileContents"
            rows="10"
            class="font-mono text-xs"
            placeholder="FROM alpine:3.20&#10;CMD [\&quot;echo\&quot;, \&quot;hello\&quot;]"
          />
          <p class="text-xs text-muted-foreground">
            The Dockerfile is stored as-is; deploying re-uses it
            without re-fetching. Cap is 64 KB.
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

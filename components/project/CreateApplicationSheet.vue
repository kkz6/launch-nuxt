<script setup lang="ts">
import { toast } from "vue-sonner";
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
const gitRepo = ref(""); // for git
const gitBranch = ref("main");
const gitBuildType = ref<"auto" | "nixpacks" | "dockerfile">("auto");
const gitDockerfilePath = ref("");
const dockerfileContents = ref("");

const isSubmitting = ref(false);

watch(isOpen, (open) => {
  if (open) {
    sourceType.value = "image";
    name.value = "";
    internalPort.value = 80;
    imageRef.value = "";
    gitRepo.value = "";
    gitBranch.value = "main";
    gitBuildType.value = "auto";
    gitDockerfilePath.value = "";
    dockerfileContents.value = "";
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
      const repo = gitRepo.value.trim();
      const branch = gitBranch.value.trim();
      if (!repo) {
        toast.error("Git repository URL is required");
        return;
      }
      if (!branch) {
        toast.error("Git branch is required");
        return;
      }
      payload.git = {
        repo,
        branch,
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

        <!-- Git source -->
        <div v-else-if="sourceType === 'git'" class="space-y-3">
          <div class="space-y-2">
            <Label for="app-git-repo">Repository URL</Label>
            <Input
              id="app-git-repo"
              v-model="gitRepo"
              placeholder="https://github.com/owner/repo"
              autocomplete="off"
            />
          </div>
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
          <p class="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Private repositories work once you connect a Git provider
            under Settings → Integrations. Public repos clone with no
            credentials.
          </p>
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

<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type CreateDockerComposeData,
  type DockerCompose,
  type DockerComposeSourceType,
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

// Compose has only two source types — keep the discriminator simple.
const sourceType = ref<DockerComposeSourceType>("git");
const name = ref("");
const gitRepo = ref("");
const gitBranch = ref("main");
const composeFilePath = ref("");
const rawYAML = ref("");
const isSubmitting = ref(false);

watch(isOpen, (open) => {
  if (open) {
    sourceType.value = "git";
    name.value = "";
    gitRepo.value = "";
    gitBranch.value = "main";
    composeFilePath.value = "";
    rawYAML.value = "";
  }
});

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
    const repo = gitRepo.value.trim();
    const branch = gitBranch.value.trim();
    if (!repo || !branch) {
      toast.error("Repository URL and branch are required");
      return;
    }
    payload.git = {
      repo,
      branch,
      ...(composeFilePath.value.trim()
        ? { compose_file_path: composeFilePath.value.trim() }
        : {}),
    };
  } else {
    if (!rawYAML.value.trim()) {
      toast.error("Paste a docker-compose YAML body");
      return;
    }
    payload.raw_yaml = { contents: rawYAML.value };
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
          Register a docker-compose stack. Source can be a git repo or
          a YAML body pasted inline. To route through Traefik, declare
          <code>launch-network</code> as <code>external: true</code>
          on the services you want exposed.
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

        <div v-if="sourceType === 'git'" class="space-y-3">
          <div class="space-y-2">
            <Label for="compose-repo">Repository URL</Label>
            <Input
              id="compose-repo"
              v-model="gitRepo"
              placeholder="https://github.com/owner/repo"
              autocomplete="off"
            />
          </div>
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
            <Label for="compose-file">Compose file path (optional)</Label>
            <Input
              id="compose-file"
              v-model="composeFilePath"
              placeholder="docker-compose.yml"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              Relative to the repository root. Leave blank for
              <code>docker-compose.yml</code>.
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

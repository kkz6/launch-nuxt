<script setup lang="ts">
import { toast } from "vue-sonner";
import { dockerService, type DockerProject } from "~/services/dockerService";

interface Props {
  serverId: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ created: [project: DockerProject] }>();

// Self-contained create flow — same convention ServerAddSite uses.
// The Navbar mounts this component next to Terminal / Provision when
// the server is docker + Projects tab is active. We keep the trigger
// button and the dialog co-located so the navbar doesn't need to
// reach into the page component to open something.
const open = ref(false);
const isCreating = ref(false);
const form = reactive({ name: "", description: "" });

const openDialog = () => {
  form.name = "";
  form.description = "";
  open.value = true;
};

const submit = async () => {
  const name = form.name.trim();
  if (!name) {
    toast.error("Project name is required");
    return;
  }
  isCreating.value = true;
  try {
    const res = await dockerService.projects.create(props.serverId, {
      name,
      description: form.description.trim() || undefined,
    });
    toast.success("Project created");
    emit("created", res.data);
    open.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to create project");
  } finally {
    isCreating.value = false;
  }
};
</script>

<template>
  <Button size="sm" @click="openDialog">
    <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
    New Project
  </Button>

  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New Project</DialogTitle>
        <DialogDescription>
          A project groups docker applications, compose stacks, and
          databases running on this server.
        </DialogDescription>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="navbar-project-name">Name</Label>
          <Input
            id="navbar-project-name"
            v-model="form.name"
            placeholder="e.g. acme-prod"
            autocomplete="off"
            required
          />
          <p class="text-xs text-muted-foreground">
            Must be unique on this server.
          </p>
        </div>
        <div class="space-y-2">
          <Label for="navbar-project-description">Description (optional)</Label>
          <Textarea
            id="navbar-project-description"
            v-model="form.description"
            placeholder="What lives in this project?"
            rows="3"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isCreating"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="isCreating">
            <Icon
              v-if="isCreating"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Create Project
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

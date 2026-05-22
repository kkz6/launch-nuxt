<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const emit = defineEmits<{ updated: [] }>();

const form = reactive({ name: props.compose.name });
const isSaving = ref(false);

watch(
  () => props.compose.name,
  (n) => {
    form.name = n;
  },
);

const isDirty = computed(() => form.name.trim() !== props.compose.name);

const save = async () => {
  const newName = form.name.trim();
  if (!newName) {
    toast.error("Name is required");
    return;
  }
  isSaving.value = true;
  try {
    await dockerService.composes.update(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      { name: newName },
    );
    toast.success("Compose stack updated");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update compose stack");
  } finally {
    isSaving.value = false;
  }
};

// Source helpers — only one of these is populated depending on source type.
const sourceCfg = computed(
  () => (props.compose.source_config ?? {}) as Record<string, unknown>,
);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">General</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Rename the compose stack. Source changes need a reconfigure flow
        which lands in a follow-up.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="save">
        <div class="space-y-2">
          <Label for="compose-general-name">Name</Label>
          <Input
            id="compose-general-name"
            v-model="form.name"
            placeholder="e.g. monitoring, db-stack"
            autocomplete="off"
          />
        </div>
        <div class="flex justify-end">
          <Button type="submit" :disabled="!isDirty || isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save changes
          </Button>
        </div>
      </form>
    </section>

    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">Source</h3>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Source type
          </dt>
          <dd class="font-medium">
            {{ compose.compose_source_type === "git" ? "Git repository" : "Inline YAML" }}
          </dd>
        </div>

        <template v-if="compose.compose_source_type === 'git'">
          <div class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Repository
            </dt>
            <dd class="break-all font-mono text-xs">{{ gitRepo || "—" }}</dd>
          </div>
          <div class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Branch
            </dt>
            <dd class="font-mono text-sm">{{ gitBranch || "—" }}</dd>
          </div>
          <div v-if="compose.compose_file_path" class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Compose file
            </dt>
            <dd class="font-mono text-xs">{{ compose.compose_file_path }}</dd>
          </div>
        </template>

        <template v-else-if="compose.raw_yaml">
          <div class="space-y-2 sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              docker-compose.yml
            </dt>
            <dd>
              <pre
                class="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs"
                >{{ compose.raw_yaml }}</pre
              >
            </dd>
          </div>
        </template>
      </dl>
    </section>

    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">Runtime</h3>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </dt>
          <dd class="font-medium capitalize">{{ compose.status }}</dd>
        </div>
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Last deployed
          </dt>
          <dd class="font-medium">
            {{
              compose.last_deployed_at
                ? new Date(compose.last_deployed_at).toLocaleString()
                : "Never"
            }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const emit = defineEmits<{ updated: [] }>();

// Renaming is in scope for phase 2a; everything else (source, build) is
// immutable until later slices add a reconfigure flow.
const form = reactive({ name: props.application.name });
const isSaving = ref(false);

watch(
  () => props.application.name,
  (n) => {
    form.name = n;
  },
);

const isDirty = computed(() => form.name.trim() !== props.application.name);

const save = async () => {
  const newName = form.name.trim();
  if (!newName) {
    toast.error("Name is required");
    return;
  }
  isSaving.value = true;
  try {
    await dockerService.applications.update(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { name: newName },
    );
    toast.success("Application updated");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update application");
  } finally {
    isSaving.value = false;
  }
};

// Source-config rendering helpers. Each source type has its own shape;
// the API returns a generic Record<string, unknown> so we read defensively.
const sourceCfg = computed(
  () => (props.application.source_config ?? {}) as Record<string, unknown>,
);

const imageRef = computed(() => sourceCfg.value.image as string | undefined);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);
const dockerfileContents = computed(
  () => sourceCfg.value.contents as string | undefined,
);

const buildConfig = computed(
  () => (props.application.build_config ?? {}) as Record<string, unknown>,
);
const dockerfilePath = computed(
  () => buildConfig.value.dockerfile_path as string | undefined,
);
</script>

<template>
  <div class="space-y-8">
    <!-- Editable bits live in their own card so the source/build summaries
         below stay clearly read-only. -->
    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">General</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        Rename the application. Source and build settings are immutable
        until a later release adds a reconfigure flow.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="save">
        <div class="space-y-2">
          <Label for="app-general-name">Name</Label>
          <Input
            id="app-general-name"
            v-model="form.name"
            placeholder="e.g. api, web, worker"
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

    <!-- Source summary card. Three branches; each one renders the keys
         this source type actually populates. -->
    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">Source</h3>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Source type
          </dt>
          <dd class="font-medium capitalize">{{ application.source_type }}</dd>
        </div>
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Internal port
          </dt>
          <dd class="font-mono text-sm">{{ application.internal_port }}</dd>
        </div>

        <template v-if="application.source_type === 'image'">
          <div class="space-y-1 sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Image
            </dt>
            <dd class="font-mono text-sm">{{ imageRef || "—" }}</dd>
          </div>
        </template>

        <template v-else-if="application.source_type === 'git'">
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
          <div class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Build type
            </dt>
            <dd class="font-medium">{{ application.build_type || "auto-detect" }}</dd>
          </div>
          <div v-if="dockerfilePath" class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Dockerfile path
            </dt>
            <dd class="font-mono text-xs">{{ dockerfilePath }}</dd>
          </div>
        </template>

        <template v-else-if="application.source_type === 'dockerfile'">
          <div class="space-y-2 sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Dockerfile
            </dt>
            <dd>
              <pre
                class="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs"
                >{{ dockerfileContents || "—" }}</pre
              >
            </dd>
          </div>
        </template>
      </dl>
    </section>

    <!-- Runtime info: what's actually running on the docker server right
         now. Populated by the deploy job (slice 2b); pre-deploy this card
         shows "Never deployed" placeholders. -->
    <section class="rounded-lg border bg-card p-6">
      <h3 class="text-lg font-semibold">Runtime</h3>
      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </dt>
          <dd class="font-medium capitalize">{{ application.status }}</dd>
        </div>
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Container ID
          </dt>
          <dd class="font-mono text-xs">
            {{ application.container_id || "—" }}
          </dd>
        </div>
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Last deployed
          </dt>
          <dd class="font-medium">
            {{
              application.last_deployed_at
                ? new Date(application.last_deployed_at).toLocaleString()
                : "Never"
            }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>

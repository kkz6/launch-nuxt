<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerEnvVar,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

// Thin wrapper around SharedEnvVarsEditor: owns the `vars` ref and
// the initial fetch; delegates UI + mutation flow to the editor. The
// editor is reused for project + database env vars; the only knob
// this page sets is `showProjectHint` (true here because application
// env values may reference `${{project.<KEY>}}`).
const vars = ref<DockerEnvVar[]>([]);
const isLoading = ref(true);

const fetchVars = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.listEnvVars(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    vars.value = res.data;
  } catch {
    toast.error("Failed to load env vars");
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchVars);

// Callbacks adapt the application-scoped dockerService calls to the
// editor's generic Promise<row> shape. The editor pushes the result
// back into our `vars` via update:vars.
const onCreate = async (data: { key: string; value: string; is_secret?: boolean }) => {
  const res = await dockerService.applications.createEnvVar(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    data,
  );
  return res.data;
};
const onUpdate = async (
  id: string,
  patch: { value?: string; is_secret?: boolean },
) => {
  const res = await dockerService.applications.updateEnvVar(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    id,
    patch,
  );
  return res.data;
};
const onDelete = async (id: string) => {
  await dockerService.applications.deleteEnvVar(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    id,
  );
};
const onSetBulk = async (
  rows: { key: string; value: string; is_secret?: boolean }[],
) => {
  const res = await dockerService.applications.setEnvVars(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    { vars: rows },
  );
  return res.data;
};
</script>

<template>
  <SharedEnvVarsEditor
    :vars="vars"
    :loading="isLoading"
    :show-project-hint="true"
    title="Environment"
    description="Env vars passed to the container as -e KEY=VALUE. Changes take effect on the next deploy."
    :on-create="onCreate"
    :on-update="onUpdate"
    :on-delete="onDelete"
    :on-set-bulk="onSetBulk"
    @update:vars="(v) => (vars = v as unknown as DockerEnvVar[])"
  />
</template>

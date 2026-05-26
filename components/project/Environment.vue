<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerProjectEnvVar,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();

// Description copy as a script-side constant so the literal
// `${{project.KEY}}` token never lands in template-text territory.
// Vue's compiler scans HTML attribute values for `{{...}}` mustaches
// and would otherwise treat `{project.KEY}` as a (broken) JS object
// literal — same trap the SharedEnvVarsEditor's v-pre <code> avoids.
const description =
  "Shared env vars any container under this project can reference via " +
  "$" +
  "{{project.KEY}}. Resolved at deploy / run time.";

// Project-level env-var editor. Container env vars (application +
// database) can reference these via `${{project.<KEY>}}`; the
// backend resolver substitutes at deploy / run time. No bulk-paste
// — keep the project env surface small (typically connection
// strings + API keys shared across containers).
const vars = ref<DockerProjectEnvVar[]>([]);
const isLoading = ref(true);

const fetchVars = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.projects.envVars.list(
      props.serverId,
      props.projectId,
    );
    vars.value = res.data;
  } catch {
    toast.error("Failed to load project env vars");
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchVars);

const onCreate = async (data: {
  key: string;
  value: string;
  is_secret?: boolean;
}) => {
  const res = await dockerService.projects.envVars.create(
    props.serverId,
    props.projectId,
    data,
  );
  return res.data;
};
const onUpdate = async (
  id: string,
  patch: { value?: string; is_secret?: boolean },
) => {
  const res = await dockerService.projects.envVars.update(
    props.serverId,
    props.projectId,
    id,
    patch,
  );
  return res.data;
};
const onDelete = async (id: string) => {
  await dockerService.projects.envVars.delete(
    props.serverId,
    props.projectId,
    id,
  );
};
</script>

<template>
  <!--
    showProjectHint=false intentionally: a project env var can't
    reference itself. No bulk-paste either — kept narrow to nudge
    users toward small, intentional shared config.
  -->
  <SharedEnvVarsEditor
    :vars="vars"
    :loading="isLoading"
    :show-project-hint="false"
    title="Environment"
    :description="description"
    :on-create="onCreate"
    :on-update="onUpdate"
    :on-delete="onDelete"
    @update:vars="(v) => (vars = v as unknown as DockerProjectEnvVar[])"
  />
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerDatabase,
  type DockerDatabaseEnvVar,
} from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

// User-added env vars on a managed database. Sit alongside the
// auto-generated engine credentials (POSTGRES_USER etc); both end
// up as `-e KEY=VALUE` on the docker-run line. Values may
// reference `${{project.<KEY>}}` — the run-database worker
// substitutes at docker-run time (Restart / Rebuild picks them up).
const vars = ref<DockerDatabaseEnvVar[]>([]);
const isLoading = ref(true);

const fetchVars = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.databases.envVars.list(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    vars.value = res.data;
  } catch {
    toast.error("Failed to load database env vars");
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
  const res = await dockerService.databases.envVars.create(
    props.database.server_id,
    props.database.project_id,
    props.database.id,
    data,
  );
  return res.data;
};
const onUpdate = async (
  id: string,
  patch: { value?: string; is_secret?: boolean },
) => {
  const res = await dockerService.databases.envVars.update(
    props.database.server_id,
    props.database.project_id,
    props.database.id,
    id,
    patch,
  );
  return res.data;
};
const onDelete = async (id: string) => {
  await dockerService.databases.envVars.delete(
    props.database.server_id,
    props.database.project_id,
    props.database.id,
    id,
  );
};
</script>

<template>
  <!--
    showProjectHint=true: database env values can reference
    `${{project.<KEY>}}`. No bulk-paste — engine creds dominate the
    surface, the user is typically adding 1-3 tuning flags
    (POSTGRES_INITDB_ARGS, MYSQL_DEFAULT_AUTH...).
  -->
  <SharedEnvVarsEditor
    :vars="vars"
    :loading="isLoading"
    :show-project-hint="true"
    title="Environment"
    description="Extra runtime env vars layered on top of the engine credentials. Save, then Restart to apply (recreates the container, keeps your data). Note: engine credential vars like POSTGRES_PASSWORD only apply on first init — Restart can't change them."
    :on-create="onCreate"
    :on-update="onUpdate"
    :on-delete="onDelete"
    @update:vars="(v) => (vars = v as unknown as DockerDatabaseEnvVar[])"
  />
</template>

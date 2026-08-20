<script setup lang="ts">
import type { DockerDatabase } from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
  <!--
    Database logs reuse the application-logs component with databaseId
    set. The backend resolves the database's container name from
    project + db slug — no container_id column needed on the row.
  -->
  <ApplicationLogs
    :database-id="props.database.id"
    :empty-state-message="t('workload.database.logs.empty')"
  />
</template>

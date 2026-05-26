<script setup lang="ts">
import type { DockerDatabase } from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();
</script>

<template>
  <!--
    Database logs reuse the application-logs component with databaseId
    set. The backend resolves the database's container name from
    project + db slug — no container_id column needed on the row.
  -->
  <ApplicationLogs
    :database-id="props.database.id"
    empty-state-message="The database hasn't started yet. Logs appear here once the container is running."
  />
</template>

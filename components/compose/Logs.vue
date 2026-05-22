<script setup lang="ts">
import type { DockerCompose } from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
</script>

<template>
  <!--
    Compose logs reuse the application-logs component with composeId set.
    The backend handler picks `docker compose logs -f --project-name <name>`
    when composeId is in the query — each line is prefixed with the
    service name by docker compose so the user sees which container
    emitted what.
  -->
  <ApplicationLogs
    :compose-id="props.compose.id"
    empty-state-message="Deploy this compose stack first; logs start streaming once at least one service is running."
  />
</template>

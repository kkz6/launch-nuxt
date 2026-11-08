import type { Ref } from "vue";
import {
  useChannelEvents,
  useDockerApplicationEvents,
  useDockerComposeEvents,
  useDockerProjectEvents,
  useServerEvents,
  useSiteEvents,
} from "~/composables/useChannelEvents";
import { useLiveRefresh } from "~/composables/useLiveRefresh";

/** Refresh header metadata from the same lifecycle events as its resource page. */
export const useNavbarLiveUpdates = (
  teamId: Ref<string>,
  context: {
    serverId: Ref<string | null>;
    siteId: Ref<string | null>;
    projectId: Ref<string | null>;
    workloadId: Ref<string | null>;
    workloadKind: Ref<string | null>;
  },
  refreshResource: () => Promise<unknown>,
  refreshWorkload: () => Promise<unknown>,
) => {
  const resource = useLiveRefresh(refreshResource);
  const workload = useLiveRefresh(refreshWorkload);
  const reconnect = () => {
    if (context.serverId.value) resource();
    if (context.workloadId.value) workload();
  };
  useServerEvents(
    teamId,
    (data) => {
      if (
        context.serverId.value &&
        (data.server_id || data.id) === context.serverId.value
      )
        resource();
    },
    { onReconnect: reconnect },
  );
  useSiteEvents(teamId, (data) => {
    if (
      context.siteId.value &&
      (data.site_id || data.site?.id || data.id) === context.siteId.value
    )
      resource();
  });
  useDockerProjectEvents(teamId, (data) => {
    if (
      context.projectId.value &&
      (data.project_id || data.id) === context.projectId.value
    )
      resource();
  });
  const onWorkload = (
    kind: string,
    key: string,
    data: Record<string, unknown>,
  ) => {
    if (
      context.workloadId.value &&
      context.workloadKind.value === kind &&
      (data[key] || data.id) === context.workloadId.value
    )
      workload();
  };
  useDockerApplicationEvents(teamId, (data) =>
    onWorkload("application", "application_id", data),
  );
  useDockerComposeEvents(teamId, (data) =>
    onWorkload("compose", "compose_id", data),
  );
  useChannelEvents(
    computed(() => `team.${teamId.value}`),
    [
      "docker.database.created",
      "docker.database.updated",
      "docker.database.deleted",
      "docker.database.running",
      "docker.database.failed",
      "docker.database.lifecycle_done",
    ],
    (data) => onWorkload("database", "database_id", data),
  );
};

interface ChannelEventData {
  site_id?: string;
  server_id?: string;
  team_id?: string;
  deployment_id?: string;
  command_id?: string;
  status?: string;
  message?: string;
  error?: string;
  command?: {
    id: string;
    site_id: string;
    command: string;
    status: "pending" | "running" | "finished" | "failed";
    output?: string;
    user?: {
      id: string;
      name: string;
    };
    created_at: string;
    [key: string]: unknown;
  };
  site?: {
    id?: string;
    server_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ChannelEventHandler {
  (data: ChannelEventData, event: string): void;
}

export const useChannelEvents = (
  channel: string | Ref<string>,
  events: string[] | Ref<string[]>,
  onEvent: ChannelEventHandler,
) => {
  const { subscribe, subscribeToChannel, unsubscribeFromChannel, isConnected } =
    useWebSocket();

  const channelValue = computed(() => unref(channel));
  const eventsValue = computed(() => unref(events));

  const unsubscribes: (() => void)[] = [];
  let subscribedChannel: string | null = null;

  const setupSubscriptions = () => {
    cleanup();

    if (isConnected.value && channelValue.value) {
      subscribeToChannel(channelValue.value);
      subscribedChannel = channelValue.value;
    }

    eventsValue.value.forEach((event) => {
      const unsub = subscribe(event, (data) => {
        const eventData = data as ChannelEventData;
        const channelParts = channelValue.value.split(".");
        if (
          channelParts[0] === "site" &&
          eventData.site_id === channelParts[1]
        ) {
          onEvent(eventData, event);
        } else if (
          channelParts[0] === "server" &&
          eventData.server_id === channelParts[1]
        ) {
          onEvent(eventData, event);
        } else if (
          channelParts[0] === "team" &&
          eventData.team_id === channelParts[1]
        ) {
          onEvent(eventData, event);
        } else if (
          channelParts[0] === "deployment" &&
          eventData.deployment_id === channelParts[1]
        ) {
          onEvent(eventData, event);
        }
      });
      unsubscribes.push(unsub);
    });
  };

  const cleanup = () => {
    if (subscribedChannel) {
      unsubscribeFromChannel(subscribedChannel);
      subscribedChannel = null;
    }

    unsubscribes.forEach((unsub) => unsub());
    unsubscribes.length = 0;
  };

  watch(
    [isConnected, channelValue],
    () => {
      if (isConnected.value) {
        setupSubscriptions();
      }
    },
    { immediate: true },
  );

  onScopeDispose(cleanup);

  return {
    isConnected,
  };
};

const useScopedChannelEvents = (
  scope: string,
  id: string | Ref<string>,
  events: string[],
  onEvent: ChannelEventHandler,
) =>
  useChannelEvents(
    computed(() => `${scope}.${unref(id)}`),
    events,
    onEvent,
  );

const useTeamChannelEvents = (
  teamId: string | Ref<string>,
  events: string[],
  onEvent: ChannelEventHandler,
) => useScopedChannelEvents("team", teamId, events, onEvent);

export const useCommandEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(teamId, ["command.updated"], onEvent);
};

export const useDeploymentEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "deployment.started",
      "deployment.progress",
      "deployment.finished",
      "deployment.failed",
      "deployment.timeout",
      "deployment.rollback.started",
      "deployment.rollback.completed",
      "deployment.rollback.failed",
    ],
    onEvent,
  );
};

export const useDeploymentGhaStepsEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(teamId, ["deployment.gha_steps"], onEvent);
};

export const useSiteQueueEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "queue.installed",
      "queue.uninstalled",
      "queue.restarted",
      "queues.synced",
      "queues.restarted",
    ],
    onEvent,
  );
};

export const useDaemonEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "daemon.installed",
      "daemon.uninstalled",
      "daemon.restarted",
      "daemons.synced",
    ],
    onEvent,
  );
};

export const useSiteEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "site.created",
      "site.updated",
      "site.deleted",
      "site.installed",
      "site.installation_failed",
    ],
    onEvent,
  );
};

export const useScriptExecutionEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    ["script.execution.started", "script.output", "script.execution.completed"],
    onEvent,
  );
};

export const useServerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "server.created",
      "server.updated",
      "server.deleted",
      "server.deletion_failed",
      "server.unarchived",
      "server.created_on_provider",
      "server.create_failed",
      "server.waiting_for_connection",
      "server.connected",
      "server.connection_failed",
      "server.provisioning",
      "server.provisioned",
      "server.provision_progress",
      "server.provision_step",
      "server.provision_status",
      "server.provision_error",
      "server.provision_failed",
      "server.provision_timeout",
      "server.software_installed",
      "server.provisioning_cleanup_complete",
      "server.cleanup_failed",
    ],
    onEvent,
  );
};

export const useDockerApplicationEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "docker.application.created",
      "docker.application.updated",
      "docker.application.deleted",
      "docker.application.deploying",
      "docker.application.deployed",
      "docker.application.failed",
      "docker.application.schedule.added",
      "docker.application.schedule.updated",
      "docker.application.schedule.deleted",
      "docker.application.schedule.ran",
      "docker.application.gha_synced",
      "docker.application.gha_install_broken",
      "docker.application.gha_disabled",
      "docker.application.gha_out_of_sync",
    ],
    onEvent,
  );
};

export const useDockerProjectEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "docker.project.created",
      "docker.project.updated",
      "docker.project.deleted",
    ],
    onEvent,
  );
};

export const useDockerComposeEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "docker.compose.created",
      "docker.compose.updated",
      "docker.compose.deleted",
      "docker.compose.deploying",
      "docker.compose.deployed",
      "docker.compose.failed",
      "docker.compose.removed",
      "docker.compose.gha_synced",
      "docker.compose.gha_install_broken",
      "docker.compose.gha_disabled",
    ],
    onEvent,
  );
};

export const useDockerBackupEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "docker.database.backup.configured",
      "docker.database.backup.deleted",
      "docker.database.backup.restored",
      "docker.database.backup.run.started",
      "docker.database.backup.run.progress",
      "docker.database.backup.run.succeeded",
      "docker.database.backup.run.failed",
    ],
    onEvent,
  );
};

export const useBackupEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    ["backup.run.started", "backup.run.succeeded", "backup.run.failed"],
    onEvent,
  );
};

export const useLoadBalancerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "upstream.created",
      "upstream.updated",
      "upstream.deleted",
      "upstream.installed",
      "upstream.install_failed",
      "backend.added",
      "backend.removed",
      "backend.updated",
      "backend.marked_down",
      "backend.marked_up",
      "backend.health_changed",
    ],
    onEvent,
  );
};

export const usePhpExtensionEvents = (
  serverId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useScopedChannelEvents(
    "server",
    serverId,
    ["php.extension_installed", "php.extension_uninstalled"],
    onEvent,
  );
};

export const useServiceEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "service.installed",
      "service.removed",
      "service.status_changed",
      "service.operation",
    ],
    onEvent,
  );
};

export const usePlatformUpdateEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    ["platform_update.status_changed"],
    onEvent,
  );
};
export const useCertificateEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "certificate.created",
      "certificate.updated",
      "certificate.deleted",
      "certificate.expiring_soon",
      "certificate.fanout_required",
    ],
    onEvent,
  );
};

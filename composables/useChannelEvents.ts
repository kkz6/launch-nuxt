interface ChannelEventData {
  site_id?: string;
  server_id?: string;
  team_id?: string;
  deployment_id?: string;
  command_id?: string;
  task_id?: string;
  status?: string;
  message?: string;
  error?: string;
  php_version?: string;
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

export interface ChannelEventsOptions {
  /** Reload canonical state after a connection gap; events are not replayed. */
  onReconnect?: () => void;
}

export const useChannelEvents = (
  channel: string | Ref<string>,
  events: string[] | Ref<string[]>,
  onEvent: ChannelEventHandler,
  options: ChannelEventsOptions = {},
) => {
  const { subscribe, subscribeToChannel, unsubscribeFromChannel, isConnected } =
    useWebSocket();

  const channelValue = computed(() => unref(channel));
  const eventsValue = computed(() => unref(events));
  const unsubscribes: (() => void)[] = [];
  let subscribedChannel: string | null = null;

  const cleanup = () => {
    if (subscribedChannel) {
      unsubscribeFromChannel(subscribedChannel);
      subscribedChannel = null;
    }
    unsubscribes.forEach((unsub) => unsub());
    unsubscribes.length = 0;
  };

  const setupSubscriptions = () => {
    if (import.meta.server) return;
    cleanup();
    const target = channelValue.value;
    const [scope, id] = target.split(".");
    if (!id) return;

    // Keep the desired channel registered while disconnected. The socket
    // restores it once on open; re-registering on every reconnect can race
    // another component's refcount and briefly unsubscribe a live channel.
    subscribeToChannel(target);
    subscribedChannel = target;
    eventsValue.value.forEach((event) => {
      const unsub = subscribe(event, (data, sourceChannel) => {
        if (target !== channelValue.value) return;
        const eventData = data as ChannelEventData;
        const scopeKey = `${scope}_id`;
        if (sourceChannel && sourceChannel !== target) return;
        // Payload scope remains a fallback for older publishers/consumers.
        // If present it must agree even when the envelope names this channel.
        if (eventData[scopeKey] && eventData[scopeKey] !== id) return;
        if (!sourceChannel && eventData[scopeKey] !== id) return;
        onEvent(eventData, event);
      });
      unsubscribes.push(unsub);
    });
  };

  watch([channelValue, eventsValue], setupSubscriptions, {
    immediate: true,
    deep: true,
  });
  watch(isConnected, (connected, previous) => {
    if (connected && previous === false && subscribedChannel) {
      options.onReconnect?.();
    }
  });
  onScopeDispose(cleanup);

  return { isConnected };
};

const useScopedChannelEvents = (
  scope: string,
  id: string | Ref<string>,
  events: string[],
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) =>
  useChannelEvents(
    computed(() => `${scope}.${unref(id)}`),
    events,
    onEvent,
    options,
  );

const useTeamChannelEvents = (
  teamId: string | Ref<string>,
  events: string[],
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => useScopedChannelEvents("team", teamId, events, onEvent, options);

export const useCommandEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(teamId, ["command.updated"], onEvent, options);
};

export const useTaskEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    ["task.created", "task.running", "task.updated"],
    onEvent,
    options,
  );
};

export const useDeploymentEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
      "deployment.runtime.started",
      "deployment.runtime.completed",
      "deployment.runtime.failed",
    ],
    onEvent,
    options,
  );
};

export const useDeploymentGhaStepsEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    ["deployment.gha_steps"],
    onEvent,
    options,
  );
};

export const useSiteQueueEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "queue.installed",
      "queue.uninstalled",
      "queue.restarted",
      "queues.synced",
      "queues.restarted",
      "queues.failed",
    ],
    onEvent,
    options,
  );
};

export const useDaemonEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
    options,
  );
};

export const useSiteEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "site.created",
      "site.updated",
      "site.deleted",
      "site.deletion_failed",
      "site.installed",
      "site.installation_failed",
      "site.php_version_update_requested",
      "site.php_version_updated",
      "site.php_version_update_failed",
    ],
    onEvent,
    options,
  );
};

export const useScriptExecutionEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    ["script.execution.started", "script.output", "script.execution.completed"],
    onEvent,
    options,
  );
};

export const useServerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
    options,
  );
};

export const useDockerApplicationEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
    options,
  );
};

export const useDockerProjectEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "docker.project.created",
      "docker.project.updated",
      "docker.project.deleted",
    ],
    onEvent,
    options,
  );
};

export const useDockerComposeEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
    options,
  );
};

export const useDockerBackupEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "docker.database.backup.configured",
      "docker.database.backup.deleted",
      "docker.database.backup.restored",
      "docker.database.backup.run.queued",
      "docker.database.backup.run.started",
      "docker.database.backup.run.progress",
      "docker.database.backup.run.succeeded",
      "docker.database.backup.run.failed",
    ],
    onEvent,
    options,
  );
};

export const useBackupEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "backup.job.status",
      "backup.run.queued",
      "backup.run.started",
      "backup.run.succeeded",
      "backup.run.failed",
    ],
    onEvent,
    options,
  );
};

export const useLoadBalancerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
    options,
  );
};

export const usePhpExtensionEvents = (
  serverId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useScopedChannelEvents(
    "server",
    serverId,
    ["php.extension_installed", "php.extension_uninstalled"],
    onEvent,
    options,
  );
};

export const useServiceEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    [
      "service.installed",
      "service.removed",
      "service.status_changed",
      "service.operation",
      "php.default_changed",
      "php.default_change",
      "php.patch",
    ],
    onEvent,
    options,
  );
};

export const usePlatformUpdateEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
) => {
  return useTeamChannelEvents(
    teamId,
    ["platform_update.status_changed"],
    onEvent,
    options,
  );
};
export const useCertificateEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
  options?: ChannelEventsOptions,
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
    options,
  );
};

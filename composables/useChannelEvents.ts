interface ChannelEventData {
  site_id?: string
  server_id?: string
  team_id?: string
  deployment_id?: string
  command_id?: string
  status?: string
  message?: string
  error?: string
  site?: {
    id?: string
    server_id?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface ChannelEventHandler {
  // The event name is passed alongside the payload so consumers can branch
  // (e.g. distinguish deployment.started from deployment.finished without
  // having to inspect a status field that some events don't include).
  (data: ChannelEventData, event: string): void
}

/**
 * Composable to subscribe to channel-based events
 *
 * @param channel - The channel to subscribe to (e.g., 'site.{siteId}')
 * @param events - Array of event names to listen for
 * @param onEvent - Callback to run when any matching event is received
 *
 * @example
 * // Listen to command events for a specific site
 * useChannelEvents(
 *   `site.${siteId}`,
 *   ['command.running', 'command.finished', 'command.failed'],
 *   (data) => {
 *     console.log('Command event:', data)
 *     fetchCommands()
 *   }
 * )
 */
export const useChannelEvents = (
  channel: string | Ref<string>,
  events: string[] | Ref<string[]>,
  onEvent: ChannelEventHandler,
) => {
  const { subscribe, subscribeToChannel, unsubscribeFromChannel, isConnected } = useWebSocket()

  const channelValue = computed(() => unref(channel))
  const eventsValue = computed(() => unref(events))

  // Store unsubscribe functions
  const unsubscribes: (() => void)[] = []
  let subscribedChannel: string | null = null

  const setupSubscriptions = () => {
    // Clean up previous subscriptions
    cleanup()

    // Subscribe to the channel
    if (isConnected.value && channelValue.value) {
      subscribeToChannel(channelValue.value)
      subscribedChannel = channelValue.value
    }

    // Subscribe to each event
    eventsValue.value.forEach((event) => {
      const unsub = subscribe(event, (data) => {
        const eventData = data as ChannelEventData
        // Filter by channel context (site_id, server_id, or team_id)
        const channelParts = channelValue.value.split('.')
        if (channelParts[0] === 'site' && eventData.site_id === channelParts[1]) {
          onEvent(eventData, event)
        } else if (channelParts[0] === 'server' && eventData.server_id === channelParts[1]) {
          onEvent(eventData, event)
        } else if (channelParts[0] === 'team' && eventData.team_id === channelParts[1]) {
          onEvent(eventData, event)
        } else if (channelParts[0] === 'deployment' && eventData.deployment_id === channelParts[1]) {
          onEvent(eventData, event)
        }
      })
      unsubscribes.push(unsub)
    })
  }

  const cleanup = () => {
    // Unsubscribe from channel
    if (subscribedChannel) {
      unsubscribeFromChannel(subscribedChannel)
      subscribedChannel = null
    }

    // Unsubscribe from events
    unsubscribes.forEach((unsub) => unsub())
    unsubscribes.length = 0
  }

  // Setup when connected and channel changes
  watch([isConnected, channelValue], () => {
    if (isConnected.value) {
      setupSubscriptions()
    }
  }, { immediate: true })

  // Bind cleanup to the *current effect scope*, not the component
  // instance. In a component's setup() the active scope IS the
  // component, so this still fires on unmount (same behaviour as
  // before). But when called from a Pinia store's detached
  // `effectScope(true).run(...)` — which is exactly how
  // useServersStore subscribes — the active scope is that detached
  // scope, NOT the page component that happened to trigger the
  // store call. With the previous `onUnmounted` + `getCurrentInstance`
  // wiring, the store's WS subscription got torn down the moment the
  // user navigated away from /servers (e.g. into a server detail
  // page); a subsequent return to /servers found the store's
  // `subscribed` flag still true and never re-subscribed, so events
  // like `server.deleted` were silently dropped and rows stayed in
  // the list forever. `onScopeDispose` respects whichever scope is
  // actually responsible for the lifecycle, and is a safe no-op when
  // called outside any scope.
  onScopeDispose(cleanup)

  return {
    isConnected,
  }
}

/**
 * Composable to subscribe to site command events
 * Convenience wrapper for command-related events
 *
 * @param siteId - The site ID
 * @param onEvent - Callback to run when a command event is received
 *
 * @example
 * useSiteCommandEvents(siteId, (data) => {
 *   if (data.status === 'finished') {
 *     toast.success('Command completed')
 *   }
 *   fetchCommands()
 * })
 */
export const useSiteCommandEvents = (
  siteId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const siteIdValue = computed(() => unref(siteId))
  const channel = computed(() => `site.${siteIdValue.value}`)

  return useChannelEvents(
    channel,
    ['command.running', 'command.finished', 'command.failed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to deployment events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a deployment event is received
 */
export const useDeploymentEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'deployment.started',
      'deployment.progress',
      'deployment.finished',
      'deployment.failed',
      'deployment.timeout',
      'deployment.rollback.started',
      'deployment.rollback.completed',
      'deployment.rollback.failed',
    ],
    onEvent,
  )
}

/**
 * Subscribe to the live GitHub Actions step timeline for deployments
 * (#87). The backend poller broadcasts deployment.gha_steps on the team
 * channel with a deployment_id; consumers filter by that id to render the
 * matching deployment's step list. Payload carries { deployment_id,
 * target_type, target_id, run_id, run_status, jobs }.
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a step-timeline event is received
 */
export const useDeploymentGhaStepsEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(channel, ['deployment.gha_steps'], onEvent)
}

/**
 * Composable to subscribe to site queue events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a queue event is received
 */
export const useSiteQueueEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['queue.installed', 'queue.uninstalled', 'queue.restarted', 'queues.synced', 'queues.restarted'],
    onEvent,
  )
}

/**
 * Composable to subscribe to daemon events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a daemon event is received
 */
export const useDaemonEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['daemon.installed', 'daemon.uninstalled', 'daemon.restarted', 'daemons.synced'],
    onEvent,
  )
}

/**
 * Composable to subscribe to site lifecycle events (created, updated, deleted, installed)
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a site event is received
 */
export const useSiteEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['site.created', 'site.updated', 'site.deleted', 'site.installed', 'site.installation_failed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to script execution events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a script execution event is received
 *
 * Events:
 * - script.execution.started: Execution began (data: { execution_id, script_id, server_id })
 * - script.output: Incremental output chunk (data: { execution_id, output })
 * - script.execution.completed: Execution finished (data: { execution_id, status, exit_code })
 */
export const useScriptExecutionEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['script.execution.started', 'script.output', 'script.execution.completed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to server lifecycle and provision events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a server event is received
 *
 * Events:
 * - server.created: New server was created
 * - server.updated: Server was updated
 * - server.deleted: Server was deleted
 * - server.provisioning: Server provisioning started
 * - server.provision_progress: Provisioning progress update
 * - server.provision_step: A provision step completed
 * - server.provision_status: Provision status message update
 * - server.provision_failed: Provisioning failed
 * - server.software_installed: Software installation completed
 */
export const useServerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      // Lifecycle
      'server.created',
      'server.updated',
      'server.deleted',
      'server.deletion_failed',
      'server.unarchived',
      // Cloud-provider create flow (backend: jobs/create_on_provider.go,
      // jobs/wait_for_server_to_connect.go) — these used to be missing, which
      // is why a failed DO/AWS create-on-provider didn't reach the UI live.
      'server.created_on_provider',
      'server.create_failed',
      'server.waiting_for_connection',
      'server.connected',
      'server.connection_failed',
      // Provisioning flow (backend: tasks/provision_*.go, jobs/provision_server.go)
      'server.provisioning',
      'server.provisioned',
      'server.provision_progress',
      'server.provision_step',
      'server.provision_status',
      'server.provision_error',
      'server.provision_failed',
      'server.provision_timeout',
      'server.software_installed',
      // Cleanup (backend: jobs/cleanup_failed_provisioning.go)
      'server.provisioning_cleanup_complete',
      'server.cleanup_failed',
    ],
    onEvent,
  )
}

/**
 * Composable to subscribe to docker application lifecycle events.
 *
 * Events fire on the team channel. The handler must filter by
 * application_id (or project_id) since multiple apps' events arrive on
 * the same channel.
 *
 * Events:
 * - docker.application.created
 * - docker.application.updated
 * - docker.application.deleted
 * - docker.application.deploying  (deploy job started)
 * - docker.application.deployed   (deploy succeeded, container running)
 * - docker.application.failed     (deploy failed)
 * - docker.application.gha_synced            (bootstrap job committed workflow file)
 * - docker.application.gha_install_broken    (GitHub App install gone / 404 from GitHub)
 * - docker.application.gha_disabled          (build_location flipped back to server)
 */
export const useDockerApplicationEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'docker.application.created',
      'docker.application.updated',
      'docker.application.deleted',
      'docker.application.deploying',
      'docker.application.deployed',
      'docker.application.failed',
      // Schedule lifecycle — fired by RunApplicationScheduleJob on
      // every tick so the Schedules subtab refreshes Last Run /
      // Status / Last Task without polling.
      'docker.application.schedule.added',
      'docker.application.schedule.updated',
      'docker.application.schedule.deleted',
      'docker.application.schedule.ran',
      // GHA-builds lifecycle. The bootstrap job fires gha_synced on
      // successful repo commit; gha_install_broken when the GitHub
      // App installation has been removed customer-side; gha_disabled
      // when the user flips build_location back to "server" via the
      // GHA subtab. UI subscribes here so the subtab can refetch the
      // workflow status / show a broken-install banner / clear the
      // GHA pill without polling.
      'docker.application.gha_synced',
      'docker.application.gha_install_broken',
      'docker.application.gha_disabled',
      // Fired when a build-secret change leaves the committed workflow
      // YAML / repo secrets stale. Drives the "re-sync workflow" banner
      // on the Environment tab's Build-time section (carries
      // pending_changes for the "N pending changes" copy).
      'docker.application.gha_out_of_sync',
    ],
    onEvent,
  )
}

/**
 * Composable to subscribe to docker project lifecycle events.
 *
 * Events:
 * - docker.project.created
 * - docker.project.updated
 * - docker.project.deleted
 */
export const useDockerProjectEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'docker.project.created',
      'docker.project.updated',
      'docker.project.deleted',
    ],
    onEvent,
  )
}

/**
 * Compose stack lifecycle events. Mirrors useDockerApplicationEvents
 * — same list-view refresh pattern, same broadcast names with
 * "application" → "compose". The backend normalises the payload so
 * every event carries `compose_id` even when ComposeResponse's JSON
 * field is just `id` (see compose_service.go composeBroadcast).
 */
export const useDockerComposeEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'docker.compose.created',
      'docker.compose.updated',
      'docker.compose.deleted',
      'docker.compose.deploying',
      'docker.compose.deployed',
      'docker.compose.failed',
      'docker.compose.removed',
      // GHA-builds lifecycle — same contract as the application path.
      // See useDockerApplicationEvents above for what each event means;
      // the broadcast names just swap `application` → `compose`.
      'docker.compose.gha_synced',
      'docker.compose.gha_install_broken',
      'docker.compose.gha_disabled',
    ],
    onEvent,
  )
}

/**
 * Database backup lifecycle events. Both the synchronous "Run now"
 * path (BackupService.RunNow) and the every-minute scheduled poller
 * (jobs.PollDueBackupsJob → jobs.RunBackupJob) fire the same event
 * names — the Backups subtab refetches its run history on any of them
 * so the new row appears without a manual reload.
 *
 * Events:
 * - docker.database.backup.configured (config created/updated)
 * - docker.database.backup.deleted    (config removed)
 * - docker.database.backup.restored   (restore-from-snapshot finished)
 * - docker.database.backup.run.started   (scheduled run dispatched)
 * - docker.database.backup.run.succeeded (run uploaded to S3)
 * - docker.database.backup.run.failed    (dump or upload failed)
 */
export const useDockerBackupEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'docker.database.backup.configured',
      'docker.database.backup.deleted',
      'docker.database.backup.restored',
      'docker.database.backup.run.started',
      'docker.database.backup.run.progress',
      'docker.database.backup.run.succeeded',
      'docker.database.backup.run.failed',
    ],
    onEvent,
  )
}

/**
 * Composable to subscribe to server-level backup run events on the team
 * channel — fired by the backup module's RunManualBackupJob. The
 * Advanced → Backups tab uses these to auto-open + attach the live log
 * console on a manual Run Backup and refresh the row on finish.
 *
 * Events:
 * - backup.run.started   (worker created the task; payload carries task_id)
 * - backup.run.succeeded (tar + upload completed)
 * - backup.run.failed    (any step bailed; payload carries error message)
 */
export const useBackupEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['backup.run.started', 'backup.run.succeeded', 'backup.run.failed'],
    onEvent,
  )
}

/**
 * Composable to subscribe to load balancer upstream and backend events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a load balancer event is received
 *
 * Events:
 * - upstream.created: New upstream was created
 * - upstream.updated: Upstream was updated
 * - upstream.deleted: Upstream was deleted
 * - upstream.installed: Upstream Caddyfile installed on LB server
 * - upstream.install_failed: Upstream Caddyfile installation failed
 * - backend.added: Backend added to an upstream
 * - backend.removed: Backend removed from an upstream
 * - backend.updated: Backend was updated
 * - backend.marked_down: Backend marked as down
 * - backend.marked_up: Backend marked as up
 * - backend.health_changed: Backend health status changed
 */
export const useLoadBalancerEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'upstream.created',
      'upstream.updated',
      'upstream.deleted',
      'upstream.installed',
      'upstream.install_failed',
      'backend.added',
      'backend.removed',
      'backend.updated',
      'backend.marked_down',
      'backend.marked_up',
      'backend.health_changed',
    ],
    onEvent,
  )
}

/**
 * Composable to subscribe to PHP extension events
 *
 * @param serverId - The server ID
 * @param onEvent - Callback to run when a PHP extension event is received
 *
 * Events:
 * - php.extension_installed: Extension was installed successfully
 * - php.extension_uninstalled: Extension was uninstalled successfully
 */
export const usePhpExtensionEvents = (
  serverId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const serverIdValue = computed(() => unref(serverId))
  const channel = computed(() => `server.${serverIdValue.value}`)

  return useChannelEvents(
    channel,
    ['php.extension_installed', 'php.extension_uninstalled'],
    onEvent,
  )
}

/**
 * Composable to subscribe to service events (install, remove, status changes)
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a service event is received
 *
 * Events:
 * - service.installed: Service was installed successfully
 * - service.removed: Service was removed successfully
 * - service.status_changed: Service status changed (e.g., uninstalling)
 * - service.operation: Service operation completed (start, stop, restart)
 */
export const useServiceEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['service.installed', 'service.removed', 'service.status_changed', 'service.operation'],
    onEvent,
  )
}

/**
 * Composable to subscribe to platform update events
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a platform update event is received
 *
 * Events:
 * - platform_update.status_changed: A server's update status changed (pending, running, completed, failed)
 */
export const usePlatformUpdateEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    ['platform_update.status_changed'],
    onEvent,
  )
}


/**
 * Composable to subscribe to stored-certificate library events.
 *
 * Fires on the team channel. The certificate module broadcasts:
 *
 * - certificate.created / certificate.updated / certificate.deleted:
 *   library CRUD operations on /api/certificates.
 * - certificate.expiring_soon: emitted daily by the
 *   certificate:warn_expiring job for every cert whose not_after
 *   falls in the next 30 days. Payload carries certificate_id, name,
 *   not_after, days_remaining. Drives the dashboard expiring-soon
 *   banner.
 * - certificate.fanout_required: stored cert content changed; the
 *   referenced sites / docker domains need their PEM files re-pushed
 *   before the new cert is served. Wiring TBD (Phase 6 follow-up).
 *
 * @param teamId - The team ID
 * @param onEvent - Callback to run when a certificate event is received
 */
export const useCertificateEvents = (
  teamId: string | Ref<string>,
  onEvent: ChannelEventHandler,
) => {
  const teamIdValue = computed(() => unref(teamId))
  const channel = computed(() => `team.${teamIdValue.value}`)

  return useChannelEvents(
    channel,
    [
      'certificate.created',
      'certificate.updated',
      'certificate.deleted',
      'certificate.expiring_soon',
      'certificate.fanout_required',
    ],
    onEvent,
  )
}

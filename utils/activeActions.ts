export type ActiveActionTargetType =
  'server' | 'site' | 'application' | 'compose' | 'database'

export interface ActiveAction {
  id: string
  kind: string
  status: string
  label: string
  description?: string
  server_id: string
  project_id?: string
  target_type: ActiveActionTargetType
  target_id: string
  task_id?: string
  started_at?: string
  created_at: string
}

export interface ActiveActionEventData {
  deployment_id?: string
  command_id?: string
  task_id?: string
  job_id?: string
  run_id?: string
  status?: string
}

export type ActiveActionStatusTone =
  'running' | 'success' | 'failure' | 'neutral'

export interface ActiveActionRequestGuard {
  start: () => number
  invalidate: () => void
  isCurrent: (request: number) => boolean
}

export const createActiveActionRequestGuard = (): ActiveActionRequestGuard => {
  let sequence = 0

  return {
    start: () => ++sequence,
    invalidate: () => {
      sequence += 1
    },
    isCurrent: (request) => request === sequence,
  }
}

const runningStatuses = new Set([
  'triggered',
  'pending',
  'installing',
  'building',
  'deploying',
  'running',
])

const successfulStatuses = new Set(['finished', 'completed', 'success'])
const failedStatuses = new Set(['failed', 'timeout', 'cancelled'])

const deploymentStatusLabels: Record<string, string> = {
  pending: 'Queued',
  installing: 'Deploying',
  building: 'Building',
  deploying: 'Deploying',
  running: 'Deploying',
  finished: 'Completed',
  completed: 'Completed',
  success: 'Completed',
  failed: 'Failed',
  timeout: 'Timed out',
  cancelled: 'Cancelled',
}

const backupStatusLabels: Record<string, string> = {
  triggered: 'Queued',
  pending: 'Queued',
  running: 'Running',
  finished: 'Completed',
  completed: 'Completed',
  success: 'Completed',
  failed: 'Failed',
  timeout: 'Timed out',
  cancelled: 'Cancelled',
}

const eventStatuses: Record<string, string> = {
  'deployment.started': 'deploying',
  'deployment.finished': 'finished',
  'deployment.failed': 'failed',
  'deployment.timeout': 'timeout',
  'deployment.rollback.started': 'deploying',
  'deployment.rollback.completed': 'finished',
  'deployment.rollback.failed': 'failed',
  'backup.run.queued': 'pending',
  'backup.run.started': 'running',
  'backup.run.succeeded': 'finished',
  'backup.run.failed': 'failed',
  'docker.database.backup.run.queued': 'pending',
  'docker.database.backup.run.started': 'running',
  'docker.database.backup.run.progress': 'running',
  'docker.database.backup.run.succeeded': 'success',
  'docker.database.backup.run.failed': 'failed',
}

export const humanizeActionValue = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

export const activeActionStatusLabel = (action: ActiveAction) => {
  if (action.kind === 'deployment') {
    return (
      deploymentStatusLabels[action.status] ||
      humanizeActionValue(action.status)
    )
  }

  if (action.kind === 'server_backup' || action.kind === 'database_backup') {
    return (
      backupStatusLabels[action.status] || humanizeActionValue(action.status)
    )
  }

  return humanizeActionValue(action.status)
}

export const activeActionStatusTone = (
  status: string,
): ActiveActionStatusTone => {
  if (runningStatuses.has(status)) return 'running'
  if (successfulStatuses.has(status)) return 'success'
  if (failedStatuses.has(status)) return 'failure'
  return 'neutral'
}

export const isActiveActionRunning = (action: ActiveAction) =>
  activeActionStatusTone(action.status) === 'running'

const eventActionId = (
  action: ActiveAction,
  data: ActiveActionEventData,
): string | undefined => {
  switch (action.kind) {
    case 'command':
      return data.command_id
    case 'task':
      return data.task_id
    case 'server_backup':
      return data.job_id
    case 'database_backup':
      return data.run_id
    default:
      return data.deployment_id
  }
}

export const updateActionFromEvent = (
  action: ActiveAction | null,
  data: ActiveActionEventData,
  event: string,
) => {
  if (!action || action.id !== eventActionId(action, data)) return action

  const status = data.status || eventStatuses[event]
  if (!status) return action

  const currentTone = activeActionStatusTone(action.status)
  const isBackup =
    action.kind === 'server_backup' || action.kind === 'database_backup'
  if (
    isBackup &&
    (currentTone === 'success' || currentTone === 'failure')
  ) {
    return action
  }

  return { ...action, status }
}

export const activeActionPath = (action: ActiveAction) => {
  const serverPath = `/servers/${action.server_id}`

  if (action.kind === 'server_backup') {
    return `${serverPath}?tab=advanced&subtab=backups`
  }

  if (action.kind === 'database_backup') {
    return `${serverPath}/projects/${action.project_id}/databases/${action.target_id}?subtab=backups`
  }

  if (action.target_type === 'server') return serverPath

  if (action.target_type === 'site') {
    const tab = action.kind === 'command' ? 'commands' : 'deployments'
    return `${serverPath}/sites/${action.target_id}?tab=${tab}`
  }

  const segment =
    action.target_type === 'application'
      ? 'applications'
      : action.target_type === 'database'
        ? 'databases'
        : 'composes'

  return `${serverPath}/projects/${action.project_id}/${segment}/${action.target_id}?tab=deployments`
}

// Terminal actions are retained server-side for a while so a failure is still
// readable after it finishes, which means the list can hold work the user has
// already dealt with. These two keep that dismissal honest.

export const visibleActiveActions = (
  actions: ActiveAction[],
  dismissedIds: string[],
) => {
  const dismissed = new Set(dismissedIds)
  return actions.filter((action) => !dismissed.has(action.id))
}

// Drop ids the server no longer returns. Without this the dismissed list
// grows forever, and an id could later suppress an unrelated action that
// happened to reuse it.
export const pruneDismissedIds = (
  dismissedIds: string[],
  actions: ActiveAction[],
) => {
  const live = new Set(actions.map((action) => action.id))
  return dismissedIds.filter((id) => live.has(id))
}

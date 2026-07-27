export type ActiveActionTargetType =
  'site' | 'application' | 'compose' | 'database'

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
  status?: string
}

export type ActiveActionStatusTone =
  'running' | 'success' | 'failure' | 'neutral'

const runningStatuses = new Set([
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

const terminalEventStatuses: Record<string, string> = {
  'deployment.finished': 'finished',
  'deployment.failed': 'failed',
  'deployment.timeout': 'timeout',
  'deployment.rollback.completed': 'finished',
  'deployment.rollback.failed': 'failed',
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

export const updateActionFromEvent = (
  action: ActiveAction | null,
  data: ActiveActionEventData,
  event: string,
) => {
  if (!action) return action

  const eventActionId =
    action.kind === 'command' ? data.command_id : data.deployment_id
  if (action.id !== eventActionId) return action

  const status = data.status || terminalEventStatuses[event]
  return status ? { ...action, status } : action
}

export const activeActionPath = (action: ActiveAction) => {
  const serverPath = `/servers/${action.server_id}`
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

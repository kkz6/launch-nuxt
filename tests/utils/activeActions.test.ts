import { describe, expect, it } from 'vitest'
import {
  activeActionPath,
  activeActionStatusLabel,
  activeActionStatusTone,
  updateActionFromEvent,
  type ActiveAction,
} from '../../utils/activeActions'

const action = (overrides: Partial<ActiveAction> = {}): ActiveAction => ({
  id: 'deployment-1',
  kind: 'deployment',
  status: 'installing',
  label: 'example.com',
  server_id: 'server-1',
  project_id: 'project-1',
  target_type: 'site',
  target_id: 'site-1',
  task_id: 'task-1',
  created_at: '2026-07-27T10:00:00Z',
  ...overrides,
})

describe('activeActionStatusLabel', () => {
  it.each([
    ['installing', 'Deploying'],
    ['deploying', 'Deploying'],
    ['building', 'Building'],
    ['finished', 'Completed'],
    ['success', 'Completed'],
    ['timeout', 'Timed out'],
  ])('maps deployment status %s to %s', (status, label) => {
    expect(activeActionStatusLabel(action({ status }))).toBe(label)
  })
})

describe('activeActionStatusTone', () => {
  it('stops showing progress for terminal statuses', () => {
    expect(activeActionStatusTone('finished')).toBe('success')
    expect(activeActionStatusTone('failed')).toBe('failure')
    expect(activeActionStatusTone('timeout')).toBe('failure')
  })
})

describe('updateActionFromEvent', () => {
  it('updates the selected action from a terminal event payload', () => {
    const updated = updateActionFromEvent(
      action(),
      { deployment_id: 'deployment-1', status: 'finished' },
      'deployment.finished',
    )

    expect(updated?.status).toBe('finished')
  })

  it('uses the event name when a terminal event omits status', () => {
    const updated = updateActionFromEvent(
      action(),
      { deployment_id: 'deployment-1' },
      'deployment.failed',
    )

    expect(updated?.status).toBe('failed')
  })

  it('does not update a different deployment', () => {
    const selected = action()
    expect(
      updateActionFromEvent(
        selected,
        { deployment_id: 'deployment-2', status: 'finished' },
        'deployment.finished',
      ),
    ).toBe(selected)
  })

  it('updates a selected command from command.updated', () => {
    const updated = updateActionFromEvent(
      action({ id: 'command-1', kind: 'command', status: 'running' }),
      { command_id: 'command-1', status: 'finished' },
      'command.updated',
    )

    expect(updated?.status).toBe('finished')
  })

  it('updates a selected server task from task.updated', () => {
    const updated = updateActionFromEvent(
      action({
        id: 'task-1',
        kind: 'task',
        status: 'running',
        target_type: 'server',
        target_id: 'server-1',
      }),
      { task_id: 'task-1', status: 'finished' },
      'task.updated',
    )

    expect(updated?.status).toBe('finished')
  })
})

describe('activeActionPath', () => {
  it('routes site deployments to the site deployment tab', () => {
    expect(activeActionPath(action())).toBe(
      '/servers/server-1/sites/site-1?tab=deployments',
    )
  })

  it('routes managed database actions to the database deployment tab', () => {
    expect(
      activeActionPath(
        action({ target_type: 'database', target_id: 'database-1' }),
      ),
    ).toBe(
      '/servers/server-1/projects/project-1/databases/database-1?tab=deployments',
    )
  })

  it('routes command actions to the site commands tab', () => {
    expect(
      activeActionPath(
        action({ id: 'command-1', kind: 'command', task_id: undefined }),
      ),
    ).toBe('/servers/server-1/sites/site-1?tab=commands')
  })

  it('routes server task actions to the server page', () => {
    expect(
      activeActionPath(
        action({
          id: 'task-1',
          kind: 'task',
          target_type: 'server',
          target_id: 'server-1',
        }),
      ),
    ).toBe('/servers/server-1')
  })
})

import { describe, expect, it } from 'vitest'
import {
  activeActionPath,
  activeActionStatusLabel,
  activeActionStatusTone,
  createActiveActionRequestGuard,
  pruneDismissedIds,
  updateActionFromEvent,
  visibleActiveActions,
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

describe('createActiveActionRequestGuard', () => {
  it('accepts only the current request and supports invalidation', () => {
    const guard = createActiveActionRequestGuard()
    const first = guard.start()
    expect(guard.isCurrent(first)).toBe(true)

    const second = guard.start()
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(second)).toBe(true)

    guard.invalidate()
    expect(guard.isCurrent(second)).toBe(false)
  })
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

  it.each([
    ['triggered', 'Queued'],
    ['pending', 'Queued'],
    ['running', 'Running'],
    ['finished', 'Completed'],
    ['failed', 'Failed'],
  ])('maps backup status %s to %s', (status, label) => {
    expect(
      activeActionStatusLabel(action({ kind: 'server_backup', status })),
    ).toBe(label)
    expect(
      activeActionStatusLabel(action({ kind: 'database_backup', status })),
    ).toBe(label)
  })
})

describe('activeActionStatusTone', () => {
  it('stops showing progress for terminal statuses', () => {
    expect(activeActionStatusTone('triggered')).toBe('running')
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

  it.each([
    ['server_backup', 'job_id', 'job-1', 'backup.run.queued', 'pending'],
    ['server_backup', 'job_id', 'job-1', 'backup.run.started', 'running'],
    ['server_backup', 'job_id', 'job-1', 'backup.run.succeeded', 'finished'],
    ['server_backup', 'job_id', 'job-1', 'backup.run.failed', 'failed'],
    [
      'database_backup',
      'run_id',
      'run-1',
      'docker.database.backup.run.queued',
      'pending',
    ],
    [
      'database_backup',
      'run_id',
      'run-1',
      'docker.database.backup.run.progress',
      'running',
    ],
    [
      'database_backup',
      'run_id',
      'run-1',
      'docker.database.backup.run.succeeded',
      'success',
    ],
    [
      'database_backup',
      'run_id',
      'run-1',
      'docker.database.backup.run.failed',
      'failed',
    ],
  ])(
    'correlates %s lifecycle events',
    (kind, idField, id, event, expectedStatus) => {
      const updated = updateActionFromEvent(
        action({ id, kind, status: 'pending' }),
        { [idField]: id },
        event,
      )

      expect(updated?.status).toBe(expectedStatus)
    },
  )

  it('uses explicit scheduled-job status updates', () => {
    const updated = updateActionFromEvent(
      action({ id: 'job-1', kind: 'server_backup', status: 'pending' }),
      { job_id: 'job-1', status: 'failed' },
      'backup.job.status',
    )

    expect(updated?.status).toBe('failed')
  })

  it('does not regress a terminal backup from a late progress event', () => {
    const terminal = action({
      id: 'run-1',
      kind: 'database_backup',
      status: 'failed',
    })

    expect(
      updateActionFromEvent(
        terminal,
        { run_id: 'run-1' },
        'docker.database.backup.run.progress',
      ),
    ).toBe(terminal)
  })

  it('allows rollback to reopen a terminal deployment', () => {
    const updated = updateActionFromEvent(
      action({ status: 'finished' }),
      { deployment_id: 'deployment-1' },
      'deployment.rollback.started',
    )

    expect(updated?.status).toBe('deploying')
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

  it('routes taskless server backups to backup settings', () => {
    expect(
      activeActionPath(
        action({
          kind: 'server_backup',
          target_type: 'server',
          target_id: 'server-1',
          task_id: undefined,
        }),
      ),
    ).toBe('/servers/server-1?tab=advanced&subtab=backups')
  })

  it('routes taskless database backups to the backup subtab', () => {
    expect(
      activeActionPath(
        action({
          kind: 'database_backup',
          target_type: 'database',
          target_id: 'database-1',
          task_id: undefined,
        }),
      ),
    ).toBe(
      '/servers/server-1/projects/project-1/databases/database-1?subtab=backups',
    )
  })
})

describe('visibleActiveActions', () => {
  const actions = [
    { id: 'a', status: 'running' },
    { id: 'b', status: 'failed' },
    { id: 'c', status: 'finished' },
  ] as ActiveAction[]

  it('hides dismissed actions and keeps the rest in order', () => {
    expect(visibleActiveActions(actions, ['b']).map((a) => a.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('returns everything when nothing is dismissed', () => {
    expect(visibleActiveActions(actions, [])).toHaveLength(3)
  })

  it('ignores ids that are not present', () => {
    expect(visibleActiveActions(actions, ['zzz'])).toHaveLength(3)
  })
})

describe('pruneDismissedIds', () => {
  it('drops ids the server no longer returns', () => {
    const actions = [{ id: 'a' }, { id: 'b' }] as ActiveAction[]
    expect(pruneDismissedIds(['a', 'gone'], actions)).toEqual(['a'])
  })

  it('empties out once the actions are gone', () => {
    expect(pruneDismissedIds(['a', 'b'], [])).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import {
  reconcileCommandUpdate,
  type SiteCommand,
} from '../../utils/siteCommands'

const command = (overrides: Partial<SiteCommand> = {}): SiteCommand => ({
  id: 'command-1',
  site_id: 'site-1',
  command: 'php artisan migrate --force',
  status: 'running',
  created_at: '2026-07-27T10:00:00Z',
  ...overrides,
})

describe('reconcileCommandUpdate', () => {
  it('updates the command immediately when its lifecycle event arrives', () => {
    const current = [command()]
    const updated = reconcileCommandUpdate(
      current,
      {
        site_id: 'site-1',
        command: command({ status: 'finished', output: 'Done' }),
      },
      'site-1',
    )

    expect(updated).toEqual([
      expect.objectContaining({ status: 'finished', output: 'Done' }),
    ])
  })

  it('prepends a command that is not in the current page state', () => {
    const updated = reconcileCommandUpdate(
      [],
      { site_id: 'site-1', command: command() },
      'site-1',
    )

    expect(updated).toHaveLength(1)
    expect(updated[0]?.id).toBe('command-1')
  })

  it('ignores command events for another site', () => {
    const current = [command()]
    expect(
      reconcileCommandUpdate(
        current,
        { site_id: 'site-2', command: command({ site_id: 'site-2' }) },
        'site-1',
      ),
    ).toBe(current)
  })
})

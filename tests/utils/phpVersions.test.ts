import { describe, expect, it } from 'vitest'
import {
  hasPendingDefaultPhpChange,
  installedPhpServiceId,
  pendingPhpVersionKey,
  phpDefaultEndpoint,
  phpPatchErrorSummary,
  phpPatchEndpoint,
  phpVersionKey,
  phpVersionOptions,
  sitePhpVersionState,
  updatingPhpServiceIds,
} from '~/utils/phpVersions'

describe('phpVersionKey', () => {
  it.each([
    ['8.3', 'php83'],
    ['8.3.6', 'php83'],
    ['8.4.1', 'php84'],
    ['php82', 'php82'],
  ])('normalizes %s to %s', (version, expected) => {
    expect(phpVersionKey(version)).toBe(expected)
  })
})

describe('phpVersionOptions', () => {
  it('uses canonical site keys while preserving installed patch versions', () => {
    expect(
      phpVersionOptions([
        { version: '8.3.6', is_default: true },
        { version: '8.2.20', is_default: false },
      ]),
    ).toEqual({
      php83: 'PHP 8.3.6 (Default)',
      php82: 'PHP 8.2.20',
    })
  })
})

describe('site PHP version state', () => {
  it('selects the explicit pending PHP target after a reload', () => {
    expect(
      sitePhpVersionState({
        php_version: 'php83',
        pending_php_version: '8.4.2',
      }),
    ).toEqual({
      persisted: 'php83',
      pending: 'php84',
      selected: 'php84',
    })
  })

  it('does not infer a PHP update without a pending PHP target', () => {
    expect(
      sitePhpVersionState({
        php_version: 'php83',
        pending_php_version: null,
      }),
    ).toEqual({
      persisted: 'php83',
      pending: null,
      selected: 'php83',
    })
    expect(pendingPhpVersionKey(undefined)).toBeNull()
  })
})

describe('installed PHP service actions', () => {
  it('uses the installed service ID instead of the PHP software key', () => {
    const serviceId = installedPhpServiceId({
      details: { id: 'service-php83' },
    })

    expect(serviceId).toBe('service-php83')
    expect(phpPatchEndpoint('server-1', serviceId!)).toBe(
      '/servers/server-1/php/service-php83/patch',
    )
    expect(phpDefaultEndpoint('server-1', serviceId!)).toBe(
      '/servers/server-1/php/service-php83/default',
    )
  })

  it('does not fall back to a version key when service identity is missing', () => {
    expect(installedPhpServiceId({})).toBeNull()
  })
})

describe('updatingPhpServiceIds', () => {
  it('rebuilds patch state only from PHP services still updating', () => {
    expect([
      ...updatingPhpServiceIds([
        { id: 'php83', type: 'php', status: 'updating' },
        { id: 'php82', type: 'php', status: 'running' },
        { id: 'agent', type: 'launch_agent', status: 'updating' },
      ]),
    ]).toEqual(['php83'])
  })

  it('returns an empty set after a patch reaches a terminal status', () => {
    expect(
      updatingPhpServiceIds([{ id: 'php83', type: 'php', status: 'failed' }])
        .size,
    ).toBe(0)
  })
})

describe('hasPendingDefaultPhpChange', () => {
  it('detects only pending default changes on PHP services', () => {
    expect(
      hasPendingDefaultPhpChange([
        {
          id: 'php83',
          type: 'php',
          status: 'running',
          default_change_pending: true,
        },
      ]),
    ).toBe(true)

    expect(
      hasPendingDefaultPhpChange([
        {
          id: 'agent',
          type: 'launch_agent',
          status: 'running',
          default_change_pending: true,
        },
        { id: 'php83', type: 'php', status: 'running' },
      ]),
    ).toBe(false)
  })
})

describe('phpPatchErrorSummary', () => {
  it('keeps a compact actionable error from multiline task output', () => {
    expect(
      phpPatchErrorSummary(
        'failed to patch PHP 8.3:\n  apt repository unavailable',
      ),
    ).toBe('failed to patch PHP 8.3: apt repository unavailable')
  })

  it('truncates oversized output and handles missing output', () => {
    expect(phpPatchErrorSummary('123456', 5)).toBe('1234…')
    expect(phpPatchErrorSummary('   ')).toBeNull()
  })
})

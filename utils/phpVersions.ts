export interface InstalledPhpVersion {
  version: string
  is_default: boolean
}

export interface SitePhpVersionState {
  php_version?: string
  pending_php_version?: string | null
}

export interface PhpVersionDetails {
  id: string
}

export interface PatchablePhpVersion {
  details?: PhpVersionDetails
}

export interface PhpServiceStatus {
  id: string
  type: string
  status: string
  default_change_pending?: boolean
}

export const phpVersionKey = (version: string) => {
  const normalizedVersion = version.trim().toLowerCase()
  if (/^php\d+$/.test(normalizedVersion)) return normalizedVersion

  const versionParts = normalizedVersion.match(/^(\d+)\.(\d+)/)
  if (!versionParts) return normalizedVersion

  return `php${versionParts[1]}${versionParts[2]}`
}

export const pendingPhpVersionKey = (
  version: string | null | undefined,
): string | null => {
  if (!version) return null

  return phpVersionKey(version) || null
}

export const sitePhpVersionState = (site: SitePhpVersionState) => {
  const persisted = phpVersionKey(site.php_version || '')
  const pending = pendingPhpVersionKey(site.pending_php_version)

  return {
    persisted,
    pending,
    selected: pending || persisted,
  }
}

export const phpVersionOptions = (versions: InstalledPhpVersion[]) =>
  versions.reduce<Record<string, string>>((options, version) => {
    const key = phpVersionKey(version.version)
    options[key] =
      `PHP ${version.version}${version.is_default ? ' (Default)' : ''}`
    return options
  }, {})

export const installedPhpServiceId = (version: PatchablePhpVersion) =>
  version.details?.id || null

const phpServiceActionEndpoint = (
  serverId: string,
  serviceId: string,
  action: 'default' | 'patch',
) =>
  `/servers/${encodeURIComponent(serverId)}/php/${encodeURIComponent(serviceId)}/${action}`

export const phpPatchEndpoint = (serverId: string, serviceId: string) =>
  phpServiceActionEndpoint(serverId, serviceId, 'patch')

export const phpDefaultEndpoint = (serverId: string, serviceId: string) =>
  phpServiceActionEndpoint(serverId, serviceId, 'default')

export const updatingPhpServiceIds = (services: PhpServiceStatus[]) =>
  new Set(
    services
      .filter(
        (service) => service.type === 'php' && service.status === 'updating',
      )
      .map((service) => service.id),
  )

export const hasPendingDefaultPhpChange = (services: PhpServiceStatus[]) =>
  services.some(
    (service) =>
      service.type === 'php' && service.default_change_pending === true,
  )

export const phpPatchErrorSummary = (
  output: string | undefined,
  maxLength = 240,
): string | null => {
  const summary = output?.replace(/\s+/g, ' ').trim()
  if (!summary) return null
  if (summary.length <= maxLength) return summary

  return `${summary.slice(0, Math.max(0, maxLength - 1))}…`
}

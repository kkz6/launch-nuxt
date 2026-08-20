import type { LogInfo } from "~/types";

interface SiteFileMetadata {
  name: string;
  description?: string;
  file_type?: string;
}

const siteFileMessageKeys = {
  caddyfile: {
    name: "site.files.metadata.caddyfile.name",
    description: "site.files.metadata.caddyfile.description",
  },
  environment: {
    name: "site.files.metadata.environment.name",
    description: "site.files.metadata.environment.description",
  },
  composer_auth: {
    name: "site.files.metadata.composerAuth.name",
    description: "site.files.metadata.composerAuth.description",
  },
  wordpress_config: {
    name: "site.files.metadata.wordpressConfig.name",
    description: "site.files.metadata.wordpressConfig.description",
  },
  laravel_log: {
    name: "site.files.metadata.laravelLog.name",
    description: "site.files.metadata.laravelLog.description",
  },
  caddy_log: {
    name: "site.files.metadata.caddyLog.name",
    description: "site.files.metadata.caddyLog.description",
  },
} as const;

const serverTypeMessageKeys = {
  php: "server.create.types.php",
  database: "server.create.types.database",
  loadbalancer: "server.create.types.loadbalancer",
  docker: "server.create.types.docker",
} as const;

const siteTypeMessageKeys = {
  laravel: "server.addSite.siteTypes.laravel",
  wordpress: "server.addSite.siteTypes.wordpress",
  static: "server.addSite.siteTypes.static",
  generic: "server.addSite.siteTypes.generic",
  phpmyadmin: "server.addSite.siteTypes.phpmyadmin",
} as const;

const serverLogMessageKeys = {
  mysql80: "server.logs.softwareLogs.mysql80",
  postgresql16: "server.logs.softwareLogs.postgresql16",
  redis: "server.logs.softwareLogs.redis",
  php56: "server.logs.softwareLogs.php56",
  php70: "server.logs.softwareLogs.php70",
  php71: "server.logs.softwareLogs.php71",
  php72: "server.logs.softwareLogs.php72",
  php73: "server.logs.softwareLogs.php73",
  php74: "server.logs.softwareLogs.php74",
  php80: "server.logs.softwareLogs.php80",
  php81: "server.logs.softwareLogs.php81",
  php82: "server.logs.softwareLogs.php82",
  php83: "server.logs.softwareLogs.php83",
  php84: "server.logs.softwareLogs.php84",
  caddy2: "server.logs.softwareLogs.caddy2",
  caddy2_lb: "server.logs.softwareLogs.caddy2LoadBalancer",
  supervisor: "server.logs.softwareLogs.supervisor",
} as const;

const messageKeyFor = <T extends Record<string, string>>(
  messageKeys: T,
  value?: string,
) =>
  value && Object.hasOwn(messageKeys, value)
    ? messageKeys[value as keyof T]
    : null;

export const useStableMetadataLabels = () => {
  const { t } = useI18n();

  const getSiteFileName = (file: SiteFileMetadata) => {
    const keys = file.file_type
      ? siteFileMessageKeys[file.file_type as keyof typeof siteFileMessageKeys]
      : undefined;
    return keys ? t(keys.name) : file.name;
  };

  const getSiteFileDescription = (file: SiteFileMetadata) => {
    const keys = file.file_type
      ? siteFileMessageKeys[file.file_type as keyof typeof siteFileMessageKeys]
      : undefined;
    return keys ? t(keys.description) : file.description || "";
  };

  const getServerTypeLabel = (value: string, fallback: string) => {
    const key = messageKeyFor(serverTypeMessageKeys, value);
    return key ? t(key) : fallback;
  };

  const getSiteTypeLabel = (value: string, fallback: string) => {
    const key = messageKeyFor(siteTypeMessageKeys, value);
    return key ? t(key) : fallback;
  };

  const getLogName = (log: LogInfo) => {
    if (log.file_type && Object.hasOwn(siteFileMessageKeys, log.file_type)) {
      return getSiteFileName(log);
    }

    const key = messageKeyFor(serverLogMessageKeys, log.software);
    return key ? t(key) : log.name;
  };

  return {
    getLogName,
    getServerTypeLabel,
    getSiteFileDescription,
    getSiteFileName,
    getSiteTypeLabel,
  };
};

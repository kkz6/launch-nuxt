import type { ApiResponse } from "~/composables/useApi";

/**
 * Docker project — the grouping layer between a server and its workloads
 * (applications, compose stacks, databases). Phase 1 only exposes the
 * project itself; workload services land in later phases per the design
 * doc at launch-go/docs/plans/2026-05-22-docker-server-menus-design.md.
 */
export interface DockerProject {
  id: string;
  team_id: string;
  server_id: string;
  name: string;
  description?: string | null;
  applications_count: number;
  composes_count: number;
  databases_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerProjectData {
  name: string;
  description?: string;
}

export interface UpdateDockerProjectData {
  name?: string;
  description?: string;
}

// ---- Applications ---------------------------------------------------------

/**
 * Source type discriminant. Mirrors launch-go's
 * dockertypes.SourceType — keep these strings in sync.
 */
export type DockerSourceType = "image" | "git" | "dockerfile";

/**
 * Application lifecycle status. Same source-of-truth note as above.
 */
export type DockerApplicationStatus =
  | "idle"
  | "building"
  | "running"
  | "stopped"
  | "failed";

/**
 * A docker application as returned by the API. source_config is opaque to
 * the frontend except for the source-type-specific keys we render in the
 * General subtab — keep that rendering tolerant of missing keys so a
 * future backend change doesn't blank the UI.
 */
export interface DockerApplication {
  id: string;
  team_id: string;
  server_id: string;
  project_id: string;
  name: string;
  /** Port the container listens on internally (Traefik routes here). */
  internal_port: number;
  source_type: DockerSourceType;
  source_config?: Record<string, unknown> | null;
  build_type?: string | null;
  build_config?: Record<string, unknown> | null;
  status: DockerApplicationStatus;
  container_id?: string | null;
  /**
   * Deterministic on-host docker container name
   * (`launch-<project>-<app>`). Fed to the navbar Terminal button so
   * the WS handler opens a shell inside the container rather than on
   * the host root.
   */
  container_name?: string;
  last_deployed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Create payload for a docker application. Exactly one of image/git/
 * dockerfile must match source_type; the backend enforces this.
 */
export interface CreateDockerApplicationData {
  name: string;
  source_type: DockerSourceType;
  /** Container's internal port. Defaults to 80 server-side. */
  internal_port?: number;
  image?: {
    image: string;
    /**
     * Saved-credential path. Mutually exclusive with the inline
     * username/password fields below — the backend rejects "both
     * set" as 400. Leave all four empty for a public image.
     */
    registry_credential_id?: string;
    /** Inline username (encrypted at rest on the application row). */
    registry_username?: string;
    /** Inline password (encrypted at rest on the application row). */
    registry_password?: string;
    /** Inline registry URL — empty / undefined means Docker Hub. */
    registry_url?: string;
  };
  git?: {
    repo: string;
    branch: string;
    source_control_id?: string;
    build_type?: "nixpacks" | "dockerfile";
    dockerfile_path?: string;
  };
  dockerfile?: {
    contents: string;
  };
}

export interface UpdateDockerApplicationData {
  name?: string;
}

export interface DockerDomainDnsValidation {
  host: string;
  ok: boolean;
  wildcard: boolean;
  expected_ip?: string;
  resolved_ips?: string[];
  message: string;
}

export interface DockerDomain {
  id: string;
  /**
   * Polymorphic owner — exactly one of `application_id` / `compose_id`
   * is set per row (the other is omitted from the JSON). Same shape
   * as DockerVolume after the 0035 / 0036 refactors.
   */
  application_id?: string | null;
  compose_id?: string | null;
  host: string;
  path?: string | null;
  /** Path the app expects internally; defaults to "/". */
  internal_path?: string | null;
  /** When true, Traefik strips `path` before forwarding. */
  strip_path: boolean;
  /**
   * For applications: per-domain override of app.internal_port; null
   * falls back to the app. For compose: required (no fallback — the
   * YAML owns the port).
   */
  container_port?: number | null;
  https: boolean;
  certificate_provider: "letsencrypt" | string;
  certificate_id?: string | null;
  /**
   * Compose-only — names the YAML service the domain routes to. The
   * Traefik renderer resolves it to the compose-managed container
   * `<project>-<compose>-<service>-1`. Always null on application
   * rows.
   */
  service_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerDomainData {
  host: string;
  path?: string;
  internal_path?: string;
  strip_path?: boolean;
  container_port?: number;
  https?: boolean;
  certificate_provider?: "letsencrypt";
  /**
   * Mirrors AddSite — when true and the host's base domain is
   * registered in the DNS module, the API creates an A record
   * pointing at the docker server's public IP.
   */
  create_dns_record?: boolean;
  connected_domain_id?: string | null;
  /**
   * Required on the compose endpoint, ignored on the application
   * endpoint. Names the compose YAML service this domain targets.
   */
  service_name?: string;
}

export interface UpdateDockerDomainData {
  path?: string;
  internal_path?: string;
  strip_path?: boolean;
  container_port?: number;
  https?: boolean;
  certificate_provider?: "letsencrypt";
  /**
   * Retarget a compose domain at a different YAML service. Empty
   * string is rejected at the backend (clearing is not allowed on a
   * compose row). Ignored on application rows.
   */
  service_name?: string;
}

// ---- App env vars + volumes ----------------------------------------------

export interface DockerEnvVar {
  id: string;
  application_id: string;
  key: string;
  /** Masked to "********" when is_secret=true on list endpoints. */
  value: string;
  is_secret: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerEnvVarData {
  key: string;
  value: string;
  is_secret?: boolean;
}

export interface UpdateDockerEnvVarData {
  value?: string;
  is_secret?: boolean;
}

/**
 * Replace-all body for the bulk save endpoint — backs the
 * paste-a-.env workflow without per-line round-trips.
 */
export interface SetDockerEnvVarsData {
  vars: CreateDockerEnvVarData[];
}

/**
 * Project-scoped env var. Same shape as DockerEnvVar but owned by a
 * project — referenced from container envs via `${{project.<KEY>}}`.
 */
export interface DockerProjectEnvVar {
  id: string;
  project_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Env var attached to a managed database container (user-added
 * extras on top of the auto-generated engine credentials).
 */
export interface DockerDatabaseEnvVar {
  id: string;
  database_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Mirrors dokploy's mount-kinds: "bind" (host_path), "volume" (docker
 * named volume), "file" (content + file_path written on the host then
 * bind-mounted). "named" is the legacy spelling of "volume" — the
 * backend coerces it on create; we keep the literal in the union so
 * rows persisted before the rename still type-check.
 */
export type DockerVolumeType = "bind" | "volume" | "file" | "named";

export interface DockerVolume {
  id: string;
  /**
   * Polymorphic owner: exactly one of `application_id` / `compose_id`
   * is set per row. The other is omitted by the API (the field is
   * `omitempty` on the backend) so a missing key is the normal case
   * for the non-owning flavour.
   */
  application_id?: string | null;
  compose_id?: string | null;
  name: string;
  mount_path: string;
  type: DockerVolumeType;
  host_path?: string | null;
  /** Body written to disk for type=file. */
  content?: string | null;
  /**
   * On-host filename for type=file. For applications this is relative
   * to the application's deploy directory; for compose stacks it lives
   * under `${STACK_DIR}/files/` so the YAML can reference it via
   * `./files/<file_path>`.
   */
  file_path?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerVolumeData {
  name: string;
  mount_path: string;
  type: DockerVolumeType;
  host_path?: string;
  content?: string;
  file_path?: string;
}

export interface UpdateDockerVolumeData {
  mount_path?: string;
  host_path?: string;
  content?: string;
  file_path?: string;
}

// ---- Schedules + advanced -------------------------------------------------

export interface DockerSchedule {
  id: string;
  application_id: string;
  cron: string;
  command: string;
  /** false = paused (worker skips it). */
  enabled: boolean;
  /** "bash" or "sh" — the in-container shell exec'd into. */
  shell_type: "bash" | "sh";
  /**
   * ULID of the server-tasks row from the most recent run. The
   * Schedules subtab pipes this into <ServerLogViewer entity="task">
   * to stream that single run's stdout+stderr.
   */
  last_task_id?: string | null;
  last_run_at?: string | null;
  last_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerScheduleData {
  cron: string;
  command: string;
  /** Defaults to true server-side. */
  enabled?: boolean;
  shell_type?: "bash" | "sh";
}

export interface UpdateDockerScheduleData {
  cron?: string;
  command?: string;
  enabled?: boolean;
  shell_type?: "bash" | "sh";
}

/**
 * Advanced runtime knobs. All optional; present keys go to
 * build_config and apply on the next deploy. Empty strings clear.
 */
export interface DockerRedirectInput {
  regex: string;
  replacement: string;
  permanent: boolean;
}

/**
 * Per-row docker-application redirect. Same shape the PHP-site
 * redirects use (from/to/type) so the same DataTable + dialog
 * component code can hydrate either source.
 */
export interface DockerApplicationRedirect {
  id: string;
  from: string;
  to: string;
  type: 301 | 302 | 307 | 308;
  created_at?: string;
}

export interface CreateDockerApplicationRedirectData {
  from: string;
  to: string;
  type: 301 | 302 | 307 | 308;
}

export interface UpdateDockerApplicationRedirectData {
  from?: string;
  to?: string;
  type?: 301 | 302 | 307 | 308;
}

export interface DockerSecurityInput {
  username: string;
  password: string;
}

/**
 * Per-application Traefik dynamic-config file body. Same on-disk
 * file the deploy task writes when domains are attached. Surfaced
 * on the application Advanced subtab so operators can spot-check or
 * override the generated YAML without bouncing to the server-level
 * Traefik file tree. Filename is informational — the backend
 * resolves it from the app's project+name slug pair.
 */
export interface DockerApplicationTraefikConfig {
  filename: string;
  content: string;
}

/**
 * Saved docker-registry login. Password is write-only over the
 * wire — the response carries `has_password` (boolean) so the edit
 * form can show "•••• change?" instead of a blank input that looks
 * like the password got cleared. Username is returned decrypted.
 */
export interface DockerRegistryCredential {
  id: string;
  team_id: string;
  user_id?: string | null;
  name: string;
  /** Empty / null means Docker Hub. */
  registry_url?: string | null;
  username: string;
  has_password: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerRegistryCredentialData {
  name: string;
  /** Omit / empty for Docker Hub. */
  registry_url?: string;
  username: string;
  password: string;
}

export interface UpdateDockerRegistryCredentialData {
  name?: string;
  /** Empty string clears it (= Docker Hub). */
  registry_url?: string;
  username?: string;
  /** Omit to leave the stored password alone; empty string is rejected. */
  password?: string;
}

/**
 * Trimmed shape embedded on a DockerCompose response — just enough
 * to render the "attached credentials" chips on the compose detail
 * page without a second fetch. Username never embedded.
 */
export interface DockerRegistryCredentialSummary {
  id: string;
  name: string;
  registry_url?: string | null;
}

export interface UpdateDockerAdvancedData {
  cpu_limit?: string;
  memory_limit?: string;
  cpu_reservation?: string;
  memory_reservation?: string;
  restart_policy?: "no" | "on-failure" | "always" | "unless-stopped";
  healthcheck_command?: string;
  extra_ports?: string[];
  /**
   * Send `redirects: []` to clear all; omit the key to leave them
   * unchanged. Each row compiles to a Traefik RedirectRegex
   * middleware on the next deploy.
   */
  redirects?: DockerRedirectInput[];
  /**
   * Send `security: { username: "", password: "" }` to clear basic
   * auth; omit the key to leave it unchanged.
   */
  security?: DockerSecurityInput;
}

// ---- Host diagnostic types ------------------------------------------------

/**
 * Curated subset of `docker inspect`. Same shape the
 * ServerDockerContainers status dialog renders — pull only the
 * fields a customer would actually want to see, deliberately leaving
 * out env vars (could leak secrets) and the giant raw config blob.
 */
export interface DockerContainerInspect {
  id: string;
  name: string;
  image: string;
  image_id: string;
  /** Legacy single-line summary. Prefer entrypoint + cmd + path/args for display. */
  command: string;
  /** ENTRYPOINT array from the image (or runtime override). */
  entrypoint?: string[];
  /** CMD array. */
  cmd?: string[];
  /** The binary docker actually exec'd. */
  path?: string;
  /** Args passed to `path` at exec time. */
  args?: string[];
  created_at: string;
  state: {
    status: string;
    running: boolean;
    started_at: string;
    finished_at: string;
    exit_code: number;
    error?: string;
    oom_killed: boolean;
    pid: number;
  };
  health?: {
    status: string;
    failing_streak: number;
    log?: Array<{
      start: string;
      end: string;
      exit_code: number;
      output: string;
    }>;
  };
  restart_count: number;
  platform: string;
  resources: {
    memory_limit_bytes: number;
    cpu_shares: number;
    nano_cpus: number;
  };
  restart_policy: string;
  mounts: Array<{
    type: string;
    source: string;
    destination: string;
    read_only: boolean;
  }>;
  networks: Array<{
    name: string;
    ip_address: string;
    mac_address?: string;
  }>;
  labels?: Record<string, string>;
  /**
   * Full `docker inspect` JSON passed through. Used by the "View raw
   * config" dialog. Typed as `unknown` because the shape is enormous
   * and we never read it field-by-field on the frontend — just
   * stringify and render in the editor.
   */
  raw?: unknown;
}

/**
 * Output of `docker ps -a --format '{{json .}}'`.
 *
 * `system` is set by the backend for Launch-managed rows (Traefik,
 * future control-plane services) so the UI can hide them by default
 * — mirrors dokploy's `name.includes("dokploy")` exclusion. See
 * isLaunchSystemName on the Go side for the classification rule.
 */
export interface DockerHostContainer {
  ID: string;
  Names: string;
  Image: string;
  Command: string;
  Status: string;
  State: string;
  Ports: string;
  CreatedAt: string;
  system: boolean;
}

/** Output of `docker volume ls --format '{{json .}}'`. */
export interface DockerHostVolume {
  Name: string;
  Driver: string;
  Scope: string;
  Mountpoint: string;
  system: boolean;
}

// DockerHostNetwork removed: the Networks tab and the matching
// backend route are both gone. Launch manages the launch-network
// overlay; customers don't create custom docker networks via the
// UI.

/**
 * Traefik dynamic config files served from
 * /etc/launch/traefik/dynamic/. Launch's own plumbing
 * (traefik.yml static config, acme.json, certificates) is NOT
 * surfaced — this is a SaaS so the infrastructure layer belongs to
 * us, not the user. Compare with dokploy, which is self-hosted and
 * exposes the whole filesystem.
 */
export interface DockerTraefikSnapshot {
  dynamic_files: Record<string, string>;
}

// ---- Compose stacks -------------------------------------------------------

export type DockerComposeSourceType = "git" | "raw_yaml";

export interface DockerCompose {
  id: string;
  team_id: string;
  server_id: string;
  project_id: string;
  name: string;
  compose_source_type: DockerComposeSourceType;
  source_config?: Record<string, unknown> | null;
  compose_file_path?: string | null;
  raw_yaml?: string | null;
  // Body of the .env file written next to the compose file on each
  // deploy. Only populated on the detail (Show) response, omitted
  // from list responses to keep them small. UI: edited via the
  // compose Environment subtab.
  env_file?: string | null;
  // Docker-suffix override the deploy script runs verbatim. NULL =
  // use the default (`compose -p NAME -f FILE up -d --build
  // --remove-orphans`). Detail-only (omitted from list responses).
  // UI: edited on the Advanced subtab.
  run_command?: string | null;
  status: DockerApplicationStatus;
  last_deployed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  /**
   * Saved registry credentials attached to this stack (summary shape
   * — no secrets). Only populated when the backend preloaded the
   * many-to-many; empty/undefined means "no auth attached or no
   * preload happened".
   */
  registry_credentials?: DockerRegistryCredentialSummary[];
}

export interface CreateDockerComposeData {
  name: string;
  compose_source_type: DockerComposeSourceType;
  git?: {
    repo: string;
    branch: string;
    source_control_id?: string;
    compose_file_path?: string;
  };
  raw_yaml?: {
    contents: string;
  };
  /**
   * IDs of saved registry credentials to attach to this stack. The
   * deploy script runs `docker login` for each before
   * `docker compose pull/up`. nil / empty = no auth.
   */
  registry_credential_ids?: string[];
}

export interface UpdateDockerComposeData {
  name?: string;
  // Setting to an empty string clears the file; omitting (undefined)
  // leaves it unchanged. The backend deploy task writes this to
  // `${STACK_DIR}/.env` on the next deploy.
  env_file?: string;
  // Same nil/empty/set semantics — empty string clears the override
  // (deploy reverts to default), non-empty sets the docker suffix
  // verbatim.
  run_command?: string;
  /**
   * Replace the stack's attached registry credentials in one shot.
   * `undefined` = leave unchanged; `[]` = detach all; non-empty =
   * replace with this exact set. Each ID must belong to the team.
   */
  registry_credential_ids?: string[];
}

// ---- Managed databases ----------------------------------------------------

export type DockerDatabaseEngine =
  | "postgres"
  | "mysql"
  | "mariadb"
  | "redis"
  | "mongo";

export interface DockerDatabaseCredentials {
  username: string;
  password: string;
  database: string;
}

export interface DockerDatabase {
  id: string;
  team_id: string;
  server_id: string;
  project_id: string;
  name: string;
  engine: DockerDatabaseEngine;
  engine_version: string;
  image_tag?: string | null;
  external_port?: number | null;
  status: DockerApplicationStatus;
  /** Present only on get-with-reveal responses. */
  credentials?: DockerDatabaseCredentials | null;
  /**
   * Advanced subtab knobs — restart_policy + resource limits.
   * Shape matches docker_applications.build_config so the same form
   * patterns work on both. Optional; brand-new rows may be null.
   */
  build_config?: Record<string, unknown> | null;
  /**
   * Deterministic named-volume label the run-database script binds at
   * `data_path`. Surfaced here so the Advanced subtab can render the
   * Volumes section without an extra round-trip.
   */
  volume_name?: string;
  /**
   * In-container path where the engine keeps its on-disk state
   * (`/var/lib/postgresql/data`, `/var/lib/mysql`, ...). Engine-specific
   * — derived on the backend from the engine catalogue.
   */
  data_path?: string;
  /**
   * Deterministic on-host docker container name
   * (`launch-db-<project>-<db>`). The navbar Terminal button reads
   * this and forwards it to the WS handler as `?container=` so the
   * shell opens inside the container, not on the host.
   */
  container_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerDatabaseData {
  name: string;
  engine: DockerDatabaseEngine;
  version?: string;
  external_port?: number;
}

export type DockerDatabaseLifecycleAction = "start" | "stop" | "restart";

/** Engine catalogue returned by /api/docker/databases/engines. */
export type DockerDatabaseEngineCatalogue = Record<DockerDatabaseEngine, string[]>;

// ---- Database backups -----------------------------------------------------

export interface DockerDatabaseBackup {
  id: string;
  database_id: string;
  /**
   * FK into `storage_providers`. The actual S3 credentials live on
   * that row; configure the destination once under
   * Settings → Connections, reuse it across every database backup.
   */
  storage_provider_id: number;
  /** Bucket sub-folder where this database's dumps land. */
  path?: string | null;
  /** Number of past run rows to keep. Older rows are pruned. */
  retention: number;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  cron_schedule?: string | null;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DockerDatabaseBackupRun {
  id: string;
  backup_id: string;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  object_key?: string | null;
  size_bytes?: number | null;
  error?: string | null;
  created_at?: string;
}

export interface ConfigureDockerBackupData {
  storage_provider_id: number;
  path?: string;
  retention: number;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  cron_schedule?: string;
  enabled: boolean;
}

/**
 * Deployment history row for an application or compose stack.
 * target_type discriminates which workload it belongs to; the UI on a
 * specific workload already knows the target so we don't render the
 * field, but the backend persists it (slice 2i will reuse the same
 * shape for compose deployments).
 */
export interface DockerDeployment {
  id: string;
  team_id: string;
  server_id: string;
  // Three workload kinds share this polymorphic row — application,
  // compose, and (added in slice 2j) database for lifecycle history.
  target_type: "application" | "compose" | "database";
  target_id: string;
  // Set on database rows (create/start/restart/stop/rm). null for
  // application + compose rows where the implicit verb is "deploy".
  action?: string | null;
  status:
    | "pending"
    | "building"
    | "deploying"
    | "success"
    | "failed"
    | "cancelled";
  // task_id binds the row to a running server-task so the UI can
  // stream live SSH output via ServerLogViewer entity="task". Null
  // until the worker has dispatched the task.
  task_id?: string | null;
  commit_sha?: string | null;
  commit_msg?: string | null;
  image_ref?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * dockerService groups every API call under /api/servers/:serverId/docker/.
 * Mirrors serverService.ts for consistency — every method takes the
 * server ID first so the routing parent is always explicit at the call site.
 */
export const dockerService = {
  projects: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerProject[]>>(`/servers/${serverId}/docker/projects`);
    },

    get: (serverId: string, projectId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerProject>>(
        `/servers/${serverId}/docker/projects/${projectId}`,
      );
    },

    create: (serverId: string, data: CreateDockerProjectData) => {
      const { post } = useApi();
      return post<ApiResponse<DockerProject>>(
        `/servers/${serverId}/docker/projects`,
        data,
      );
    },

    update: (serverId: string, projectId: string, data: UpdateDockerProjectData) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerProject>>(
        `/servers/${serverId}/docker/projects/${projectId}`,
        data,
      );
    },

    delete: (serverId: string, projectId: string) => {
      const { delete: del } = useApi();
      return del(`/servers/${serverId}/docker/projects/${projectId}`);
    },

    // Project-scoped env vars — referenced from container envs via
    // `${{project.<KEY>}}`. Same CRUD shape as the application env
    // vars below; the backend resolves the refs at deploy/run time.
    envVars: {
      list: (serverId: string, projectId: string) => {
        const { get } = useApi();
        return get<ApiResponse<DockerProjectEnvVar[]>>(
          `/servers/${serverId}/docker/projects/${projectId}/env-vars`,
        );
      },
      create: (
        serverId: string,
        projectId: string,
        data: CreateDockerEnvVarData,
      ) => {
        const { post } = useApi();
        return post<ApiResponse<DockerProjectEnvVar>>(
          `/servers/${serverId}/docker/projects/${projectId}/env-vars`,
          data,
        );
      },
      update: (
        serverId: string,
        projectId: string,
        envVarId: string,
        data: UpdateDockerEnvVarData,
      ) => {
        const { patch } = useApi();
        return patch<ApiResponse<DockerProjectEnvVar>>(
          `/servers/${serverId}/docker/projects/${projectId}/env-vars/${envVarId}`,
          data,
        );
      },
      delete: (serverId: string, projectId: string, envVarId: string) => {
        const { delete: del } = useApi();
        return del(
          `/servers/${serverId}/docker/projects/${projectId}/env-vars/${envVarId}`,
        );
      },
    },
  },

  applications: {
    list: (serverId: string, projectId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerApplication[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications`,
      );
    },

    get: (serverId: string, projectId: string, applicationId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerApplication>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}`,
      );
    },

    create: (
      serverId: string,
      projectId: string,
      data: CreateDockerApplicationData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerApplication>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications`,
        data,
      );
    },

    update: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: UpdateDockerApplicationData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerApplication>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}`,
        data,
      );
    },

    /**
     * `removeVolumes` opt-in flag mirrors the docker compose / database
     * delete shape. When true the backend iterates the application's
     * named volume rows and `docker volume rm` each AFTER the container
     * is gone. Default false — preserves data on a misclick.
     */
    delete: (
      serverId: string,
      projectId: string,
      applicationId: string,
      opts?: { removeVolumes?: boolean },
    ) => {
      const { delete: del } = useApi();
      const q = opts?.removeVolumes ? "?remove_volumes=true" : "";
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}${q}`,
      );
    },

    deploy: (serverId: string, projectId: string, applicationId: string) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDeployment>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/deploy`,
        {},
      );
    },

    /**
     * Lifecycle action against the running container. "reload" maps
     * to docker restart server-side; "stop" / "start" are passthrough.
     * Rebuild isn't here — Rebuild = Deploy (same endpoint above).
     */
    lifecycle: (
      serverId: string,
      projectId: string,
      applicationId: string,
      action: "reload" | "stop" | "start",
    ) => {
      const { post } = useApi();
      return post<ApiResponse<{ action: string }>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/${action}`,
        {},
      );
    },

    listDeployments: (serverId: string, projectId: string, applicationId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDeployment[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/deployments`,
      );
    },

    listDomains: (serverId: string, projectId: string, applicationId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDomain[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/domains`,
      );
    },

    createDomain: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: CreateDockerDomainData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDomain>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/domains`,
        data,
      );
    },

    updateDomain: (
      serverId: string,
      projectId: string,
      applicationId: string,
      domainId: string,
      data: UpdateDockerDomainData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerDomain>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/domains/${domainId}`,
        data,
      );
    },

    deleteDomain: (
      serverId: string,
      projectId: string,
      applicationId: string,
      domainId: string,
    ) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/domains/${domainId}`,
      );
    },

    /**
     * Validate the domain's A record against the docker server's
     * public IP. Backed by a server-side DNS lookup (so this works
     * across CORS-restricted browser contexts). Wildcard hostnames
     * (traefik.me, sslip.io, …) short-circuit to ok=true.
     */
    validateDomainDns: (
      serverId: string,
      projectId: string,
      applicationId: string,
      domainId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDomainDnsValidation>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/domains/${domainId}/validate-dns`,
      );
    },

    // redirects — backed by build_config.redirects, exposed per-row
    // so the Redirects subtab can plug into the same DataTable + dialog
    // shape the PHP-site SitesRedirects subtab uses.
    listRedirects: (
      serverId: string,
      projectId: string,
      applicationId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerApplicationRedirect[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/redirects`,
      );
    },
    createRedirect: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: CreateDockerApplicationRedirectData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerApplicationRedirect>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/redirects`,
        data,
      );
    },
    updateRedirect: (
      serverId: string,
      projectId: string,
      applicationId: string,
      redirectId: string,
      data: UpdateDockerApplicationRedirectData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerApplicationRedirect>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/redirects/${redirectId}`,
        data,
      );
    },
    deleteRedirect: (
      serverId: string,
      projectId: string,
      applicationId: string,
      redirectId: string,
    ) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/redirects/${redirectId}`,
      );
    },

    // env vars
    listEnvVars: (
      serverId: string,
      projectId: string,
      applicationId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerEnvVar[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/env-vars`,
      );
    },

    createEnvVar: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: CreateDockerEnvVarData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerEnvVar>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/env-vars`,
        data,
      );
    },

    setEnvVars: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: SetDockerEnvVarsData,
    ) => {
      const { put } = useApi();
      return put<ApiResponse<DockerEnvVar[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/env-vars`,
        data,
      );
    },

    updateEnvVar: (
      serverId: string,
      projectId: string,
      applicationId: string,
      envVarId: string,
      data: UpdateDockerEnvVarData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerEnvVar>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/env-vars/${envVarId}`,
        data,
      );
    },

    deleteEnvVar: (
      serverId: string,
      projectId: string,
      applicationId: string,
      envVarId: string,
    ) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/env-vars/${envVarId}`,
      );
    },

    // volumes
    listVolumes: (
      serverId: string,
      projectId: string,
      applicationId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerVolume[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/volumes`,
      );
    },

    createVolume: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: CreateDockerVolumeData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerVolume>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/volumes`,
        data,
      );
    },

    updateVolume: (
      serverId: string,
      projectId: string,
      applicationId: string,
      volumeId: string,
      data: UpdateDockerVolumeData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerVolume>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/volumes/${volumeId}`,
        data,
      );
    },

    deleteVolume: (
      serverId: string,
      projectId: string,
      applicationId: string,
      volumeId: string,
    ) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/volumes/${volumeId}`,
      );
    },

    // schedules
    listSchedules: (
      serverId: string,
      projectId: string,
      applicationId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerSchedule[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/schedules`,
      );
    },
    createSchedule: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: CreateDockerScheduleData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerSchedule>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/schedules`,
        data,
      );
    },
    updateSchedule: (
      serverId: string,
      projectId: string,
      applicationId: string,
      scheduleId: string,
      data: UpdateDockerScheduleData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerSchedule>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/schedules/${scheduleId}`,
        data,
      );
    },
    deleteSchedule: (
      serverId: string,
      projectId: string,
      applicationId: string,
      scheduleId: string,
    ) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/schedules/${scheduleId}`,
      );
    },

    // advanced runtime knobs
    updateAdvanced: (
      serverId: string,
      projectId: string,
      applicationId: string,
      data: UpdateDockerAdvancedData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerApplication>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/advanced`,
        data,
      );
    },

    // Per-application Traefik dynamic-config file — same on-disk file
    // the deploy task writes (`/etc/launch/traefik/dynamic/<project>-
    // <app>.yml`), surfaced inline on the Advanced subtab so the
    // operator can spot-check or override the generated routes
    // without leaving the app page. Backend resolves the filename
    // from the application's project+name slug pair; the operator
    // can't redirect the write to a different file via a crafted
    // request.
    getTraefikConfig: (
      serverId: string,
      projectId: string,
      applicationId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerApplicationTraefikConfig>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/traefik-config`,
      );
    },
    updateTraefikConfig: (
      serverId: string,
      projectId: string,
      applicationId: string,
      content: string,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerApplicationTraefikConfig>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/traefik-config`,
        { content },
      );
    },
  },

  composes: {
    list: (serverId: string, projectId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerCompose[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes`,
      );
    },

    get: (serverId: string, projectId: string, composeId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerCompose>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}`,
      );
    },

    create: (serverId: string, projectId: string, data: CreateDockerComposeData) => {
      const { post } = useApi();
      return post<ApiResponse<DockerCompose>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes`,
        data,
      );
    },

    update: (
      serverId: string,
      projectId: string,
      composeId: string,
      data: UpdateDockerComposeData,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerCompose>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}`,
        data,
      );
    },

    /**
     * `removeVolumes` opt-in flips the backend teardown from
     * `docker compose down` to `down -v`. Default false — keeps named
     * volumes so a redeploy of the same stack reuses the existing data.
     */
    delete: (
      serverId: string,
      projectId: string,
      composeId: string,
      opts?: { removeVolumes?: boolean },
    ) => {
      const { delete: del } = useApi();
      const q = opts?.removeVolumes ? "?remove_volumes=true" : "";
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}${q}`,
      );
    },

    deploy: (serverId: string, projectId: string, composeId: string) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDeployment>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/deploy`,
        {},
      );
    },

    listDeployments: (serverId: string, projectId: string, composeId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDeployment[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/deployments`,
      );
    },

    /**
     * List service names in the compose stack — drives the Logs
     * subtab's container picker. Returns [] when the stack has
     * never been deployed. Implementation: backend SSHes the host
     * and runs `docker compose ps --services`.
     */
    listServices: (serverId: string, projectId: string, composeId: string) => {
      const { get } = useApi();
      return get<ApiResponse<string[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/services`,
      );
    },

    // Preview of the docker-suffix the deploy script falls back to
    // when no per-stack RunCommand override is set. The Advanced
    // subtab shows this verbatim so the operator knows what they're
    // overriding. Backend renders via the same code path the deploy
    // job uses, so the hint and the deploy can't drift.
    getDefaultCommand: (
      serverId: string,
      projectId: string,
      composeId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<{ command: string }>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/default-command`,
      );
    },

    // Compose volumes — same persistence row as application volumes
    // (polymorphic by owner column on the backend), exposed under the
    // stack URL. Three flavours match dokploy's mount surface:
    //   - bind / volume → informational; operator wires them into
    //     their YAML themselves. The platform doesn't rewrite
    //     docker-compose.yml.
    //   - file          → backend materializes to
    //     `${STACK_DIR}/files/<file_path>` before `docker compose up`,
    //     and YAML can reference it via `./files/<file_path>`.
    volumes: {
      list: (serverId: string, projectId: string, composeId: string) => {
        const { get } = useApi();
        return get<ApiResponse<DockerVolume[]>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/volumes`,
        );
      },
      create: (
        serverId: string,
        projectId: string,
        composeId: string,
        data: CreateDockerVolumeData,
      ) => {
        const { post } = useApi();
        return post<ApiResponse<DockerVolume>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/volumes`,
          data,
        );
      },
      update: (
        serverId: string,
        projectId: string,
        composeId: string,
        volumeId: string,
        data: UpdateDockerVolumeData,
      ) => {
        const { patch } = useApi();
        return patch<ApiResponse<DockerVolume>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/volumes/${volumeId}`,
          data,
        );
      },
      delete: (
        serverId: string,
        projectId: string,
        composeId: string,
        volumeId: string,
      ) => {
        const { delete: del } = useApi();
        return del(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/volumes/${volumeId}`,
        );
      },
    },

    // Compose domains — same shape as application domains but the
    // create call requires `service_name` (which YAML service to
    // route to) and `container_port` (no fallback — the YAML owns
    // the port). The Traefik renderer composes the target container
    // name as `<project>-<compose>-<service>-1` so the operator must
    // keep their YAML service name in sync with the row.
    domains: {
      list: (serverId: string, projectId: string, composeId: string) => {
        const { get } = useApi();
        return get<ApiResponse<DockerDomain[]>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/domains`,
        );
      },
      create: (
        serverId: string,
        projectId: string,
        composeId: string,
        data: CreateDockerDomainData,
      ) => {
        const { post } = useApi();
        return post<ApiResponse<DockerDomain>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/domains`,
          data,
        );
      },
      update: (
        serverId: string,
        projectId: string,
        composeId: string,
        domainId: string,
        data: UpdateDockerDomainData,
      ) => {
        const { patch } = useApi();
        return patch<ApiResponse<DockerDomain>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/domains/${domainId}`,
          data,
        );
      },
      delete: (
        serverId: string,
        projectId: string,
        composeId: string,
        domainId: string,
      ) => {
        const { delete: del } = useApi();
        return del(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/domains/${domainId}`,
        );
      },
      validateDNS: (
        serverId: string,
        projectId: string,
        composeId: string,
        domainId: string,
      ) => {
        const { get } = useApi();
        return get<ApiResponse<DockerDomainDnsValidation>>(
          `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/domains/${domainId}/validate-dns`,
        );
      },
    },

    // Per-compose Traefik dynamic-config card. Same on-disk file the
    // SyncComposeTraefikConfig job writes on every domain mutation.
    getTraefikConfig: (
      serverId: string,
      projectId: string,
      composeId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerApplicationTraefikConfig>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/traefik-config`,
      );
    },
    updateTraefikConfig: (
      serverId: string,
      projectId: string,
      composeId: string,
      content: string,
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerApplicationTraefikConfig>>(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}/traefik-config`,
        { content },
      );
    },
  },

  /**
   * Host-level diagnostic endpoints. Read-only views of the docker
   * server's containers/volumes/networks + the on-disk Traefik config.
   * Drives the four server-detail tabs that previously rendered the
   * ComingSoon placeholder.
   */
  host: {
    containers: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerHostContainer[]>>(
        `/servers/${serverId}/docker/containers`,
      );
    },
    /**
     * Detailed `docker inspect` for a single container. The backend
     * whitelists the container ID to a hex pattern before
     * interpolating it into the SSH command, so URL tampering can't
     * inject docker args.
     */
    inspectContainer: (serverId: string, containerId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerContainerInspect>>(
        `/servers/${serverId}/docker/containers/${containerId}/inspect`,
      );
    },
    volumes: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerHostVolume[]>>(
        `/servers/${serverId}/docker/volumes`,
      );
    },
    // host.networks removed alongside the Networks tab — see
    // launch-go's routes.go for the matching backend removal.
    traefik: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerTraefikSnapshot>>(
        `/servers/${serverId}/docker/traefik`,
      );
    },

    /**
     * Overwrite a dynamic Traefik config file. The backend validates
     * the filename (alphanumeric + dot/dash/underscore, .yml/.yaml,
     * not a reserved name) and writes via `sudo tee` so the file
     * inherits root ownership like everything else in the directory.
     *
     * Traefik watches /etc/launch/traefik/dynamic/ so the change
     * takes effect within a couple of seconds with no reload.
     */
    writeTraefikFile: (
      serverId: string,
      filename: string,
      contents: string,
    ) => {
      const { put } = useApi();
      return put(
        `/servers/${serverId}/docker/traefik/files/${encodeURIComponent(filename)}`,
        { contents },
      );
    },
  },

  databases: {
    engineCatalogue: () => {
      const { get } = useApi();
      return get<ApiResponse<DockerDatabaseEngineCatalogue>>(
        "/docker/databases/engines",
      );
    },

    list: (serverId: string, projectId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDatabase[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases`,
      );
    },

    /**
     * Get a database. Pass reveal=true to include the auto-generated
     * password in the response — the UI shows a deliberate "show
     * credentials" button so this only happens on explicit intent.
     */
    get: (
      serverId: string,
      projectId: string,
      databaseId: string,
      opts: { reveal?: boolean } = {},
    ) => {
      const { get } = useApi();
      const query = opts.reveal ? "?reveal=true" : "";
      return get<ApiResponse<DockerDatabase>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}${query}`,
      );
    },

    create: (
      serverId: string,
      projectId: string,
      data: CreateDockerDatabaseData,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDatabase>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases`,
        data,
      );
    },

    /**
     * `removeVolumes` opt-in tells the backend's rm lifecycle action to
     * also `docker volume rm` the database's named data volume after
     * the container is gone. Default false — preserves the data dir so
     * a recreate restarts with the previous state intact.
     */
    delete: (
      serverId: string,
      projectId: string,
      databaseId: string,
      opts?: { removeVolumes?: boolean },
    ) => {
      const { delete: del } = useApi();
      const q = opts?.removeVolumes ? "?remove_volumes=true" : "";
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}${q}`,
      );
    },

    lifecycle: (
      serverId: string,
      projectId: string,
      databaseId: string,
      action: DockerDatabaseLifecycleAction,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDatabase>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/lifecycle`,
        { action },
      );
    },

    // Lifecycle history. Same shape as applications/composes — rows
    // come from the polymorphic docker_deployments table with
    // target_type="database" and action set to the lifecycle verb.
    listDeployments: (
      serverId: string,
      projectId: string,
      databaseId: string,
    ) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDeployment[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/deployments`,
      );
    },

    // Toggle the external port mapping. Enabled=true with port=N maps
    // N:internal_port on the host; enabled=false clears the mapping.
    // Triggers a container recreate on the worker.
    setExpose: (
      serverId: string,
      projectId: string,
      databaseId: string,
      data: { enabled: boolean; port?: number | null },
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDatabase>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/expose`,
        data,
      );
    },

    // Update the Advanced subtab's runtime knobs — restart policy and
    // resource limits/reservations. Persists into build_config and
    // dispatches `docker update` over SSH so the change applies live.
    // Empty strings clear that knob.
    updateAdvanced: (
      serverId: string,
      projectId: string,
      databaseId: string,
      data: {
        restart_policy: "no" | "on-failure" | "always" | "unless-stopped";
        cpu_limit?: string;
        memory_limit?: string;
        cpu_reservation?: string;
        memory_reservation?: string;
      },
    ) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerDatabase>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/advanced`,
        data,
      );
    },

    // Danger Zone — wipe the named data volume and recreate the
    // container with the same config. Returns the row in its pre-
    // rebuild state; the worker flips status as the run script
    // progresses.
    rebuild: (serverId: string, projectId: string, databaseId: string) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDatabase>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/rebuild`,
        {},
      );
    },

    // backup config
    getBackup: (serverId: string, projectId: string, databaseId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDatabaseBackup | null>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/backup`,
      );
    },
    configureBackup: (
      serverId: string,
      projectId: string,
      databaseId: string,
      data: ConfigureDockerBackupData,
    ) => {
      const { put } = useApi();
      return put<ApiResponse<DockerDatabaseBackup>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/backup`,
        data,
      );
    },
    deleteBackup: (serverId: string, projectId: string, databaseId: string) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/backup`,
      );
    },
    listBackupRuns: (serverId: string, projectId: string, databaseId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerDatabaseBackupRun[]>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/backup/runs`,
      );
    },
    runBackup: (serverId: string, projectId: string, databaseId: string) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDatabaseBackupRun>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/backup/run`,
        {},
      );
    },
    restoreBackup: (
      serverId: string,
      projectId: string,
      databaseId: string,
      runId: string,
    ) => {
      const { post } = useApi();
      return post<ApiResponse<null>>(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/backup/restore`,
        { run_id: runId },
      );
    },

    // Database env vars — user-added extras layered on top of the
    // auto-generated engine credentials. Values may reference
    // `${{project.<KEY>}}` — the run-database worker substitutes
    // them at docker-run time so a project-level change propagates
    // on the next Restart / Rebuild.
    envVars: {
      list: (serverId: string, projectId: string, databaseId: string) => {
        const { get } = useApi();
        return get<ApiResponse<DockerDatabaseEnvVar[]>>(
          `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/env-vars`,
        );
      },
      create: (
        serverId: string,
        projectId: string,
        databaseId: string,
        data: CreateDockerEnvVarData,
      ) => {
        const { post } = useApi();
        return post<ApiResponse<DockerDatabaseEnvVar>>(
          `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/env-vars`,
          data,
        );
      },
      update: (
        serverId: string,
        projectId: string,
        databaseId: string,
        envVarId: string,
        data: UpdateDockerEnvVarData,
      ) => {
        const { patch } = useApi();
        return patch<ApiResponse<DockerDatabaseEnvVar>>(
          `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/env-vars/${envVarId}`,
          data,
        );
      },
      delete: (
        serverId: string,
        projectId: string,
        databaseId: string,
        envVarId: string,
      ) => {
        const { delete: del } = useApi();
        return del(
          `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}/env-vars/${envVarId}`,
        );
      },
    },
  },

  // --- Docker registry credentials --------------------------------
  //
  // Team-scoped saved logins for private docker registries. Managed
  // in Settings → Connections; picked from application + compose
  // create dialogs. Password is write-only over the wire — the
  // response carries `has_password` so the edit form can render
  // "•••• change?" instead of an empty input.
  registryCredentials: {
    list: () => {
      const { get } = useApi();
      return get<ApiResponse<DockerRegistryCredential[]>>("/registry-credentials");
    },
    create: (data: CreateDockerRegistryCredentialData) => {
      const { post } = useApi();
      return post<ApiResponse<DockerRegistryCredential>>(
        "/registry-credentials",
        data,
      );
    },
    update: (id: string, data: UpdateDockerRegistryCredentialData) => {
      const { patch } = useApi();
      return patch<ApiResponse<DockerRegistryCredential>>(
        `/registry-credentials/${id}`,
        data,
      );
    },
    delete: (id: string) => {
      const { delete: del } = useApi();
      return del(`/registry-credentials/${id}`);
    },
  },
};

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
  source_type: DockerSourceType;
  source_config?: Record<string, unknown> | null;
  build_type?: string | null;
  build_config?: Record<string, unknown> | null;
  status: DockerApplicationStatus;
  container_id?: string | null;
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
    registry_credential_id?: string;
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

export interface DockerDomain {
  id: string;
  application_id: string;
  host: string;
  path?: string | null;
  https: boolean;
  certificate_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerDomainData {
  host: string;
  path?: string;
  https?: boolean;
}

export interface UpdateDockerDomainData {
  https?: boolean;
  path?: string;
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

export type DockerVolumeType = "named" | "bind";

export interface DockerVolume {
  id: string;
  application_id: string;
  name: string;
  mount_path: string;
  type: DockerVolumeType;
  host_path?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerVolumeData {
  name: string;
  mount_path: string;
  type: DockerVolumeType;
  host_path?: string;
}

export interface UpdateDockerVolumeData {
  mount_path?: string;
  host_path?: string;
}

// ---- Schedules + advanced -------------------------------------------------

export interface DockerSchedule {
  id: string;
  application_id: string;
  cron: string;
  command: string;
  last_run_at?: string | null;
  last_status?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateDockerScheduleData {
  cron: string;
  command: string;
}

export interface UpdateDockerScheduleData {
  cron?: string;
  command?: string;
}

/**
 * Advanced runtime knobs. All optional; present keys go to
 * build_config and apply on the next deploy. Empty strings clear.
 */
export interface UpdateDockerAdvancedData {
  cpu_limit?: string;
  memory_limit?: string;
  restart_policy?: "no" | "on-failure" | "always" | "unless-stopped";
  healthcheck_command?: string;
  extra_ports?: string[];
}

// ---- Host diagnostic types ------------------------------------------------

/** Output of `docker ps -a --format '{{json .}}'`. */
export interface DockerHostContainer {
  ID: string;
  Names: string;
  Image: string;
  Command: string;
  Status: string;
  State: string;
  Ports: string;
  CreatedAt: string;
}

/** Output of `docker volume ls --format '{{json .}}'`. */
export interface DockerHostVolume {
  Name: string;
  Driver: string;
  Scope: string;
  Mountpoint: string;
}

/** Output of `docker network ls --format '{{json .}}'`. */
export interface DockerHostNetwork {
  ID: string;
  Name: string;
  Driver: string;
  Scope: string;
}

/** Traefik static + dynamic config files served from /etc/launch/traefik. */
export interface DockerTraefikSnapshot {
  static_config: string;
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
  status: DockerApplicationStatus;
  last_deployed_at?: string | null;
  created_at?: string;
  updated_at?: string;
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
}

export interface UpdateDockerComposeData {
  name?: string;
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
  target_type: "application" | "compose";
  target_id: string;
  status:
    | "pending"
    | "building"
    | "deploying"
    | "success"
    | "failed"
    | "cancelled";
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

    delete: (serverId: string, projectId: string, applicationId: string) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}`,
      );
    },

    deploy: (serverId: string, projectId: string, applicationId: string) => {
      const { post } = useApi();
      return post<ApiResponse<DockerDeployment>>(
        `/servers/${serverId}/docker/projects/${projectId}/applications/${applicationId}/deploy`,
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

    delete: (serverId: string, projectId: string, composeId: string) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/composes/${composeId}`,
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
    volumes: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerHostVolume[]>>(
        `/servers/${serverId}/docker/volumes`,
      );
    },
    networks: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerHostNetwork[]>>(
        `/servers/${serverId}/docker/networks`,
      );
    },
    traefik: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerTraefikSnapshot>>(
        `/servers/${serverId}/docker/traefik`,
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

    delete: (serverId: string, projectId: string, databaseId: string) => {
      const { delete: del } = useApi();
      return del(
        `/servers/${serverId}/docker/projects/${projectId}/databases/${databaseId}`,
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
  },
};

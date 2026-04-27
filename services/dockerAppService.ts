import type {
  DockerApp,
  DockerAppEnvVar,
  DockerAppPort,
  DockerAppVolume,
  DockerAppDomain,
  DockerAppRestartPolicy,
} from "~/types";
import type { ApiResponse } from "~/composables/useApi";

export interface CreateDockerAppData {
  name: string;
  image: string;
  tag?: string;
  registry_credential_id?: string;
  restart_policy?: DockerAppRestartPolicy;
}

export interface UpdateDockerAppData {
  image?: string;
  tag?: string;
  registry_credential_id?: string;
  restart_policy?: DockerAppRestartPolicy;
}

export interface DockerAppLogsResponse {
  app_id: string;
  tail: number;
  output: string;
}

/**
 * Server-scoped CRUD + lifecycle for docker applications. Used by the
 * "Apps" tab on Docker servers.
 */
export const dockerAppService = {
  list: (serverId: string) => {
    const { get } = useApi();
    return get<ApiResponse<DockerApp[]>>(`/servers/${serverId}/apps`);
  },

  get: (serverId: string, appId: string) => {
    const { get } = useApi();
    return get<ApiResponse<DockerApp>>(`/servers/${serverId}/apps/${appId}`);
  },

  create: (serverId: string, data: CreateDockerAppData) => {
    const { post } = useApi();
    return post<ApiResponse<DockerApp>>(`/servers/${serverId}/apps`, data);
  },

  update: (serverId: string, appId: string, data: UpdateDockerAppData) => {
    const { put } = useApi();
    return put<ApiResponse<DockerApp>>(`/servers/${serverId}/apps/${appId}`, data);
  },

  uninstall: (serverId: string, appId: string, removeData = false) => {
    const { delete: del } = useApi();
    const query = removeData ? "?remove_data=true" : "";
    return del<ApiResponse<null>>(`/servers/${serverId}/apps/${appId}${query}`);
  },

  deploy: (serverId: string, appId: string) => {
    const { post } = useApi();
    return post<ApiResponse<null>>(`/servers/${serverId}/apps/${appId}/deploy`);
  },

  start: (serverId: string, appId: string) => {
    const { post } = useApi();
    return post<ApiResponse<null>>(`/servers/${serverId}/apps/${appId}/start`);
  },

  stop: (serverId: string, appId: string) => {
    const { post } = useApi();
    return post<ApiResponse<null>>(`/servers/${serverId}/apps/${appId}/stop`);
  },

  restart: (serverId: string, appId: string) => {
    const { post } = useApi();
    return post<ApiResponse<null>>(`/servers/${serverId}/apps/${appId}/restart`);
  },

  logs: (serverId: string, appId: string, tail = 200) => {
    const { get } = useApi();
    return get<ApiResponse<DockerAppLogsResponse>>(
      `/servers/${serverId}/apps/${appId}/logs?tail=${tail}`,
    );
  },

  // Sub-resources -------------------------------------------------------

  envVars: {
    list: (serverId: string, appId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerAppEnvVar[]>>(
        `/servers/${serverId}/apps/${appId}/env-vars`,
      );
    },
    create: (
      serverId: string,
      appId: string,
      data: { key: string; value: string; secret?: boolean },
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerAppEnvVar>>(
        `/servers/${serverId}/apps/${appId}/env-vars`,
        data,
      );
    },
    delete: (serverId: string, appId: string, envVarId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/apps/${appId}/env-vars/${envVarId}`,
      );
    },
  },

  ports: {
    list: (serverId: string, appId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerAppPort[]>>(
        `/servers/${serverId}/apps/${appId}/ports`,
      );
    },
    create: (
      serverId: string,
      appId: string,
      data: { host_port: number; container_port: number; protocol?: string },
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerAppPort>>(
        `/servers/${serverId}/apps/${appId}/ports`,
        data,
      );
    },
    delete: (serverId: string, appId: string, portId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/apps/${appId}/ports/${portId}`,
      );
    },
  },

  volumes: {
    list: (serverId: string, appId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerAppVolume[]>>(
        `/servers/${serverId}/apps/${appId}/volumes`,
      );
    },
    create: (
      serverId: string,
      appId: string,
      data: { name: string; mount_path: string },
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerAppVolume>>(
        `/servers/${serverId}/apps/${appId}/volumes`,
        data,
      );
    },
    delete: (serverId: string, appId: string, volumeId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/apps/${appId}/volumes/${volumeId}`,
      );
    },
  },

  domains: {
    list: (serverId: string, appId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerAppDomain[]>>(
        `/servers/${serverId}/apps/${appId}/domains`,
      );
    },
    create: (
      serverId: string,
      appId: string,
      data: { domain: string; container_port: number; tls?: boolean },
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerAppDomain>>(
        `/servers/${serverId}/apps/${appId}/domains`,
        data,
      );
    },
    delete: (serverId: string, appId: string, domainId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/apps/${appId}/domains/${domainId}`,
      );
    },
  },
};

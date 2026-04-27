import type {
  Server,
  Site,
  Database,
  DatabaseUser,
  Service,
  Cron,
  QueueDaemon,
  FirewallRule,
  SSHKey,
  ConnectedServerProvider,
  Task,
  ProvisionStatus,
  LoadBalancerUpstream,
  LoadBalancerBackend,
  UpstreamHealthResponse,
  CheckDomainResponse,
  DockerService,
  DockerServiceKind,
  DockerServiceLogs,
} from "~/types";
import type { ApiResponse } from "~/composables/useApi";

export interface CreateServerOptions {
  phpVersions: Record<string, string>;
  databaseTypes: Record<string, string>;
  serverTypes: Record<string, string>;
  operatingSystems: Record<string, string>;
  plans: Record<
    string,
    {
      plans: { value: string; title: string; specs?: string }[];
      regions: { value: string; title: string }[];
    }
  >;
  canCreateServer: boolean;
}

export interface CreateServerData {
  name: string;
  service_provider: string;
  server_provider_id?: string;
  region?: string;
  plan?: string;
  type?: string;
  operating_system?: string;
  database?: string;
  php?: string;
  ssh_keys?: string[];
  ip?: string;
  port?: string;
  install_agent?: boolean;
}

/**
 * Server service for handling all server-related API calls
 */
export const serverService = {
  /**
   * Get all servers
   */
  list: () => {
    const { get } = useApi();
    return get<ApiResponse<Server[]>>("/servers");
  },

  /**
   * Get a single server by ID
   */
  get: (id: string) => {
    const { get } = useApi();
    return get<ApiResponse<Server>>(`/servers/${id}`);
  },

  /**
   * Get create server options (plans, regions, etc.)
   */
  getCreateOptions: () => {
    const { get } = useApi();
    return get<ApiResponse<CreateServerOptions>>("/servers/create-options");
  },

  /**
   * Create a new server
   */
  create: (data: CreateServerData) => {
    const { post } = useApi();
    return post<ApiResponse<Server>>("/servers", {
      name: data.name,
      provider: data.service_provider,
      credential_id: data.server_provider_id,
      region: data.region,
      size: data.plan,
      type: data.type,
      operating_system: data.operating_system,
      database_type: data.database,
      php_version: data.php,
      ssh_key_ids: data.ssh_keys,
      ip: data.ip,
      port: data.port ? parseInt(data.port, 10) : undefined,
      install_agent: data.install_agent,
    });
  },

  /**
   * Update a server
   */
  update: (id: string, data: Partial<Server>) => {
    const { put } = useApi();
    return put<ApiResponse<Server>>(`/servers/${id}`, data);
  },

  /**
   * Delete a server
   */
  delete: (id: string) => {
    const { delete: del } = useApi();
    return del<ApiResponse<null>>(`/servers/${id}`);
  },

  /**
   * Reboot a server
   */
  reboot: (id: string) => {
    const { post } = useApi();
    return post<ApiResponse<null>>(`/servers/${id}/reboot`);
  },

  /**
   * Retry provisioning a failed server
   */
  retryProvision: (id: string) => {
    const { post } = useApi();
    return post<ApiResponse<null>>(`/servers/${id}/retry-provision`);
  },

  /**
   * Get provision status for a server
   */
  getProvisionStatus: (id: string) => {
    const { get } = useApi();
    return get<ApiResponse<ProvisionStatus>>(`/servers/${id}/provision-status`);
  },

  // Tasks
  tasks: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<Task[]>>(`/servers/${serverId}/tasks`);
    },
    getLatest: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<Task>>(`/servers/${serverId}/tasks/latest`);
    },
  },

  // Sites
  sites: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<Site[]>>(`/servers/${serverId}/sites`);
    },
  },

  // Databases
  databases: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<Database[]>>(`/servers/${serverId}/databases`);
    },
    create: (serverId: string, name: string) => {
      const { post } = useApi();
      return post<ApiResponse<Database>>(`/servers/${serverId}/databases`, {
        name,
      });
    },
    delete: (serverId: string, databaseId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/databases/${databaseId}`
      );
    },
  },

  // Database Users
  databaseUsers: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DatabaseUser[]>>(
        `/servers/${serverId}/database-users`
      );
    },
    create: (
      serverId: string,
      data: { name: string; password: string; databases?: string[] }
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DatabaseUser>>(
        `/servers/${serverId}/database-users`,
        data
      );
    },
    delete: (serverId: string, userId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/database-users/${userId}`
      );
    },
  },

  // Services (PHP, MySQL, etc.)
  services: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<Service[]>>(`/servers/${serverId}/services`);
    },
    restart: (serverId: string, serviceId: string) => {
      const { post } = useApi();
      return post<ApiResponse<null>>(
        `/servers/${serverId}/services/${serviceId}/restart`
      );
    },
  },

  // Cron Jobs
  crons: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<Cron[]>>(`/servers/${serverId}/crons`);
    },
    create: (
      serverId: string,
      data: { command: string; expression: string; user?: string }
    ) => {
      const { post } = useApi();
      return post<ApiResponse<Cron>>(`/servers/${serverId}/crons`, data);
    },
    delete: (serverId: string, cronId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(`/servers/${serverId}/crons/${cronId}`);
    },
  },

  // Daemons
  daemons: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<QueueDaemon[]>>(`/servers/${serverId}/daemons`);
    },
    create: (
      serverId: string,
      data: {
        command: string;
        directory?: string;
        user?: string;
        processes?: number;
      }
    ) => {
      const { post } = useApi();
      return post<ApiResponse<QueueDaemon>>(`/servers/${serverId}/daemons`, data);
    },
    restart: (serverId: string, daemonId: string) => {
      const { post } = useApi();
      return post<ApiResponse<null>>(
        `/servers/${serverId}/daemons/${daemonId}/restart`
      );
    },
    delete: (serverId: string, daemonId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(`/servers/${serverId}/daemons/${daemonId}`);
    },
  },

  // Docker Services (managed Postgres / MySQL / Redis containers on a Docker server)
  dockerServices: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<DockerService[]>>(
        `/servers/${serverId}/docker-services`
      );
    },
    install: (
      serverId: string,
      data: {
        kind: DockerServiceKind;
        image?: string;
        username?: string;
        password?: string;
        database_name?: string;
      }
    ) => {
      const { post } = useApi();
      return post<ApiResponse<DockerService>>(
        `/servers/${serverId}/docker-services`,
        data
      );
    },
    uninstall: (
      serverId: string,
      kind: DockerServiceKind,
      removeData = false
    ) => {
      const { delete: del } = useApi();
      const query = removeData ? "?remove_data=true" : "";
      return del<ApiResponse<null>>(
        `/servers/${serverId}/docker-services/${kind}${query}`
      );
    },
    start: (serverId: string, kind: DockerServiceKind) => {
      const { post } = useApi();
      return post<ApiResponse<null>>(
        `/servers/${serverId}/docker-services/${kind}/start`
      );
    },
    stop: (serverId: string, kind: DockerServiceKind) => {
      const { post } = useApi();
      return post<ApiResponse<null>>(
        `/servers/${serverId}/docker-services/${kind}/stop`
      );
    },
    restart: (serverId: string, kind: DockerServiceKind) => {
      const { post } = useApi();
      return post<ApiResponse<null>>(
        `/servers/${serverId}/docker-services/${kind}/restart`
      );
    },
    logs: (serverId: string, kind: DockerServiceKind, tail = 200) => {
      const { get } = useApi();
      return get<ApiResponse<DockerServiceLogs>>(
        `/servers/${serverId}/docker-services/${kind}/logs?tail=${tail}`
      );
    },
  },

  // Firewall Rules
  firewall: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<FirewallRule[]>>(
        `/servers/${serverId}/firewall-rules`
      );
    },
    create: (
      serverId: string,
      data: { name: string; port: string; from_ipv4?: string }
    ) => {
      const { post } = useApi();
      return post<ApiResponse<FirewallRule>>(
        `/servers/${serverId}/firewall-rules`,
        data
      );
    },
    delete: (serverId: string, ruleId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(
        `/servers/${serverId}/firewall-rules/${ruleId}`
      );
    },
  },

  // SSH Keys
  sshKeys: {
    list: (serverId: string) => {
      const { get } = useApi();
      return get<ApiResponse<SSHKey[]>>(`/servers/${serverId}/ssh-keys`);
    },
    create: (
      serverId: string,
      data: { name: string; public_key: string }
    ) => {
      const { post } = useApi();
      return post<ApiResponse<SSHKey>>(`/servers/${serverId}/ssh-keys`, data);
    },
    delete: (serverId: string, keyId: string) => {
      const { delete: del } = useApi();
      return del<ApiResponse<null>>(`/servers/${serverId}/ssh-keys/${keyId}`);
    },
  },

  // Load Balancer
  loadBalancer: {
    checkDomain: (serverId: string, address: string) => {
      const { get } = useApi();
      return get<ApiResponse<CheckDomainResponse>>(
        `/servers/${serverId}/upstreams/check-domain?address=${encodeURIComponent(address)}`
      );
    },

    // Upstreams
    upstreams: {
      list: (serverId: string) => {
        const { get } = useApi();
        return get<ApiResponse<LoadBalancerUpstream[]>>(
          `/servers/${serverId}/upstreams`
        );
      },
      get: (serverId: string, upstreamId: string) => {
        const { get } = useApi();
        return get<ApiResponse<LoadBalancerUpstream>>(
          `/servers/${serverId}/upstreams/${upstreamId}`
        );
      },
      create: (
        serverId: string,
        data: {
          name: string;
          address: string;
          port?: number;
          tls_setting?: string;
          lb_policy: string;
          health_check_path?: string;
          health_check_interval?: string;
          health_check_timeout?: string;
          auto_add_existing_sites?: boolean;
        }
      ) => {
        const { post } = useApi();
        return post<ApiResponse<LoadBalancerUpstream>>(
          `/servers/${serverId}/upstreams`,
          data
        );
      },
      update: (
        serverId: string,
        upstreamId: string,
        data: {
          name?: string;
          lb_policy?: string;
          health_check_path?: string;
          health_check_interval?: string;
          health_check_timeout?: string;
        }
      ) => {
        const { put } = useApi();
        return put<ApiResponse<LoadBalancerUpstream>>(
          `/servers/${serverId}/upstreams/${upstreamId}`,
          data
        );
      },
      delete: (serverId: string, upstreamId: string) => {
        const { delete: del } = useApi();
        return del<ApiResponse<null>>(
          `/servers/${serverId}/upstreams/${upstreamId}`
        );
      },
      health: (serverId: string, upstreamId: string) => {
        const { get } = useApi();
        return get<ApiResponse<UpstreamHealthResponse>>(
          `/servers/${serverId}/upstreams/${upstreamId}/health`
        );
      },
      triggerHealthCheck: (serverId: string, upstreamId: string) => {
        const { post } = useApi();
        return post<ApiResponse<null>>(
          `/servers/${serverId}/upstreams/${upstreamId}/health-check`
        );
      },
    },

    // Backends
    backends: {
      list: (serverId: string, upstreamId: string) => {
        const { get } = useApi();
        return get<ApiResponse<LoadBalancerBackend[]>>(
          `/servers/${serverId}/upstreams/${upstreamId}/backends`
        );
      },
      add: (
        serverId: string,
        upstreamId: string,
        data: { site_id: string; port?: number }
      ) => {
        const { post } = useApi();
        return post<ApiResponse<LoadBalancerBackend>>(
          `/servers/${serverId}/upstreams/${upstreamId}/backends`,
          data
        );
      },
      update: (
        serverId: string,
        upstreamId: string,
        backendId: string,
        data: { port?: number; is_down?: boolean }
      ) => {
        const { put } = useApi();
        return put<ApiResponse<LoadBalancerBackend>>(
          `/servers/${serverId}/upstreams/${upstreamId}/backends/${backendId}`,
          data
        );
      },
      remove: (serverId: string, upstreamId: string, backendId: string) => {
        const { delete: del } = useApi();
        return del<ApiResponse<null>>(
          `/servers/${serverId}/upstreams/${upstreamId}/backends/${backendId}`
        );
      },
      toggleDown: (serverId: string, upstreamId: string, backendId: string) => {
        const { post } = useApi();
        return post<ApiResponse<LoadBalancerBackend>>(
          `/servers/${serverId}/upstreams/${upstreamId}/backends/${backendId}/toggle-down`
        );
      },
    },
  },
};

/**
 * Server providers service
 */
export const serverProviderService = {
  list: () => {
    const { get } = useApi();
    return get<ApiResponse<ConnectedServerProvider[]>>("/server-providers");
  },

  connect: (provider: string, credentials: Record<string, string>) => {
    const { post } = useApi();
    return post<ApiResponse<ConnectedServerProvider>>("/server-providers", {
      provider,
      ...credentials,
    });
  },

  disconnect: (id: number) => {
    const { delete: del } = useApi();
    return del<ApiResponse<null>>(`/server-providers/${id}`);
  },
};

/**
 * SSH Keys service (user level)
 */
export const sshKeyService = {
  list: (globalOnly = false) => {
    const { get } = useApi();
    const query = globalOnly ? "?global=true" : "";
    return get<ApiResponse<SSHKey[]>>(`/ssh-keys${query}`);
  },

  create: (data: { name: string; public_key: string; is_global?: boolean }) => {
    const { post } = useApi();
    return post<ApiResponse<SSHKey>>("/ssh-keys", data);
  },

  delete: (id: string) => {
    const { delete: del } = useApi();
    return del<ApiResponse<null>>(`/ssh-keys/${id}`);
  },
};

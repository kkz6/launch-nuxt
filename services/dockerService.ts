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
};

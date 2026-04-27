import type { DockerRegistry, DockerRegistryType } from "~/types";
import type { ApiResponse } from "~/composables/useApi";

export interface CreateDockerRegistryData {
  name: string;
  type: DockerRegistryType;
  url?: string;
  username: string;
  password: string;
}

export interface UpdateDockerRegistryData {
  name?: string;
  url?: string;
  username?: string;
  password?: string;
}

/**
 * Team-scoped CRUD for docker registry credentials. Used at deploy time
 * by the application module to run `docker login` before pulling private
 * images.
 */
export const dockerRegistryService = {
  list: () => {
    const { get } = useApi();
    return get<ApiResponse<DockerRegistry[]>>("/docker-registries");
  },

  get: (id: string) => {
    const { get } = useApi();
    return get<ApiResponse<DockerRegistry>>(`/docker-registries/${id}`);
  },

  create: (data: CreateDockerRegistryData) => {
    const { post } = useApi();
    return post<ApiResponse<DockerRegistry>>("/docker-registries", data);
  },

  update: (id: string, data: UpdateDockerRegistryData) => {
    const { put } = useApi();
    return put<ApiResponse<DockerRegistry>>(`/docker-registries/${id}`, data);
  },

  delete: (id: string) => {
    const { delete: del } = useApi();
    return del<ApiResponse<null>>(`/docker-registries/${id}`);
  },
};

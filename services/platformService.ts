import type { PlatformUpdate, PlatformUpdateDetail } from "~/types";
import type { ApiResponse } from "~/composables/useApi";

export const platformService = {
  listPendingUpdates: () => {
    const { get } = useApi();
    return get<ApiResponse<PlatformUpdate[]>>("/platform/updates");
  },

  getUpdate: (id: string) => {
    const { get } = useApi();
    return get<ApiResponse<PlatformUpdateDetail>>(`/platform/updates/${id}`);
  },

  runUpdate: (id: string, serverId: string) => {
    const { post } = useApi();
    return post<ApiResponse<void>>(`/platform/updates/${id}/run`, {
      server_id: serverId,
    });
  },

  runUpdateAll: (id: string) => {
    const { post } = useApi();
    return post<ApiResponse<void>>(`/platform/updates/${id}/run-all`, {});
  },

  dismissUpdate: (id: string) => {
    const { post } = useApi();
    return post<ApiResponse<void>>(`/platform/updates/${id}/dismiss`, {});
  },
};

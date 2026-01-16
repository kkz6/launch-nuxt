import type { SourceControl, Repository } from "~/types";
import type { ApiResponse } from "~/composables/useApi";

/**
 * Source Control service for handling source control related API calls
 */
export const sourceControlService = {
  /**
   * Get all connected source controls
   */
  list: () => {
    const { get } = useApi();
    return get<ApiResponse<SourceControl[]>>("/source-controls");
  },

  /**
   * Get repositories for a specific source control
   */
  repositories: (sourceControlId: string) => {
    const { get } = useApi();
    return get<ApiResponse<Repository[]>>(`/source-controls/${sourceControlId}/repositories`);
  },
};

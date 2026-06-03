import type { User, Team, Server } from "~/types";
import type { ApiResponse } from "~/composables/useApi";

export interface AdminMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface PaginatedAdminResponse<T> extends ApiResponse<T[]> {
  meta: AdminMeta;
}

export interface ImpersonationSession {
  id?: string;
  user_id?: string | number;
  impersonator_id?: string | number;
  reason?: string;
  expires_at?: string;
  [key: string]: unknown;
}

export interface ImpersonateResponse {
  token: string;
  session: ImpersonationSession;
}

export interface ServerLog {
  id?: string;
  message?: string;
  level?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface PaginationParams {
  limit?: number;
  offset?: number;
}

const toQuery = (params: PaginationParams = {}) => {
  const query: Record<string, number> = {};
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.offset !== undefined) query.offset = params.offset;
  return query;
};

/**
 * Admin (staff back-office) service. All endpoints require a staff JWT.
 */
export const adminService = {
  users: (params: PaginationParams = {}) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<User>>("/admin/users", {
      query: toQuery(params),
    });
  },

  teams: (params: PaginationParams = {}) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<Team>>("/admin/teams", {
      query: toQuery(params),
    });
  },

  servers: (params: PaginationParams = {}) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<Server>>("/admin/servers", {
      query: toQuery(params),
    });
  },

  serverLogs: (serverId: string) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<ServerLog>>(
      `/admin/servers/${serverId}/logs`,
    );
  },

  /**
   * Start impersonating a user. Returns a 30-min read-only JWT that
   * authenticates as the target user.
   */
  impersonate: (userId: string | number, reason?: string) => {
    const { post } = useApi();
    return post<ApiResponse<ImpersonateResponse>>(
      `/admin/impersonate/${userId}`,
      reason ? { reason } : {},
    );
  },

  /**
   * Stop the active impersonation session. MUST be called with the staff
   * token (the impersonation token's user is the customer and would fail
   * the staff check).
   */
  stopImpersonating: () => {
    const { post } = useApi();
    return post<ApiResponse<null>>("/admin/impersonate/stop");
  },
};

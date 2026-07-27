import type {
  AdminUserRow,
  AdminServerSummary,
  AdminSiteSummary,
  AdminSubscriptionSummary,
  AdminServerDetail,
  AdminOverview,
  AdminFailuresResponse,
  AdminPlan,
  PlatformInvitation,
  Server,
  ObservabilitySnapshot,
  QueryEntry,
  N1Pattern,
} from "~/types";
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

interface FailuresParams extends PaginationParams {
  kind?: string;
}

const toQuery = (params: PaginationParams = {}) => {
  const query: Record<string, number> = {};
  if (params.limit !== undefined) query.limit = params.limit;
  if (params.offset !== undefined) query.offset = params.offset;
  return query;
};

interface FailuresResponse extends ApiResponse<AdminFailuresResponse> {
  meta: AdminMeta;
}

/**
 * Admin (staff back-office) service. All endpoints require a staff JWT.
 */
export const adminService = {
  users: (params: PaginationParams = {}) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<AdminUserRow>>("/admin/users", {
      query: toQuery(params),
    });
  },

  showUser: (id: string | number) => {
    const { get } = useApi();
    return get<ApiResponse<AdminUserRow>>(`/admin/users/${id}`);
  },

  userServers: (id: string | number) => {
    const { get } = useApi();
    return get<ApiResponse<AdminServerSummary[]>>(`/admin/users/${id}/servers`);
  },

  userSites: (id: string | number) => {
    const { get } = useApi();
    return get<ApiResponse<AdminSiteSummary[]>>(`/admin/users/${id}/sites`);
  },

  failureLog: (id: string | number, kind: string) => {
    const { get } = useApi();
    return get<ApiResponse<{ log: string }>>(`/admin/failures/${id}/log`, {
      query: { kind },
    });
  },

  userSubscriptions: (id: string | number) => {
    const { get } = useApi();
    return get<ApiResponse<AdminSubscriptionSummary[]>>(
      `/admin/users/${id}/subscriptions`,
    );
  },

  overview: () => {
    const { get } = useApi();
    return get<ApiResponse<AdminOverview>>("/admin/overview");
  },

  failures: (params: FailuresParams = {}) => {
    const { get } = useApi();
    const query: Record<string, string | number> = toQuery(params);
    if (params.kind !== undefined) query.kind = params.kind;
    return get<FailuresResponse>("/admin/failures", { query });
  },

  suspendUser: (id: string | number) => {
    const { post } = useApi();
    return post<ApiResponse<{ id: string; status: string }>>(
      `/admin/users/${id}/suspend`,
    );
  },

  unsuspendUser: (id: string | number) => {
    const { post } = useApi();
    return post<ApiResponse<{ id: string; status: string }>>(
      `/admin/users/${id}/unsuspend`,
    );
  },

  deleteUser: (id: string | number) => {
    const { delete: del } = useApi();
    return del<ApiResponse<{ id: string }>>(`/admin/users/${id}`);
  },

  invitations: (params: PaginationParams = {}) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<PlatformInvitation>>(
      "/admin/invitations",
      {
        query: toQuery(params),
      },
    );
  },

  plans: () => {
    const { get } = useApi();
    return get<ApiResponse<AdminPlan[]>>("/admin/plans");
  },

  createInvitation: (body: {
    email: string;
    plan_id: string;
    trial_ends_at: string;
  }) => {
    const { post } = useApi();
    return post<ApiResponse<PlatformInvitation>>("/admin/invitations", body);
  },

  revokeInvitation: (id: string | number) => {
    const { delete: del } = useApi();
    return del<ApiResponse<null>>(`/admin/invitations/${id}`);
  },

  servers: (params: PaginationParams = {}) => {
    const { get } = useApi();
    return get<PaginatedAdminResponse<Server>>("/admin/servers", {
      query: toQuery(params),
    });
  },

  showServer: (id: string | number) => {
    const { get } = useApi();
    return get<ApiResponse<AdminServerDetail>>(`/admin/servers/${id}`);
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

  observabilitySnapshot: () => {
    const { get } = useApi();
    return get<ApiResponse<ObservabilitySnapshot>>(
      "/admin/observability/snapshot",
    );
  },

  observabilityQueries: (params: { limit?: number } = {}) => {
    const { get } = useApi();
    return get<ApiResponse<QueryEntry[]>>("/admin/observability/queries", {
      query: params,
    });
  },

  observabilitySlowQueries: (params: { limit?: number } = {}) => {
    const { get } = useApi();
    return get<ApiResponse<QueryEntry[]>>(
      "/admin/observability/queries/slow",
      { query: params },
    );
  },

  observabilityN1: (params: { limit?: number } = {}) => {
    const { get } = useApi();
    return get<ApiResponse<N1Pattern[]>>("/admin/observability/queries/n1", {
      query: params,
    });
  },
};

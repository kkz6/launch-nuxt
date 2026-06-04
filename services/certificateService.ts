import type { ApiResponse } from "~/composables/useApi";
import type { CertificateUsage, StoredCertificate } from "~/types";

/**
 * Stored SSL Certificate service — team-scoped library of user-provided
 * certificates. Used by:
 *   - Settings → Connections (this phase) for library CRUD.
 *   - PHP site SSL dialog (Phase 4) for "pick from library" selection.
 *   - Docker domain dialog (Phase 5) likewise.
 *
 * Routes are mounted at the root of the api subdomain (`api.<domain>`),
 * so the path is `/certificates` and not `/api/certificates`.
 *
 * The backend never returns the private_key field (it's `json:"-"` on the
 * model). The PEM `certificate` is safe to render.
 */
export const certificateService = {
  list: () => {
    const { get } = useApi();
    return get<ApiResponse<StoredCertificate[]>>("/certificates");
  },

  get: (id: string) => {
    const { get } = useApi();
    return get<ApiResponse<StoredCertificate>>(`/certificates/${id}`);
  },

  create: (body: {
    name: string;
    certificate: string;
    private_key: string;
    notes?: string;
  }) => {
    const { post } = useApi();
    return post<ApiResponse<StoredCertificate>>("/certificates", body);
  },

  /**
   * PATCH the cert. When the response carried an `X-Pending-Redeploys`
   * header, the caller usually wants to surface that to the user — use
   * `updateRaw` instead to get the response + headers in one call.
   */
  update: (
    id: string,
    body: {
      name?: string;
      notes?: string;
      certificate?: string;
      private_key?: string;
    },
  ) => {
    const { patch } = useApi();
    return patch<ApiResponse<StoredCertificate>>(`/certificates/${id}`, body);
  },

  /**
   * PATCH variant that exposes response headers. The backend sets
   * `X-Pending-Redeploys` to the count of sites + domains that were
   * marked for redeploy when the cert content changed; UIs read that
   * to inform the user the queued-up redeploy count.
   *
   * Uses `$fetch.raw` directly (bypassing useApi) because the standard
   * apiFetch wrapper drops the underlying Response. Auth + team headers
   * are still threaded through manually.
   */
  updateRaw: async (
    id: string,
    body: {
      name?: string;
      notes?: string;
      certificate?: string;
      private_key?: string;
    },
  ) => {
    const { getAccessToken, getCurrentTeamId, baseURL } = useApi();
    const token = getAccessToken();
    const teamId = getCurrentTeamId();
    const res = await $fetch.raw<ApiResponse<StoredCertificate>>(
      `/certificates/${id}`,
      {
        baseURL,
        method: "PATCH",
        body,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(teamId ? { "X-Team-ID": teamId } : {}),
        },
      },
    );
    const pendingRedeploys = Number(
      res.headers.get("X-Pending-Redeploys") || "0",
    );
    return {
      data: res._data as ApiResponse<StoredCertificate>,
      pendingRedeploys: Number.isFinite(pendingRedeploys)
        ? pendingRedeploys
        : 0,
    };
  },

  /**
   * Delete the cert. 409 with `usages` payload when referenced — caller
   * should surface the list and offer "force delete". `force: true`
   * cascades and resets dependents to Let's Encrypt.
   */
  delete: (id: string, opts?: { force?: boolean }) => {
    const { delete: del } = useApi();
    const qs = opts?.force ? "?force=true" : "";
    return del(`/certificates/${id}${qs}`);
  },

  usages: (id: string) => {
    const { get } = useApi();
    return get<ApiResponse<CertificateUsage[]>>(`/certificates/${id}/usages`);
  },
};

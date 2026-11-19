import type { ApiResponse } from "~/composables/useApi";
import type { SourceControl } from "~/types";

export interface GitHubInstallationChoice {
  id: string;
  account_login: string;
  account_type: string;
  avatar_url?: string;
}

export interface GitHubConnectionAttempt {
  attempt_id: string;
  team_id: string;
  status: "authorizing" | "authorized" | "completed";
  source_control_id?: string;
  connection_generation?: number;
  selection_version?: number;
  target_installation_id?: string;
  installation_unavailable?: boolean;
  installations: GitHubInstallationChoice[];
  install_url?: string;
  expires_at: string;
}

export interface GitHubRepositoryChoice {
  github_repository_id: string;
  full_name: string;
  name: string;
  default_branch: string;
  private: boolean;
  selected: boolean;
  unavailable?: boolean;
  affected_workloads?: {
    kind: "site" | "application" | "compose";
    id: string;
    name: string;
  }[];
}

export interface GitHubCandidatesResponse {
  repositories: GitHubRepositoryChoice[];
  source_control_id?: string | null;
  connection_generation?: number;
  selection_version?: number;
  page?: number;
  next_page?: number;
  selected_repositories?: GitHubRepositoryChoice[];
}

const base = "/settings/git-providers/github/connection-attempts";
const attemptPath = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const githubConnectionService = {
  start: (
    sourceControlId?: string,
    acknowledgeShared = false,
    signal?: AbortSignal,
  ) => {
    const { post } = useApi();
    return post<
      ApiResponse<{
        attempt_id: string;
        url: string;
        team_id: string;
        expires_at: string;
      }>
    >(
      base,
      {
        ...(sourceControlId ? { source_control_id: sourceControlId } : {}),
        acknowledge_shared: acknowledgeShared,
      },
      { signal },
    );
  },
  attempt: (id: string, signal?: AbortSignal) => {
    const { get } = useApi();
    return get<ApiResponse<GitHubConnectionAttempt>>(attemptPath(id), {
      signal,
    });
  },
  candidates: (
    attemptId: string,
    installationId: string,
    signal?: AbortSignal,
    page = 1,
  ) => {
    const { get } = useApi();
    return get<ApiResponse<GitHubCandidatesResponse>>(
      `${attemptPath(attemptId)}/installations/${encodeURIComponent(installationId)}/repositories`,
      { signal, query: { page } },
    );
  },
  select: (
    attemptId: string,
    installationId: string,
    repositoryIds: string[],
    generation?: number,
    selectionVersion?: number,
    signal?: AbortSignal,
    sourceControlId?: string | null,
  ) => {
    const { post } = useApi();
    return post<ApiResponse<SourceControl>>(
      `${attemptPath(attemptId)}/selection`,
      {
        installation_id: installationId,
        repository_ids: repositoryIds,
        ...(sourceControlId === undefined
          ? {}
          : { source_control_id: sourceControlId }),
        ...(generation === undefined
          ? {}
          : { expected_generation: generation }),
        ...(selectionVersion === undefined
          ? {}
          : { expected_selection_version: selectionVersion }),
      },
      { signal },
    );
  },
  disconnect: (id: string, signal?: AbortSignal) => {
    const { delete: remove } = useApi();
    return remove<ApiResponse<unknown>>(
      `/source-controls/${encodeURIComponent(id)}`,
      { signal },
    );
  },
};

// Token storage keys
const ACCESS_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const TEAM_ID_KEY = "current_team_id";

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// Standard API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// Paginated response
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Error response
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// Request options type
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequestBody = Record<string, any> | FormData | null | undefined;

interface RequestOptions {
  method?: HttpMethod;
  body?: RequestBody;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
}

/**
 * Core API composable with token management and refresh logic
 */
export const useApi = () => {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiBase as string;

  // Token management
  const getAccessToken = (): string | null => {
    if (import.meta.server) return null;
    return useCookie(ACCESS_TOKEN_KEY).value || null;
  };

  const getRefreshToken = (): string | null => {
    if (import.meta.server) return null;
    return useCookie(REFRESH_TOKEN_KEY).value || null;
  };

  const setTokens = (
    accessToken: string | null,
    refreshToken?: string | null
  ) => {
    const accessCookie = useCookie(ACCESS_TOKEN_KEY, {
      maxAge: 60 * 60 * 24 * 3, // 3 days (matches access token expiry)
      secure: true,
      sameSite: "lax",
    });
    accessCookie.value = accessToken;

    if (refreshToken !== undefined) {
      const refreshCookie = useCookie(REFRESH_TOKEN_KEY, {
        maxAge: 60 * 60 * 24 * 30, // 30 days (matches refresh token expiry)
        secure: true,
        sameSite: "lax",
      });
      refreshCookie.value = refreshToken;
    }
  };

  const clearTokens = () => {
    setTokens(null, null);
    clearCurrentTeamId();
  };

  // Team ID management
  const getCurrentTeamId = (): string | null => {
    if (import.meta.server) return null;
    return useCookie(TEAM_ID_KEY).value || null;
  };

  const setCurrentTeamId = (teamId: string | number | null) => {
    const teamCookie = useCookie(TEAM_ID_KEY, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      secure: true,
      sameSite: "lax",
    });
    teamCookie.value = teamId ? String(teamId) : null;
  };

  const clearCurrentTeamId = () => {
    setCurrentTeamId(null);
  };

  // Refresh the access token
  const refreshAccessToken = async (): Promise<string | null> => {
    // If already refreshing, wait for that to complete
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const response = await $fetch<
          ApiResponse<{
            access_token: string;
            expires_in: number;
          }>
        >("/auth/refresh", {
          method: "POST",
          baseURL,
          body: { refresh_token: refreshToken },
        });

        const newAccessToken = response.data.access_token;
        setTokens(newAccessToken);
        return newAccessToken;
      } catch {
        // Refresh failed, clear tokens and redirect to login
        clearTokens();
        if (import.meta.client) {
          navigateTo("/login");
        }
        return null;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  // Main fetch function with auto-refresh
  const apiFetch = async <T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> => {
    const token = getAccessToken();
    const teamId = getCurrentTeamId();

    const fetchOptions = {
      baseURL,
      method: options.method || ("GET" as const),
      body: options.body,
      query: options.query,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(teamId ? { "X-Team-ID": teamId } : {}),
        ...options.headers,
      },
    };

    try {
      return await $fetch<T>(url, fetchOptions);
    } catch (error: unknown) {
      const errorResponse = error as {
        response?: { status?: number };
        data?: { message?: string };
      };

      // Check if it's a 401 error
      if (
        errorResponse?.response?.status === 401 &&
        getRefreshToken()
      ) {
        const newToken = await refreshAccessToken();

        if (newToken) {
          // Retry the request with new token
          return await $fetch<T>(url, {
            ...fetchOptions,
            headers: {
              ...fetchOptions.headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
        }
      }

      // Handle team-related errors (400: missing header, 403: not a member)
      if (import.meta.client) {
        const status = errorResponse?.response?.status;
        const message = errorResponse?.data?.message || "";

        if (
          (status === 400 && message.includes("X-Team-ID")) ||
          (status === 403 && message.includes("not a member"))
        ) {
          // Clear team ID and redirect - user can switch teams via navbar
          clearCurrentTeamId();
          navigateTo("/servers");
          throw error;
        }
      }

      throw error;
    }
  };

  // Convenience methods
  const get = <T>(
    url: string,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "GET" });

  const post = <T>(
    url: string,
    body?: RequestBody,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "POST", body });

  const put = <T>(
    url: string,
    body?: RequestBody,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "PUT", body });

  const patch = <T>(
    url: string,
    body?: RequestBody,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "PATCH", body });

  const del = <T>(
    url: string,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ) => apiFetch<T>(url, { ...options, method: "DELETE" });

  return {
    // Token management
    getAccessToken,
    getRefreshToken,
    setTokens,
    clearTokens,
    refreshAccessToken,

    // Team ID management
    getCurrentTeamId,
    setCurrentTeamId,
    clearCurrentTeamId,

    // Fetch methods
    fetch: apiFetch,
    get,
    post,
    put,
    patch,
    delete: del,

    // Config
    baseURL,
  };
};

/**
 * Reactive API composable using useFetch for SSR-friendly data fetching
 */
export function useApiQuery<T>(
  url: string | Ref<string> | (() => string),
  options: {
    method?: HttpMethod;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, string>;
    immediate?: boolean;
    watch?: boolean;
    default?: () => T;
  } = {}
) {
  const { getAccessToken, getCurrentTeamId, clearTokens, clearCurrentTeamId } = useApi();
  const config = useRuntimeConfig();
  const token = getAccessToken();
  const teamId = getCurrentTeamId();

  return useFetch(url, {
    baseURL: config.public.apiBase as string,
    method: options.method || "GET",
    body: options.body,
    query: options.query,
    immediate: options.immediate,
    watch: options.watch === false ? false : undefined,
    default: options.default,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(teamId ? { "X-Team-ID": teamId } : {}),
      ...options.headers,
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        clearTokens();
        navigateTo("/login");
      }

      // Handle team-related errors
      const message = (response._data as { message?: string })?.message || "";
      if (
        (response.status === 400 && message.includes("X-Team-ID")) ||
        (response.status === 403 && message.includes("not a member"))
      ) {
        clearCurrentTeamId();
        navigateTo("/servers");
      }
    },
  });
}

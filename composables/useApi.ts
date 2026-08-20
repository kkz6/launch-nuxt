import { useLocalePreference } from "~/composables/useLocalePreference";

const ACCESS_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const TEAM_ID_KEY = "current_team_id";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

let isRedirectingToLogin = false;

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiErrorResponse {
  success: false;
  code?: string;
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

const redirectToLogin = () => {
  if (isRedirectingToLogin || import.meta.server) return;
  isRedirectingToLogin = true;
  navigateTo("/login", { replace: true });
  setTimeout(() => {
    isRedirectingToLogin = false;
  }, 1000);
};

const hasInvalidTeamContext = (
  data: { code?: string; message?: string } | undefined,
): boolean =>
  data?.code === "team.context_required" || data?.code === "team.not_member";

export const useApi = () => {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiBase as string;
  const { getEffectiveLocale } = useLocalePreference();

  const getCookieValue = (key: string): string | null => {
    if (import.meta.server) return null;
    return useCookie<string | null>(key).value || null;
  };

  const getAccessToken = () => getCookieValue(ACCESS_TOKEN_KEY);
  const getRefreshToken = () => getCookieValue(REFRESH_TOKEN_KEY);

  const setTokens = (
    accessToken: string | null,
    refreshToken?: string | null,
  ) => {
    const accessCookie = useCookie(ACCESS_TOKEN_KEY, {
      maxAge: 60 * 60 * 24 * 3,
      secure: true,
      sameSite: "lax",
    });
    accessCookie.value = accessToken;

    if (refreshToken !== undefined) {
      const refreshCookie = useCookie(REFRESH_TOKEN_KEY, {
        maxAge: 60 * 60 * 24 * 30,
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

  const getCurrentTeamId = () => getCookieValue(TEAM_ID_KEY);

  const setCurrentTeamId = (teamId: string | number | null) => {
    const teamCookie = useCookie(TEAM_ID_KEY, {
      maxAge: 60 * 60 * 24 * 365,
      secure: true,
      sameSite: "lax",
    });
    teamCookie.value = teamId ? String(teamId) : null;
  };

  const clearCurrentTeamId = () => {
    setCurrentTeamId(null);
  };

  const refreshAccessToken = async (): Promise<string | null> => {
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
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Accept-Language": getEffectiveLocale(),
          },
        });

        const newAccessToken = response.data.access_token;
        setTokens(newAccessToken);
        return newAccessToken;
      } catch {
        clearTokens();
        redirectToLogin();
        return null;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  };

  const apiFetch = async <T>(
    url: string,
    options: RequestOptions = {},
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
        "Accept-Language": getEffectiveLocale(),
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
        data?: { code?: string; message?: string };
      };

      if (errorResponse?.response?.status === 401 && getRefreshToken()) {
        const newToken = await refreshAccessToken();

        if (newToken) {
          return await $fetch<T>(url, {
            ...fetchOptions,
            headers: {
              ...fetchOptions.headers,
              Authorization: `Bearer ${newToken}`,
              "Accept-Language": getEffectiveLocale(),
            },
          });
        }
      }

      if (hasInvalidTeamContext(errorResponse?.data)) {
        clearCurrentTeamId();
        navigateTo("/servers");
        throw error;
      }

      throw error;
    }
  };

  const get = <T>(
    url: string,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ) => apiFetch<T>(url, { ...options, method: "GET" });

  const post = <T>(
    url: string,
    body?: RequestBody,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ) => apiFetch<T>(url, { ...options, method: "POST", body });

  const put = <T>(
    url: string,
    body?: RequestBody,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ) => apiFetch<T>(url, { ...options, method: "PUT", body });

  const patch = <T>(
    url: string,
    body?: RequestBody,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ) => apiFetch<T>(url, { ...options, method: "PATCH", body });

  const del = <T>(
    url: string,
    options: Omit<RequestOptions, "method" | "body"> = {},
  ) => apiFetch<T>(url, { ...options, method: "DELETE" });

  return {
    getAccessToken,
    getRefreshToken,
    setTokens,
    clearTokens,
    refreshAccessToken,

    getCurrentTeamId,
    setCurrentTeamId,
    clearCurrentTeamId,
    getEffectiveLocale,

    fetch: apiFetch,
    get,
    post,
    put,
    patch,
    delete: del,

    baseURL,
  };
};

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
  } = {},
) {
  const {
    getAccessToken,
    getCurrentTeamId,
    clearTokens,
    clearCurrentTeamId,
    getEffectiveLocale,
  } = useApi();
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
      "Accept-Language": getEffectiveLocale(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(teamId ? { "X-Team-ID": teamId } : {}),
      ...options.headers,
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        clearTokens();
        redirectToLogin();
      }

      const data = response._data as
        { code?: string; message?: string } | undefined;
      if (hasInvalidTeamContext(data)) {
        clearCurrentTeamId();
        navigateTo("/servers");
      }
    },
  });
}

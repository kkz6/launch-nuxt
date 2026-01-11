/**
 * $api helper function for backwards compatibility
 * Wraps useApi().fetch() for easy migration from the old $api pattern
 */

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequestBody = Record<string, any> | FormData | null | undefined;

interface ApiOptions {
  method?: HttpMethod;
  body?: RequestBody;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>; // Alias for query (backwards compatibility)
}

/**
 * Simple API helper that uses the useApi composable
 * Usage: await $api<ResponseType>('/endpoint', { method: 'POST', body: data })
 */
export async function $api<T>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const { fetch } = useApi();
  // Support both 'params' (old) and 'query' (new) for query parameters
  const { params, ...rest } = options;
  return fetch<T>(url, {
    ...rest,
    query: rest.query || params,
  });
}

import type { UseFetchOptions } from 'nuxt/app'
import { defu } from 'defu'

export const useApi = <T>(url: string, options: UseFetchOptions<T> = {}) => {
  const config = useRuntimeConfig()
  const { token } = useAuth()

  const defaults: UseFetchOptions<T> = {
    baseURL: config.public.apiBase as string,
    key: url,
    headers: token.value
      ? {
          Authorization: `Bearer ${token.value}`,
        }
      : {},
    onResponseError({ response }) {
      if (response.status === 401) {
        const { logout } = useAuth()
        logout()
      }
    },
  }

  const params = defu(options, defaults)

  return useFetch(url, params)
}

export const $api = async <T>(
  url: string,
  options: Parameters<typeof $fetch>[1] = {}
): Promise<T> => {
  const config = useRuntimeConfig()
  const { token, logout } = useAuth()

  try {
    return await $fetch<T>(url, {
      baseURL: config.public.apiBase as string,
      headers: token.value
        ? {
            Authorization: `Bearer ${token.value}`,
          }
        : {},
      ...options,
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const fetchError = error as { response?: { status?: number } }
      if (fetchError.response?.status === 401) {
        logout()
      }
    }
    throw error
  }
}

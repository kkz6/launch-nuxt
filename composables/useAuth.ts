import type { User } from '~/types'

const TOKEN_KEY = 'auth_token'

export const useAuth = () => {
  const user = useState<User | null>('auth_user', () => null)
  const token = useState<string | null>('auth_token', () => null)
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isLoading = useState('auth_loading', () => false)

  // Initialize token from cookie on client
  const initAuth = () => {
    if (import.meta.client) {
      const storedToken = useCookie(TOKEN_KEY).value
      if (storedToken) {
        token.value = storedToken
      }
    }
  }

  const setToken = (newToken: string | null) => {
    token.value = newToken
    const tokenCookie = useCookie(TOKEN_KEY, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: true,
      sameSite: 'lax',
    })
    tokenCookie.value = newToken
  }

  const setUser = (newUser: User | null) => {
    user.value = newUser
  }

  const login = async (credentials: { email: string; password: string }) => {
    isLoading.value = true
    try {
      const config = useRuntimeConfig()
      const response = await $fetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        baseURL: config.public.apiBase as string,
        body: credentials,
      })

      setToken(response.token)
      setUser(response.user)

      return response
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    try {
      if (token.value) {
        const config = useRuntimeConfig()
        await $fetch('/auth/logout', {
          method: 'POST',
          baseURL: config.public.apiBase as string,
          headers: {
            Authorization: `Bearer ${token.value}`,
          },
        }).catch(() => {
          // Ignore errors during logout
        })
      }
    } finally {
      setToken(null)
      setUser(null)
      navigateTo('/login')
    }
  }

  const fetchUser = async () => {
    if (!token.value) return null

    isLoading.value = true
    try {
      const config = useRuntimeConfig()
      const response = await $fetch<{ user: User }>('/auth/user', {
        baseURL: config.public.apiBase as string,
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })

      setUser(response.user)
      return response.user
    } catch {
      setToken(null)
      setUser(null)
      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    initAuth,
    setToken,
    setUser,
    login,
    logout,
    fetchUser,
  }
}

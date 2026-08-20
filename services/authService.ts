import type { User, LoginCredentials, RegisterData, UserSession } from '~/types'
import type { ApiResponse } from '~/composables/useApi'
import type { LocalePreference } from '~/types/locale'

export interface LoginResponse {
  two_factor_required: boolean
  challenge_token?: string
  user?: User
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

export interface CheckUserStatusResponse {
  user_exists: boolean
  requires_verification: boolean
  has_two_factor: boolean
  has_passkeys: boolean
  passkey_count: number
}

export interface RefreshTokenResponse {
  access_token: string
  expires_in: number
}

/**
 * Authentication service for handling all auth-related API calls
 */
export const authService = {
  /**
   * Check if a user exists and their auth requirements
   */
  checkUserStatus: (email: string) => {
    const { post } = useApi()
    return post<ApiResponse<CheckUserStatusResponse>>('/auth/check-user-status', { email })
  },

  /**
   * Login with email and password
   */
  login: (credentials: LoginCredentials) => {
    const { post } = useApi()
    return post<ApiResponse<LoginResponse>>('/auth/login', credentials)
  },

  /**
   * Register a new user
   */
  register: (data: RegisterData) => {
    const { post } = useApi()
    return post<ApiResponse<LoginResponse>>('/auth/register', data)
  },

  /**
   * Logout the current user
   */
  logout: () => {
    const { post } = useApi()
    return post<ApiResponse<null>>('/auth/logout')
  },

  /**
   * Get the current authenticated user
   */
  getUser: () => {
    const { get } = useApi()
    return get<ApiResponse<User>>('/auth/user')
  },

  /**
   * Update user profile
   */
  updateProfile: (data: { name?: string; email?: string; timezone?: string }) => {
    const { put } = useApi()
    return put<ApiResponse<User>>('/auth/profile', data)
  },

  /**
   * Save the user's language preference. `auto` clears the stored locale on
   * the backend while preserving automatic detection as an explicit choice.
   */
  updateLocale: (locale: LocalePreference) => {
    const { patch } = useApi()
    return patch<ApiResponse<User>>('/auth/locale', { locale })
  },

  /**
   * Update user password
   */
  updatePassword: (data: {
    current_password: string
    password: string
    password_confirmation: string
  }) => {
    const { put } = useApi()
    return put<ApiResponse<null>>('/auth/password', data)
  },

  /**
   * Request password reset email
   */
  forgotPassword: (email: string) => {
    const { post } = useApi()
    return post<ApiResponse<null>>('/auth/forgot-password', { email })
  },

  /**
   * Reset password with token
   */
  resetPassword: (data: {
    token: string
    email: string
    password: string
    password_confirmation: string
  }) => {
    const { post } = useApi()
    return post<ApiResponse<null>>('/auth/reset-password', data)
  },

  /**
   * Resend email verification
   */
  resendVerification: () => {
    const { post } = useApi()
    return post<ApiResponse<null>>('/auth/email/resend')
  },

  /**
   * Verify email with token
   */
  verifyEmail: (id: string, hash: string, expires: string, signature: string) => {
    const { get } = useApi()
    return get<ApiResponse<null>>(`/auth/email/verify/${id}/${hash}?expires=${expires}&signature=${signature}`)
  },

  /**
   * Refresh access token
   */
  refreshToken: (refreshToken: string) => {
    const { post } = useApi()
    return post<ApiResponse<RefreshTokenResponse>>('/auth/refresh', { refresh_token: refreshToken })
  },

  // Session management
  sessions: {
    list: () => {
      const { get } = useApi()
      return get<ApiResponse<UserSession[]>>('/user/sessions')
    },
    revoke: (id: string) => {
      const { delete: del } = useApi()
      return del<ApiResponse<null>>(`/user/sessions/${id}`)
    },
    revokeOthers: () => {
      const { delete: del } = useApi()
      return del<ApiResponse<{ revoked_count: number }>>('/user/sessions')
    },
  },

  // Two-factor authentication
  twoFactor: {
    /**
     * Enable 2FA - requires password, returns QR code and secret key
     */
    enable: (password: string) => {
      const { post } = useApi()
      return post<ApiResponse<{ qr_code_url: string; secret_key: string }>>('/auth/two-factor/enable', { password })
    },

    /**
     * Confirm 2FA with code - returns recovery codes
     */
    confirm: (code: string) => {
      const { post } = useApi()
      return post<ApiResponse<{ recovery_codes: string[] }>>('/auth/two-factor/confirm', { code })
    },

    /**
     * Disable 2FA - requires password
     */
    disable: (password: string) => {
      const { fetch } = useApi()
      return fetch<ApiResponse<null>>('/auth/two-factor/disable', { method: 'DELETE', body: { password } })
    },

    /**
     * Verify 2FA challenge during login — returns auth tokens on success
     */
    challenge: (data: { challenge_token: string; code?: string; recovery_code?: string }) => {
      const { post } = useApi()
      return post<ApiResponse<{
        user: User
        access_token: string
        refresh_token: string
        expires_in: number
        token_type: string
      }>>('/auth/two-factor/challenge', data)
    },

    /**
     * Get remaining recovery code count
     */
    recoveryCodeCount: () => {
      const { get } = useApi()
      return get<ApiResponse<{ remaining_count: number }>>('/auth/two-factor/recovery-codes')
    },

    /**
     * Regenerate recovery codes - returns new plaintext codes
     */
    regenerateRecoveryCodes: () => {
      const { post } = useApi()
      return post<ApiResponse<{ recovery_codes: string[] }>>('/auth/two-factor/recovery-codes')
    },
  },
}

import type { User, LoginCredentials, RegisterData, UserSession } from '~/types'
import type { ApiResponse } from '~/composables/useApi'

export interface LoginResponse {
  user: User
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface CheckUserStatusResponse {
  user_exists: boolean
  requires_verification: boolean
  has_two_factor: boolean
  has_passkeys: boolean
  passkey_count: number
}

export interface TwoFactorChallengeResponse {
  user: User
  access_token: string
  refresh_token: string
  expires_in: number
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
     * Enable 2FA - get QR code
     */
    enable: () => {
      const { post } = useApi()
      return post<ApiResponse<{ qr_code: string; secret: string }>>('/auth/two-factor/enable')
    },

    /**
     * Confirm 2FA with code
     */
    confirm: (code: string) => {
      const { post } = useApi()
      return post<ApiResponse<{ recovery_codes: string[] }>>('/auth/two-factor/confirm', { code })
    },

    /**
     * Disable 2FA
     */
    disable: (password: string) => {
      const { post } = useApi()
      return post<ApiResponse<null>>('/auth/two-factor/disable', { password })
    },

    /**
     * Verify 2FA challenge during login
     */
    challenge: (data: { code?: string; recovery_code?: string }) => {
      const { post } = useApi()
      return post<ApiResponse<TwoFactorChallengeResponse>>('/auth/two-factor/challenge', data)
    },

    /**
     * Get new recovery codes
     */
    recoveryCodes: () => {
      const { post } = useApi()
      return post<ApiResponse<{ recovery_codes: string[] }>>('/auth/two-factor/recovery-codes')
    },
  },
}

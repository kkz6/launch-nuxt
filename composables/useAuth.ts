import type { User } from "~/types";
import { authService } from "~/services/authService";

// Track initialization state globally
let authInitPromise: Promise<void> | null = null;

/**
 * Authentication composable for managing user state and auth operations
 */
export const useAuth = () => {
  const { setTokens, clearTokens, getAccessToken } = useApi();

  // Reactive state
  const user = useState<User | null>("auth_user", () => null);
  const isLoading = useState("auth_loading", () => false);
  const isInitialized = useState("auth_initialized", () => false);

  // Computed
  const isAuthenticated = computed(() => !!getAccessToken() && !!user.value);
  const token = computed(() => getAccessToken());

  /**
   * Initialize auth state from stored token
   * Returns a promise that resolves when initialization is complete
   */
  const initAuth = async (): Promise<void> => {
    // Skip on server
    if (import.meta.server) {
      isInitialized.value = true;
      return;
    }

    // If already initialized, return immediately
    if (isInitialized.value) {
      return;
    }

    // If initialization is in progress, wait for it
    if (authInitPromise) {
      return authInitPromise;
    }

    // Start initialization
    authInitPromise = (async () => {
      try {
        const storedToken = getAccessToken();
        if (storedToken && !user.value) {
          await fetchUser();
        }
      } finally {
        isInitialized.value = true;
        authInitPromise = null;
      }
    })();

    return authInitPromise;
  };

  /**
   * Wait for auth to be initialized (for use in middleware)
   */
  const waitForAuth = async (): Promise<void> => {
    if (import.meta.server) return;

    // If already initialized, return
    if (isInitialized.value) return;

    // If init is in progress, wait for it
    if (authInitPromise) {
      return authInitPromise;
    }

    // Otherwise, initialize now
    return initAuth();
  };

  /**
   * Set the current user
   */
  const setUser = (newUser: User | null) => {
    user.value = newUser;
  };

  /**
   * Check if a user exists by email
   */
  const checkUserStatus = async (email: string) => {
    const response = await authService.checkUserStatus(email);
    return response.data;
  };

  /**
   * Login with email and password
   */
  const login = async (credentials: { email: string; password: string }) => {
    isLoading.value = true;
    try {
      const response = await authService.login(credentials);

      // Store tokens
      setTokens(response.data.access_token, response.data.refresh_token);

      // Set user state
      setUser(response.data.user);

      // Mark as initialized
      isInitialized.value = true;

      return response.data;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Register a new user
   */
  const register = async (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => {
    isLoading.value = true;
    try {
      const response = await authService.register(data);

      // Store tokens
      setTokens(response.data.access_token, response.data.refresh_token);

      // Set user state
      setUser(response.data.user);

      // Mark as initialized
      isInitialized.value = true;

      return response.data;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Logout the current user
   */
  const logout = async () => {
    try {
      if (getAccessToken()) {
        await authService.logout().catch(() => {
          // Ignore errors during logout
        });
      }
    } finally {
      clearTokens();
      setUser(null);
      navigateTo("/login");
    }
  };

  /**
   * Fetch the current user from the API
   */
  const fetchUser = async () => {
    if (!getAccessToken()) return null;

    isLoading.value = true;
    try {
      const response = await authService.getUser();
      setUser(response.data);
      return response.data;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (data: {
    name?: string;
    email?: string;
    timezone?: string;
  }) => {
    isLoading.value = true;
    try {
      const response = await authService.updateProfile(data);
      setUser(response.data);
      return response.data;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Update user password
   */
  const updatePassword = async (data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) => {
    isLoading.value = true;
    try {
      await authService.updatePassword(data);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Request password reset email
   */
  const forgotPassword = async (email: string) => {
    isLoading.value = true;
    try {
      await authService.forgotPassword(email);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Reset password with token
   */
  const resetPassword = async (data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => {
    isLoading.value = true;
    try {
      await authService.resetPassword(data);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading,
    isInitialized,

    // Methods
    initAuth,
    waitForAuth,
    setUser,
    checkUserStatus,
    login,
    register,
    logout,
    fetchUser,
    updateProfile,
    updatePassword,
    forgotPassword,
    resetPassword,
  };
};

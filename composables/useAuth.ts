import type { User } from "~/types";
import type { LocalePreference } from "~/types/locale";
import { authService } from "~/services/authService";

let authInitPromise: Promise<void> | null = null;

interface UserLocaleSyncOptions {
  preserveEffectiveLocale?: boolean;
}

export const useAuth = () => {
  const {
    setTokens,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    getCurrentTeamId,
    setCurrentTeamId,
  } = useApi();
  const { applySavedUserLocale } = useLocalePreference();

  const user = useState<User | null>("auth_user", () => null);
  const isLoading = useState("auth_loading", () => false);
  const isInitialized = useState("auth_initialized", () => false);

  const isAuthenticated = computed(() => !!getAccessToken() && !!user.value);
  const token = computed(() => getAccessToken());

  // Access tokens can refresh during a request. The refresh token identifies
  // the login that owns the response, including a new login by the same user.
  const captureContext = (includeTeam = true) => {
    const session = getRefreshToken() || getAccessToken();
    const userId = user.value?.id;
    const teamId = getCurrentTeamId();
    return () =>
      session === (getRefreshToken() || getAccessToken()) &&
      userId === user.value?.id &&
      (!includeTeam || teamId === getCurrentTeamId());
  };

  const requireCurrentContext = (isCurrent: () => boolean) => {
    if (!isCurrent()) throw new DOMException("Account context changed", "AbortError");
  };

  const initAuth = async (): Promise<void> => {
    if (import.meta.server) {
      isInitialized.value = true;
      return;
    }

    if (isInitialized.value) {
      return;
    }

    if (authInitPromise) {
      return authInitPromise;
    }

    authInitPromise = (async () => {
      try {
        const storedToken = getAccessToken();
        if (storedToken && !user.value) {
          await fetchUser({ preserveEffectiveLocale: true });
        }
      } finally {
        isInitialized.value = true;
        authInitPromise = null;
      }
    })();

    return authInitPromise;
  };

  const waitForAuth = async (): Promise<void> => {
    if (import.meta.server) return;

    if (isInitialized.value) return;

    if (authInitPromise) {
      return authInitPromise;
    }

    return initAuth();
  };

  const setUser = async (
    newUser: User | null,
    options: UserLocaleSyncOptions = {},
  ): Promise<void> => {
    // Publish the team context before synchronous account-change watchers fetch.
    setCurrentTeamId(newUser?.current_team_id ?? null);
    user.value = newUser;

    if (newUser) {
      try {
        if (options.preserveEffectiveLocale) {
          await applySavedUserLocale(newUser.locale, {
            preferEffectiveCookie: true,
          });
        } else {
          await applySavedUserLocale(newUser.locale);
        }
      } catch (error) {
        // Authentication must remain usable if a lazy locale chunk fails to
        // load. Callers still await the attempt so normal login transitions do
        // not render or toast in the previous account's language.
        console.error("Failed to apply the saved user locale:", error);
      }
    }
  };

  const withLoading = async <T>(operation: () => Promise<T>): Promise<T> => {
    isLoading.value = true;
    try {
      return await operation();
    } finally {
      isLoading.value = false;
    }
  };

  const checkUserStatus = async (email: string) => {
    const response = await authService.checkUserStatus(email);
    return response.data;
  };

  const login = (credentials: { email: string; password: string }) =>
    withLoading(async () => {
      const isCurrent = captureContext(false);
      const response = await authService.login(credentials);
      requireCurrentContext(isCurrent);

      if (response.data.two_factor_required) {
        return response.data;
      }

      setTokens(response.data.access_token!, response.data.refresh_token!);
      await setUser(response.data.user ?? null);
      isInitialized.value = true;

      return response.data;
    });

  const register = (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) =>
    withLoading(async () => {
      const isCurrent = captureContext(false);
      const response = await authService.register(data);
      requireCurrentContext(isCurrent);
      setTokens(response.data.access_token!, response.data.refresh_token!);
      await setUser(response.data.user ?? null);
      isInitialized.value = true;

      return response.data;
    });

  const logout = async () => {
    const isCurrent = captureContext(false);
    try {
      if (getAccessToken()) {
        await authService.logout().catch(() => {});
      }
    } finally {
      if (isCurrent()) {
        clearTokens();
        await setUser(null);
        navigateTo("/login");
      }
    }
  };

  const fetchUser = async (options: UserLocaleSyncOptions = {}) => {
    if (!getAccessToken()) return null;
    const isCurrent = captureContext();

    return withLoading(async () => {
      try {
        const response = await authService.getUser();
        if (!isCurrent()) return null;
        await setUser(response.data, options);
        return response.data;
      } catch {
        if (!isCurrent()) return null;
        clearTokens();
        await setUser(null);
        return null;
      }
    });
  };

  const updateProfile = (data: {
    name?: string;
    email?: string;
    timezone?: string;
  }) =>
    withLoading(async () => {
      const isCurrent = captureContext();
      const response = await authService.updateProfile(data);
      requireCurrentContext(isCurrent);
      await setUser(response.data);
      return response.data;
    });

  const updateLocale = (locale: LocalePreference) =>
    withLoading(async () => {
      const isCurrent = captureContext();
      const response = await authService.updateLocale(locale);
      requireCurrentContext(isCurrent);
      await setUser(response.data);
      return response.data;
    });

  const updatePassword = (data: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) =>
    withLoading(async () => {
      await authService.updatePassword(data);
    });

  const forgotPassword = (email: string) =>
    withLoading(async () => {
      await authService.forgotPassword(email);
    });

  const resetPassword = (data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) =>
    withLoading(async () => {
      await authService.resetPassword(data);
    });

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    isInitialized,

    initAuth,
    waitForAuth,
    setUser,
    checkUserStatus,
    login,
    register,
    logout,
    fetchUser,
    updateProfile,
    updateLocale,
    updatePassword,
    forgotPassword,
    resetPassword,
  };
};

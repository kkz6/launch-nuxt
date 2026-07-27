import type { User } from "~/types";
import { authService } from "~/services/authService";

let authInitPromise: Promise<void> | null = null;

export const useAuth = () => {
  const { setTokens, clearTokens, getAccessToken, setCurrentTeamId } = useApi();

  const user = useState<User | null>("auth_user", () => null);
  const isLoading = useState("auth_loading", () => false);
  const isInitialized = useState("auth_initialized", () => false);

  const isAuthenticated = computed(() => !!getAccessToken() && !!user.value);
  const token = computed(() => getAccessToken());

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
          await fetchUser();
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

  const setUser = (newUser: User | null) => {
    user.value = newUser;
    if (newUser?.current_team_id) {
      setCurrentTeamId(newUser.current_team_id);
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
      const response = await authService.login(credentials);

      if (response.data.two_factor_required) {
        return response.data;
      }

      setTokens(response.data.access_token!, response.data.refresh_token!);
      setUser(response.data.user ?? null);
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
      const response = await authService.register(data);
      setTokens(response.data.access_token!, response.data.refresh_token!);
      setUser(response.data.user ?? null);
      isInitialized.value = true;

      return response.data;
    });

  const logout = async () => {
    try {
      if (getAccessToken()) {
        await authService.logout().catch(() => {});
      }
    } finally {
      clearTokens();
      setUser(null);
      navigateTo("/login");
    }
  };

  const fetchUser = async () => {
    if (!getAccessToken()) return null;

    return withLoading(async () => {
      try {
        const response = await authService.getUser();
        setUser(response.data);
        return response.data;
      } catch {
        clearTokens();
        setUser(null);
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
      const response = await authService.updateProfile(data);
      setUser(response.data);
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
    updatePassword,
    forgotPassword,
    resetPassword,
  };
};

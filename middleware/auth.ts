export default defineNuxtRouteMiddleware(async () => {
  const { waitForAuth, isAuthenticated, user } = useAuth();
  const { getAccessToken } = useApi();

  // Wait for auth to be initialized (handles the race condition)
  await waitForAuth();

  const token = getAccessToken();

  // If no token, redirect to login
  if (!token) {
    return navigateTo("/login");
  }

  // Check if authenticated (has token AND user data)
  if (!isAuthenticated.value || !user.value) {
    return navigateTo("/login");
  }
});

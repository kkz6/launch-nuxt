export default defineNuxtRouteMiddleware(async (to) => {
  // Skip auth check on server - we can't access localStorage there
  // The client-side check will handle the redirect if needed
  if (import.meta.server) {
    return;
  }

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

  // Check subscription status - redirect non-subscribed users to dashboard
  // Allow /settings/billing for payment return redirects
  const isSubscribed = user.value?.current_team?.is_subscribed ?? true;
  const allowedPaths = ['/dashboard', '/settings/billing'];

  if (!isSubscribed && !allowedPaths.includes(to.path)) {
    return navigateTo('/dashboard');
  }
});

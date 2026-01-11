export default defineNuxtRouteMiddleware(async () => {
  // Skip on server - we can't access localStorage there
  if (import.meta.server) {
    return;
  }

  const { waitForAuth, isAuthenticated } = useAuth();

  // Wait for auth to be initialized
  await waitForAuth();

  // If authenticated, redirect to dashboard
  if (isAuthenticated.value) {
    return navigateTo("/dashboard");
  }
});

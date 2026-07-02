export default defineNuxtRouteMiddleware(async () => {
  const { getAccessToken } = useApi();

  // Mirror of the auth middleware: the token is in the `auth_token` cookie
  // (SSR-readable), so send already-authenticated users to /dashboard on the
  // server. A client-only redirect here would hydrate the dashboard's
  // `default` layout against the SSR'd /login `guest` layout — the same
  // hydration mismatch, in the other direction.
  if (!getAccessToken()) {
    return;
  }

  if (import.meta.server) {
    return navigateTo("/dashboard");
  }

  const { waitForAuth, isAuthenticated } = useAuth();

  // Wait for auth to be initialized
  await waitForAuth();

  // If authenticated, redirect to dashboard
  if (isAuthenticated.value) {
    return navigateTo("/dashboard");
  }
});

export default defineNuxtRouteMiddleware(async () => {
  // Mirror of the auth middleware: read the token cookie directly (useCookie
  // works during SSR; useApi().getAccessToken() returns null on the server).
  // Send already-authenticated users to /dashboard on the server so we don't
  // hydrate the dashboard's `default` layout against the SSR'd /login `guest`
  // layout — the same hydration mismatch, in the other direction.
  if (!useCookie("auth_token").value) {
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

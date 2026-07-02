export default defineNuxtRouteMiddleware(async (to) => {
  const { getAccessToken } = useApi();

  // The access token lives in the `auth_token` cookie, which IS readable
  // during SSR (via useCookie) — so the token check runs on the server too.
  //
  // This matters for the layout: if we only checked on the client, the server
  // would SSR the protected page in its `default` layout, then the client
  // would redirect to /login and hydrate the `guest` layout against that
  // server-rendered `default`-layout DOM — a hydration mismatch that leaves
  // the login page unstyled/uncentered in production. Redirecting on the
  // server means /login is SSR'd with its own layout from the start.
  const token = getAccessToken();
  if (!token) {
    return navigateTo("/login");
  }

  // Everything below needs the fetched user profile, which is only available
  // on the client, so stop here during SSR (the token is present).
  if (import.meta.server) {
    return;
  }

  const { waitForAuth, isAuthenticated, user } = useAuth();

  // Wait for auth to be initialized (handles the race condition)
  await waitForAuth();

  // Check if authenticated (has token AND user data)
  if (!isAuthenticated.value || !user.value) {
    return navigateTo("/login");
  }

  // Check subscription status - redirect non-subscribed users to dashboard
  // Allow /settings/billing for payment return redirects
  const isSubscribed = user.value?.current_team?.is_subscribed ?? true;
  const allowedPaths = ["/dashboard", "/settings/billing"];

  if (!isSubscribed && !allowedPaths.includes(to.path)) {
    return navigateTo("/dashboard");
  }
});

export default defineNuxtRouteMiddleware(async () => {
  const login = { path: "/login", query: { redirect: "/cli/auth" } };
  if (!useCookie("auth_token").value) {
    return navigateTo(login);
  }
  if (import.meta.server) return;

  const { waitForAuth, isAuthenticated } = useAuth();
  await waitForAuth();
  if (!isAuthenticated.value) {
    return navigateTo(login);
  }
});

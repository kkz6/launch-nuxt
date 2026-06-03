export default defineNuxtRouteMiddleware(async () => {
  // Skip on server - auth state lives in client-side cookies.
  // The backend is the real gate; this is a UX guard.
  if (import.meta.server) {
    return;
  }

  const { waitForAuth, user } = useAuth();

  await waitForAuth();

  const role = user.value?.staff_role;

  if (role !== "support" && role !== "super_admin") {
    return navigateTo("/dashboard");
  }
});

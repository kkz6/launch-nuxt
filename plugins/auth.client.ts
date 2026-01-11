export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth();

  // Initialize auth - this fetches user data if token exists
  await initAuth();
});

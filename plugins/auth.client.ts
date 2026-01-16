export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth();
  const { connect } = useWebSocket();

  // Initialize auth - this fetches user data if token exists
  await initAuth();

  // Initialize WebSocket connection after auth is ready
  connect();
});

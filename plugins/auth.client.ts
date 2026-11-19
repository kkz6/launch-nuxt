import { useTeamsStore } from "~/stores/useTeamsStore";

export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth();
  const { connect } = useWebSocket();
  const teams = useTeamsStore();

  // Preload once per login, independently of the dropdown's mount lifecycle.
  // A failed preload remains retryable when the user opens the team menu.
  watch(
    () => teams.contextVersion,
    () => {
      void teams.loadTeams().catch(() => {});
    },
    { immediate: true },
  );

  // Initialize auth - this fetches user data if token exists
  await initAuth();

  // Initialize WebSocket connection after auth is ready
  connect();
});

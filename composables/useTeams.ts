import { watch } from "vue";
import type { Team } from "~/types";

export const useTeams = () => {
  const { user } = useAuth();
  const teams = useState<Team[]>("teams.data", () => []);
  const loaded = useState("teams.loaded", () => false);
  const loading = useState("teams.loading", () => false);
  const loadedForUser = useState<string | null>("teams.user", () => null);
  const requestVersion = useState("teams.request", () => 0);

  watch(
    () => user.value?.id ? String(user.value.id) : null,
    (userId) => {
      if (loadedForUser.value === userId) return;
      requestVersion.value++;
      teams.value = [];
      loaded.value = false;
      loading.value = false;
      loadedForUser.value = userId;
    },
    { immediate: true, flush: "sync" },
  );

  const loadTeams = async (force = false) => {
    const userId = user.value?.id ? String(user.value.id) : null;
    if (!userId) return [];
    const hasCurrentUserData = loaded.value && loadedForUser.value === userId;
    if ((hasCurrentUserData && !force) || loading.value) return teams.value;

    loading.value = true;
    const version = ++requestVersion.value;
    const isCurrent = () =>
      version === requestVersion.value &&
      userId === (user.value?.id ? String(user.value.id) : null);
    try {
      const response = await $api<{ data: Team[] }>("/teams");
      if (!isCurrent()) return [];
      teams.value = response.data;
      loaded.value = true;
      loadedForUser.value = userId;
      return teams.value;
    } catch (error) {
      if (isCurrent()) throw error;
      return [];
    } finally {
      if (isCurrent()) loading.value = false;
    }
  };

  const updateTeam = (team: Team) => {
    const index = teams.value.findIndex((item) => item.id === team.id);
    if (index === -1) teams.value.push(team);
    else teams.value[index] = team;
  };

  const removeTeam = (teamId: string) => {
    teams.value = teams.value.filter((team) => team.id !== teamId);
  };

  return { teams, loaded, loading, loadTeams, updateTeam, removeTeam };
};

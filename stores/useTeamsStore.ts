import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { Team } from "~/types";

export const useTeamsStore = defineStore("teams", () => {
  const { user } = useAuth();
  const { getAccessToken } = useApi();
  const sessionVersion = useState("auth_session_version", () => 0);
  const impersonationVersion = useState("auth_token_version", () => 0);
  const teams = ref<Team[]>([]);
  const loaded = ref(false);
  const loading = ref(false);
  const contextVersion = ref(0);
  // Keep promises and pending edits in this app's store, outside serialized state.
  let pending: Promise<Team[]> | null = null;
  let pendingEdits: Map<string, Team | null> | null = null;

  watch(
    [() => user.value?.id, sessionVersion, impersonationVersion],
    () => {
      contextVersion.value++;
      teams.value = [];
      loaded.value = false;
      loading.value = false;
      pending = null;
      pendingEdits = null;
    },
    { flush: "sync" },
  );

  const loadTeams = (force = false): Promise<Team[]> => {
    if (!user.value?.id || !getAccessToken()) return Promise.resolve([]);
    if (pending) return pending;
    if (loaded.value && !force) return Promise.resolve(teams.value);

    const version = contextVersion.value;
    const edits = new Map<string, Team | null>();
    pendingEdits = edits;
    loading.value = true;
    pending = Promise.resolve().then(async () => {
      // Logout can happen before the request starts or while it is in flight.
      if (version !== contextVersion.value) return [];
      try {
        const response = await $api<{ data: Team[] }>("/teams");
        if (version !== contextVersion.value) return [];
        const result = new Map(response.data.map((team) => [team.id, team]));
        for (const [id, team] of edits) {
          if (team) result.set(id, team);
          else result.delete(id);
        }
        teams.value = [...result.values()];
        loaded.value = true;
        return teams.value;
      } catch (error) {
        if (version === contextVersion.value) throw error;
        return [];
      } finally {
        if (version === contextVersion.value) {
          pending = null;
          pendingEdits = null;
          loading.value = false;
        }
      }
    });
    return pending;
  };

  const updateTeam = (team: Team) => {
    if (!user.value) return;
    pendingEdits?.set(team.id, team);
    const index = teams.value.findIndex((item) => item.id === team.id);
    if (index === -1) teams.value.push(team);
    else teams.value[index] = team;
  };

  const removeTeam = (teamId: string) => {
    pendingEdits?.set(teamId, null);
    teams.value = teams.value.filter((team) => team.id !== teamId);
  };

  return {
    teams,
    loaded,
    loading,
    contextVersion,
    loadTeams,
    updateTeam,
    removeTeam,
  };
});

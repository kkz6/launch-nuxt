import { storeToRefs } from "pinia";
import { useTeamsStore } from "~/stores/useTeamsStore";

export const useTeams = () => {
  const store = useTeamsStore();
  const { teams, loaded, loading } = storeToRefs(store);
  return {
    teams,
    loaded,
    loading,
    loadTeams: store.loadTeams,
    updateTeam: store.updateTeam,
    removeTeam: store.removeTeam,
  };
};

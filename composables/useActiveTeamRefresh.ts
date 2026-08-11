export const useActiveTeamRefresh = () => {
  const { reconnect } = useWebSocket();

  const refreshActiveTeam = () => {
    reconnect();
    useState("serversRefreshKey", () => 0).value++;
    useState("dashboardRefreshKey", () => 0).value++;
    useState("scriptsRefreshKey", () => 0).value++;
    useState("dnsRefreshKey", () => 0).value++;
  };

  return { refreshActiveTeam };
};

export default defineEventHandler(async (event) => {
  const invitationId = getRouterParam(event, "invitationId");
  const { backendBase } = useRuntimeConfig();
  const query = getRequestURL(event).search;
  const target = `${backendBase.replace(/\/$/, "")}/auth/team-invitations/${invitationId}/accept${query}`;

  return proxyRequest(event, target);
});

export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, "path");
  const { backendBase } = useRuntimeConfig();

  const query = getRequestURL(event).search;
  const target = `${backendBase.replace(/\/$/, "")}/deploy/${path}${query}`;

  return proxyRequest(event, target);
});

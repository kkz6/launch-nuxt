export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, "path");
  const { backendBase } = useRuntimeConfig();

  const target = `${backendBase}/deploy/${path}`;

  return proxyRequest(event, target);
});

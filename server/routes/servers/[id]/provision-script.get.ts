export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const { backendBase } = useRuntimeConfig();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const target = `${backendBase}/servers/${id}/provision-script?${params.toString()}`;

  return proxyRequest(event, target);
});

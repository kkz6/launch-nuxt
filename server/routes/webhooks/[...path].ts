export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, "path");
  const query = getQuery(event);
  const { backendBase } = useRuntimeConfig();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const qs = params.toString();
  const target = `${backendBase}/webhooks/${path}${qs ? `?${qs}` : ""}`;

  return proxyRequest(event, target);
});

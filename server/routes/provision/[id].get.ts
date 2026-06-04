// Provision-script proxy. Users land here from the copy-paste command
// shown in the dashboard: `wget -O - 'https://launchctl.io/provision/<id>?signature=...' | bash`.
// We forward to the backend (api subdomain) preserving the signed query
// string verbatim — the signature was generated for `/provision/:id` and
// the backend's signedurl middleware verifies that same path.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);
  const { backendBase } = useRuntimeConfig();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const qs = params.toString();
  const target = `${backendBase}/provision/${id}${qs ? `?${qs}` : ""}`;

  return proxyRequest(event, target);
});

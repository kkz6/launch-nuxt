// GitHub (and other git providers) redirect here after an app install,
// e.g. /settings/git-providers/github/callback?installation_id=…&setup_action=install
//
// There is no Nuxt *page* for /settings/* (settings is a client-side
// sheet), and the bare path isn't otherwise proxied — so without this
// route the redirect 404s. Mirroring the /webhooks and /deploy proxies,
// we forward the request to the backend's callback handler, which reads
// our session cookie to resolve the team/user and records the
// installation. The backend then replies with its own redirect to
// /settings/git-providers (also not a page); we ignore that and send the
// user back into the app with the Connections settings opened instead.
export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, "provider");
  const query = getQuery(event);
  const { backendBase } = useRuntimeConfig();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  const target = `${backendBase}/settings/git-providers/${provider}/callback${
    qs ? `?${qs}` : ""
  }`;

  // The backend authenticates via the Authorization / X-Team-ID headers
  // that $api normally builds from these cookies. A plain provider
  // redirect carries only the cookies (no headers), so rebuild them here
  // — otherwise the callback 401s and the installation is never recorded.
  const authToken = getCookie(event, "auth_token");
  const teamId = getCookie(event, "current_team_id");

  try {
    await $fetch(target, {
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(teamId ? { "X-Team-ID": teamId } : {}),
      },
      redirect: "manual",
    });
  } catch {
    // The backend answers with a 3xx redirect that ofetch rejects on —
    // the installation sync has already run by the time it responds.
  }

  return sendRedirect(event, "/dashboard?settings=connections", 302);
});

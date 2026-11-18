// Identity verification never grants repositories; selection follows in settings.
export default defineEventHandler(async (event) => {
  const provider = getRouterParam(event, "provider");
  const query = getQuery(event);
  const { backendBase } = useRuntimeConfig();
  const destination = new URLSearchParams({ settings: "connections" });
  const fail = (code: string) => {
    destination.set("github_error", code);
    return sendRedirect(event, `/dashboard?${destination}`, 302);
  };
  if (provider !== "github") return fail("invalid_callback");
  if (query.error)
    return fail(
      query.error === "access_denied" ? "access_denied" : "connection_failed",
    );
  const authToken = getCookie(event, "auth_token");
  const teamId = getCookie(event, "current_team_id");
  if (!authToken || !teamId) return fail("session_required");
  if (
    typeof query.state !== "string" ||
    (!query.code && !query.installation_id)
  )
    return fail("invalid_callback");
  const params = new URLSearchParams();
  for (const key of ["state", "code", "installation_id", "setup_action"]) {
    if (typeof query[key] === "string") params.set(key, query[key]);
  }
  const locale = getCookie(event, "locale");
  const language =
    locale === "en" || locale === "ja"
      ? locale
      : getHeader(event, "accept-language");
  try {
    const response = await $fetch<{
      success: boolean;
      data: { attempt_id: string; status: string; team_id: string };
    }>(
      `${backendBase.replace(/\/$/, "")}/settings/git-providers/github/callback?${params}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Team-ID": teamId,
          ...(language ? { "Accept-Language": language } : {}),
        },
        redirect: "manual",
      },
    );
    if (
      !response.success ||
      !response.data?.attempt_id ||
      response.data.status !== "authorized" ||
      String(response.data.team_id) !== teamId
    )
      return fail("connection_failed");
    destination.set("github_attempt", response.data.attempt_id);
    return sendRedirect(event, `/dashboard?${destination}`, 302);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    return fail(status === 401 ? "session_required" : "connection_failed");
  }
});

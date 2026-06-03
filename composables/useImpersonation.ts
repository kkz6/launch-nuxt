import { adminService } from "~/services/adminService";

// Cookie holding the staff member's own access token while impersonating,
// so we can restore it (and use it for the staff-only stop call) after a
// page reload.
const IMPERSONATOR_TOKEN_KEY = "impersonator_token";

interface JwtPayload {
  sub?: string;
  impersonator_id?: string | number;
  impersonation_sid?: string;
  read_only?: boolean;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decode a JWT payload (middle segment) without verifying the signature.
 * Display-only — the backend enforces the actual claims.
 */
const decodeJwt = (token: string | null): JwtPayload | null => {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

/**
 * Manages the staff "spectate as user" (impersonation) lifecycle.
 */
export const useImpersonation = () => {
  const { getAccessToken, setTokens, setCurrentTeamId } = useApi();
  const { user, fetchUser } = useAuth();

  const impersonatorTokenCookie = () =>
    useCookie<string | null>(IMPERSONATOR_TOKEN_KEY, {
      maxAge: 60 * 60, // 1 hour (covers the 30-min impersonation window)
      secure: true,
      sameSite: "lax",
    });

  // Bumped on every token swap (start/stop). It carries no state itself — it's
  // a reactive trigger so the computed below re-evaluates live without a
  // reload. The actual impersonation state is always read fresh from the active
  // token, so it ALSO survives a hard reload (the computed re-runs client-side
  // and reads the token cookie directly; a useState flag would not, because its
  // initializer only runs on the server and the client reuses that value).
  const tokenVersion = useState<number>("auth_token_version", () => 0);

  /**
   * True while a "spectate as user" session is active. Derived from the active
   * token's impersonator_id claim (survives reload) and re-evaluated on every
   * token swap via tokenVersion (updates live, no reload needed).
   */
  const isImpersonating = computed(
    () =>
      tokenVersion.value >= 0 &&
      Boolean(decodeJwt(getAccessToken())?.impersonator_id),
  );

  // Name shown in the banner — the target (currently-loaded) user.
  const impersonatedName = computed(() => user.value?.name ?? "user");

  /**
   * Start impersonating the target user.
   */
  const start = async (targetUserId: string | number, reason?: string) => {
    const staffToken = getAccessToken();
    if (!staffToken) {
      throw new Error("No active staff session to impersonate from");
    }

    // 1. Stash the staff token so we can restore it (and use it for stop).
    impersonatorTokenCookie().value = staffToken;

    try {
      // 2. Request the impersonation token.
      const response = await adminService.impersonate(targetUserId, reason);
      const token = response.data.token;

      // 3. Make the impersonation token the active token. Wait a tick for the
      //    cookie write to flush before anything reads it back — otherwise the
      //    fetchUser below races and reads the old (staff) token.
      setTokens(token);
      await nextTick();
      tokenVersion.value++; // surface the impersonation banner immediately

      // 4. Re-fetch the user so the app shows the target's identity.
      const target = await fetchUser();

      // 5. Point the team context at the target's current team.
      if (target?.current_team_id) {
        setCurrentTeamId(target.current_team_id);
      }

      // 6. Navigate to the customer's view.
      await navigateTo("/dashboard");
    } catch (error) {
      // Roll back the stash if start failed.
      impersonatorTokenCookie().value = null;
      throw error;
    }
  };

  /**
   * Stop impersonating and return to the staff identity.
   */
  const stop = async () => {
    const staffToken = impersonatorTokenCookie().value;

    // 1. Restore the staff token FIRST so the stop call is authenticated
    //    as the staff member (the customer token would fail the staff check).
    if (staffToken) {
      setTokens(staffToken);
    }
    await nextTick(); // let the staff-token cookie write flush before reads
    tokenVersion.value++; // hide the impersonation banner immediately
    impersonatorTokenCookie().value = null;

    // 2. End the session on the backend with the staff token.
    try {
      await adminService.stopImpersonating();
    } catch {
      // Even if the stop call fails, we've already swapped back to the
      // staff token locally — don't trap the user in the customer view.
    }

    // 3. Back to the staff identity.
    await fetchUser();

    // 4. Return to the admin section.
    await navigateTo("/admin");
  };

  return {
    isImpersonating,
    impersonatedName,
    start,
    stop,
  };
};

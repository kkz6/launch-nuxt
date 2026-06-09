import type { TeamRole } from "~/types";

// useCan centralises team-role → UI gating. The backend is the
// authorization source of truth (middleware.Can(...)); this composable
// only decides what the UI shows/hides so members don't click buttons
// that then 403.
//
// Agreed mapping ("Standard"):
//   member          → read-only (view only)
//   editor          → create / update / deploy, but NOT delete
//   admin / owner   → full, including delete + team management
//
// Roles come from /auth/user (user.role). A staff member impersonating
// is intentionally NOT special-cased here — impersonation is read-only
// and enforced server-side, so the UI should reflect the impersonated
// user's actual team role.

const ROLE_RANK: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  member: 1,
};

export const useCan = () => {
  const { user } = useAuth();

  // Raw role of the caller in their current team, or undefined when the
  // backend hasn't provided it (e.g. older API, or the role response not
  // yet rolled out).
  const role = computed<TeamRole | undefined>(() => user.value?.role);

  // Fail OPEN when the role is unknown. The gate is purely cosmetic — the
  // backend always enforces permissions via middleware.Can(...) — so an
  // absent role degrades to today's behaviour (all buttons visible, writes
  // still 403 for members) rather than locking admins/owners out of the UI
  // during a frontend-ahead-of-backend deploy window. Once the role is
  // present, gating applies normally.
  const atLeast = (min: TeamRole) => {
    if (!role.value) {
      return true;
    }
    return (ROLE_RANK[role.value] ?? 0) >= (ROLE_RANK[min] ?? 0);
  };

  // Convenience flags keyed to the agreed mapping.
  const canEdit = computed(() => atLeast("editor")); // create / update / deploy
  const canDelete = computed(() => atLeast("admin")); // destructive actions
  const canManageTeam = computed(() => atLeast("admin")); // members / invites / settings
  const isOwner = computed(() => role.value === "owner");
  const isReadOnly = computed(() => !canEdit.value); // members only

  return {
    role,
    atLeast,
    canEdit,
    canDelete,
    canManageTeam,
    isOwner,
    isReadOnly,
  };
};

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
// Roles come from /auth/user. Spectate sessions remain read-only even when
// the target user owns the team. Unknown roles hide write actions until loaded.

const ROLE_RANK: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  member: 1,
};

export const useCan = () => {
  const { user } = useAuth();
  const { isImpersonating } = useImpersonation();

  // Raw role of the caller in their current team, or undefined when the
  // backend hasn't provided it (e.g. older API, or the role response not
  // yet rolled out).
  const role = computed<TeamRole | undefined>(() => user.value?.role);

  // This controls presentation only; the API still authorizes every request.
  const atLeast = (min: TeamRole) => {
    if (isImpersonating.value || !role.value) return false;
    return (ROLE_RANK[role.value] ?? 0) >= (ROLE_RANK[min] ?? 0);
  };

  // Convenience flags keyed to the agreed mapping.
  const canEdit = computed(() => atLeast("editor")); // create / update / deploy
  const canDelete = computed(() => atLeast("admin")); // destructive actions
  const canManageTeam = computed(() => atLeast("admin")); // members / invites / settings
  const isOwner = computed(() => role.value === "owner");
  const isReadOnly = computed(() => !canEdit.value); // members, unresolved roles, and Spectate

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

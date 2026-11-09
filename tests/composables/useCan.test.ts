import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCan } from "../../composables/useCan";

const user = ref<{
  id?: string;
  current_team_id?: string;
  role?: string;
} | null>(null);
const isImpersonating = ref(false);

beforeEach(() => {
  user.value = null;
  isImpersonating.value = false;
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useImpersonation", () => ({ isImpersonating }));
});
afterEach(() => vi.unstubAllGlobals());

describe("team permissions", () => {
  it.each([null, {}, { role: "unknown" }, { role: "" }])(
    "hides write actions while the current role is unavailable: %j",
    (value) => {
      user.value = value;
      const access = useCan();
      expect(access.canEdit.value).toBe(false);
      expect(access.canDelete.value).toBe(false);
      expect(access.canManageTeam.value).toBe(false);
      expect(access.isReadOnly.value).toBe(true);
    },
  );

  it.each([
    ["member", false, false],
    ["editor", true, false],
    ["admin", true, true],
    ["owner", true, true],
  ])("maps %s to the API's minimum role policy", (role, edit, manage) => {
    user.value = { role };
    const access = useCan();
    expect(access.canEdit.value).toBe(edit);
    expect(access.canDelete.value).toBe(manage);
    expect(access.canManageTeam.value).toBe(manage);
  });

  it("recalculates rights when switching teams and accounts", () => {
    user.value = { id: "alice", current_team_id: "owned", role: "owner" };
    const access = useCan();
    expect(access.canDelete.value).toBe(true);

    user.value = { id: "alice", current_team_id: "client", role: "member" };
    expect(access.canEdit.value).toBe(false);
    expect(access.canDelete.value).toBe(false);

    user.value = { id: "alice", current_team_id: "pending" };
    expect(access.canEdit.value).toBe(false);
    user.value = { id: "bob", current_team_id: "client", role: "editor" };
    expect(access.canEdit.value).toBe(true);
    expect(access.canDelete.value).toBe(false);
    user.value = null;
    expect(access.canEdit.value).toBe(false);
  });

  it("keeps Spectate read-only even when the target owns the team", () => {
    user.value = { role: "owner" };
    const access = useCan();
    isImpersonating.value = true;
    expect(access.canEdit.value).toBe(false);
    expect(access.canDelete.value).toBe(false);
    expect(access.canManageTeam.value).toBe(false);
    expect(access.isReadOnly.value).toBe(true);
    isImpersonating.value = false;
    expect(access.canEdit.value).toBe(true);
  });
});

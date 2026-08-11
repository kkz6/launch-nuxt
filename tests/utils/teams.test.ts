import { describe, expect, it } from "vitest";
import type { Team } from "../../types";
import { duplicateTeamNames, teamQualifier } from "../../utils/teams";

const team = (overrides: Partial<Team>): Team =>
  ({
    id: "01TEAM000001",
    user_id: "owner",
    name: "Launch",
    image_path: null,
    image_url: "",
    personal_team: false,
    is_subscribed: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  }) as Team;

describe("team identity helpers", () => {
  it("finds duplicate names without case or whitespace ambiguity", () => {
    const duplicates = duplicateTeamNames([
      team({ id: "1", name: "Launch" }),
      team({ id: "2", name: " launch " }),
      team({ id: "3", name: "Another" }),
    ]);
    expect([...duplicates]).toEqual(["launch"]);
  });

  it("labels personal, owned, and joined teams", () => {
    const duplicates = new Set<string>();
    expect(
      teamQualifier(team({ personal_team: true }), "owner", duplicates),
    ).toBe("Personal");
    expect(teamQualifier(team({ is_owner: true }), "someone", duplicates)).toBe(
      "Owned",
    );
    expect(teamQualifier(team({ user_id: "owner" }), "owner", duplicates)).toBe(
      "Owned",
    );
    expect(teamQualifier(team({ user_id: "other" }), "owner", duplicates)).toBe(
      "Joined",
    );
  });

  it("adds a stable code when names repeat", () => {
    const item = team({ id: "01ABCDEF123456", name: "Launch" });
    expect(teamQualifier(item, "owner", new Set(["launch"]))).toBe(
      "Owned · 123456",
    );
  });
});

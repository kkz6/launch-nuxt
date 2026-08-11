import type { Team } from "~/types";

export const duplicateTeamNames = (teams: Team[]) => {
  const counts = new Map<string, number>();
  for (const team of teams) {
    const name = team.name.trim().toLocaleLowerCase();
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );
};

export const teamQualifier = (
  team: Team,
  userId: string | undefined,
  duplicateNames: Set<string>,
) => {
  const ownership = team.personal_team
    ? "Personal"
    : team.is_owner || team.user_id === userId
      ? "Owned"
      : "Joined";
  const duplicate = duplicateNames.has(team.name.trim().toLocaleLowerCase());
  return duplicate ? `${ownership} · ${team.id.slice(-6)}` : ownership;
};

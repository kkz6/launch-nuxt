import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTeams } from "../../composables/useTeams";

const api = vi.fn();
const states = new Map<string, ReturnType<typeof ref>>();
const activeUser = ref({ id: "user-one" });
const firstTeam = { id: "one", name: "One" };
const secondTeam = { id: "two", name: "Two" };

describe("useTeams", () => {
  beforeEach(() => {
    states.clear();
    api.mockReset().mockResolvedValue({ data: [firstTeam] });
    vi.stubGlobal("$api", api);
    vi.stubGlobal("useAuth", () => ({ user: activeUser }));
    vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reuses the loaded team list until a forced refresh", async () => {
    activeUser.value = { id: "user-one" };
    const first = useTeams();
    await first.loadTeams();
    await useTeams().loadTeams();
    expect(api).toHaveBeenCalledTimes(1);

    await first.loadTeams(true);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("reloads the team list when the signed-in user changes", async () => {
    activeUser.value = { id: "user-one" };
    const store = useTeams();
    await store.loadTeams();
    activeUser.value = { id: "user-two" };
    await store.loadTeams();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("updates and removes cached teams", async () => {
    const store = useTeams();
    await store.loadTeams();
    store.updateTeam({ ...firstTeam, name: "Renamed" } as never);
    store.updateTeam(secondTeam as never);
    store.removeTeam("one");
    expect(store.teams.value).toEqual([secondTeam]);
  });
});

import { effectScope, ref } from "vue";
import { createPinia, disposePinia, setActivePinia, type Pinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTeams } from "../../composables/useTeams";

const api = vi.fn();
const states = new Map<string, ReturnType<typeof ref>>();
const activeUser = ref<{ id: string; current_team_id?: string }>({ id: "user-one" });
const firstTeam = { id: "one", name: "One" };
const secondTeam = { id: "two", name: "Two" };
let pinia: Pinia;

describe("useTeams", () => {
  beforeEach(() => {
    states.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    api.mockReset().mockResolvedValue({ data: [firstTeam] });
    vi.stubGlobal("$api", api);
    vi.stubGlobal("useAuth", () => ({ user: activeUser }));
    vi.stubGlobal("useApi", () => ({ getAccessToken: () => "access-token" }));
    vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(() => { disposePinia(pinia); vi.unstubAllGlobals(); });

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

  it("retains the list when the menu unmounts and remounts", async () => {
    const menu = effectScope();
    const first = menu.run(() => useTeams())!;
    await first.loadTeams();
    menu.stop();
    const reopenedMenu = effectScope();
    await reopenedMenu.run(() => useTeams())!.loadTeams();
    reopenedMenu.stop();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("waits for one shared request across concurrent consumers", async () => {
    let finish!: (value: unknown) => void;
    api.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = useTeams();
    const pending = first.loadTeams();
    const second = useTeams().loadTeams();
    await Promise.resolve();
    expect(api).toHaveBeenCalledTimes(1);
    finish({ data: [firstTeam] });
    expect(await pending).toEqual([firstTeam]);
    expect(await second).toEqual([firstTeam]);
  });

  it("caches a successful empty list and retries a failed request", async () => {
    api.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue({ data: [] });
    const store = useTeams();
    await expect(store.loadTeams()).rejects.toThrow("Unavailable");
    expect(store.loading.value).toBe(false);
    expect(store.loaded.value).toBe(false);
    await store.loadTeams();
    await useTeams().loadTeams();
    expect(store.loaded.value).toBe(true);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("keeps cached teams when the same user's profile or active team changes", async () => {
    const store = useTeams();
    await store.loadTeams();
    activeUser.value = { ...activeUser.value };
    await store.loadTeams();
    activeUser.value = { ...activeUser.value, current_team_id: "other-team" };
    await store.loadTeams();
    expect(api).toHaveBeenCalledTimes(1);
    expect(store.teams.value).toEqual([firstTeam]);
  });

  it("preserves create, rename and removal changes made during a refresh", async () => {
    const store = useTeams();
    await store.loadTeams();
    let finish!: (value: unknown) => void;
    api.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const refresh = store.loadTeams(true);
    await Promise.resolve();
    store.updateTeam({ ...firstTeam, name: "Renamed" } as never);
    store.updateTeam({ id: "new", name: "Created" } as never);
    store.removeTeam("two");
    finish({ data: [firstTeam, secondTeam] });
    await refresh;
    expect(store.teams.value).toEqual([{ ...firstTeam, name: "Renamed" }, { id: "new", name: "Created" }]);
  });
});

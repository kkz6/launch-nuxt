import { effectScope, ref, type EffectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTeams } from "../../composables/useTeams";
const user = ref<{ id: string } | null>({ id: "A" });
const api = vi.fn();
const scopes: EffectScope[] = [];
const team = (id: string) => ({ id: `private-${id}`, name: `Account ${id}`, user_id: id });
const create = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useTeams())!;
};
beforeEach(() => {
  user.value = { id: "A" };
  api.mockReset();
  const states = new Map<string, ReturnType<typeof ref>>();
  vi.stubGlobal("$api", api);
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(factory()));
    return states.get(key);
  });
});
afterEach(() => { scopes.splice(0).forEach((scope) => scope.stop()); vi.unstubAllGlobals(); });

describe("team cache account isolation", () => {
  it("clears cached account A teams synchronously on account change and logout", async () => {
    api.mockResolvedValue({ data: [team("A")] });
    const state = create();
    await state.loadTeams();
    expect(state.teams.value).toEqual([team("A")]);
    user.value = { id: "B" };
    expect(state.teams.value).toEqual([]);
    api.mockResolvedValue({ data: [team("B")] });
    await state.loadTeams();
    expect(state.teams.value).toEqual([team("B")]);
    user.value = null;
    expect(state.teams.value).toEqual([]);
    await state.loadTeams();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("lets B load while A is pending and discards A's late result", async () => {
    let finishA!: (value: unknown) => void;
    let finishB!: (value: unknown) => void;
    api.mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishB = resolve; }));
    const state = create();
    const loadingA = state.loadTeams();
    user.value = { id: "B" };
    const loadingB = state.loadTeams();
    expect(api).toHaveBeenCalledTimes(2);
    finishA({ data: [team("A")] });
    await loadingA;
    expect(state.teams.value).toEqual([]);
    expect(state.loading.value).toBe(true);
    finishB({ data: [team("B")] });
    await loadingB;
    expect(state.teams.value).toEqual([team("B")]);
    expect(state.loading.value).toBe(false);
  });
});

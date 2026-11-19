import { effectScope, ref, type EffectScope } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTeams } from "../../composables/useTeams";
import { createPinia, disposePinia, setActivePinia, type Pinia } from "pinia";
const user = ref<{ id: string } | null>({ id: "A" });
const api = vi.fn();
const scopes: EffectScope[] = [];
let pinia: Pinia;
let states: Map<string, ReturnType<typeof ref>>;
const team = (id: string) => ({ id: `private-${id}`, name: `Account ${id}`, user_id: id });
const create = () => {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useTeams())!;
};
beforeEach(() => {
  user.value = { id: "A" };
  api.mockReset();
  states = new Map<string, ReturnType<typeof ref>>();
  pinia = createPinia();
  setActivePinia(pinia);
  vi.stubGlobal("$api", api);
  vi.stubGlobal("useAuth", () => ({ user }));
  vi.stubGlobal("useApi", () => ({ getAccessToken: () => "access-token" }));
  vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(factory()));
    return states.get(key);
  });
});
afterEach(() => { scopes.splice(0).forEach((scope) => scope.stop()); disposePinia(pinia); vi.unstubAllGlobals(); });

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
    await Promise.resolve();
    user.value = { id: "B" };
    const loadingB = state.loadTeams();
    await Promise.resolve();
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

  it("clears on logout with no menu mounted and reloads for the same user", async () => {
    api.mockResolvedValue({ data: [team("A")] });
    const state = create();
    await state.loadTeams();
    scopes.forEach((scope) => scope.stop());
    user.value = null;
    expect(state.teams.value).toEqual([]);
    user.value = { id: "A" };
    await create().loadTeams();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it.each(["auth_session_version", "auth_token_version"])("invalidates old session responses when %s changes", async (key) => {
    let finish!: (value: unknown) => void;
    api.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const state = create();
    const oldRequest = state.loadTeams();
    await Promise.resolve();
    const version = states.get(key)!;
    version.value = Number(version.value) + 1;
    api.mockResolvedValue({ data: [team("new-session")] });
    await state.loadTeams();
    finish({ data: [team("old-session")] });
    await oldRequest;
    expect(state.teams.value).toEqual([team("new-session")]);
    expect(state.loading.value).toBe(false);
  });

  it("does not load teams when token expiry clears authentication before user state", async () => {
    vi.stubGlobal("useApi", () => ({ getAccessToken: () => null }));
    await create().loadTeams();
    expect(api).not.toHaveBeenCalled();
  });
});

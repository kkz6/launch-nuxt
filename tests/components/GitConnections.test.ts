import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GitConnections from "../../components/settings/GitConnections.vue";
import { createI18nStub } from "../helpers/i18n";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  start: vi.fn(),
  attempt: vi.fn(),
  candidates: vi.fn(),
  select: vi.fn(),
  disconnect: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("~/services/sourceControlService", () => ({
  sourceControlService: { list: mocks.list },
}));
vi.mock("~/services/githubConnectionService", () => ({
  githubConnectionService: mocks,
}));
vi.mock("vue-sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const user = ref({
  id: "user-A",
  current_team_id: "team-A",
  current_team: { name: "Private A" },
});
const team = ref("team-A");
const canManage = ref(true);
const route = reactive<{ query: Record<string, string> }>({ query: {} });
const wrappers: VueWrapper[] = [];
const repo = (id: string, selected = false) => ({
  github_repository_id: id,
  full_name: `org/repo-${id}`,
  name: `repo-${id}`,
  private: true,
  default_branch: "main",
  selected,
});
const attempt = (id = "attempt-A", teamId = "team-A") => ({
  data: {
    attempt_id: id,
    team_id: teamId,
    status: "authorized",
    connection_generation: 3,
    selection_version: 4,
    installations: [{ id: "shared-installation", account_login: "org" }],
  },
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const dialog = defineComponent({
  props: ["open"],
  template: '<div v-if="open"><slot /></div>',
});
const confirmation = defineComponent({
  setup(_, { expose }) {
    expose({ show: mocks.confirm });
  },
  template: "<div />",
});
const render = () => {
  const wrapper = shallowMount(GitConnections, {
    global: {
      renderStubDefaultSlot: true,
      stubs: {
        Icon: true,
        Button: { template: "<button><slot /></button>" },
        Dialog: dialog,
        SharedConfirmationDialog: confirmation,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
};
const button = (wrapper: VueWrapper, text: string) => {
  const found = wrapper.findAll("button").find((item) => item.text() === text);
  if (!found) throw new Error(`No button: ${text}`);
  return found;
};
beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  user.value = {
    id: "user-A",
    current_team_id: "team-A",
    current_team: { name: "Private A" },
  };
  team.value = "team-A";
  canManage.value = true;
  route.query = {};
  mocks.list.mockResolvedValue({ data: [] });
  mocks.attempt.mockResolvedValue(attempt());
  mocks.candidates.mockResolvedValue({
    data: { repositories: [repo("1"), repo("2")] },
  });
  mocks.select.mockResolvedValue({ data: { id: "connection-A" } });
  mocks.confirm.mockResolvedValue({ ok: true });
  vi.stubGlobal("useState", () => user);
  vi.stubGlobal("useCookie", () => team);
  vi.stubGlobal("useI18n", createI18nStub);
  vi.stubGlobal("useCan", () => ({ canManageTeam: canManage }));
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useRouter", () => ({
    replace: vi.fn(({ query }) => {
      route.query = query;
    }),
  }));
  vi.stubGlobal("navigateTo", vi.fn());
});
afterEach(() => {
  wrappers.splice(0).forEach((item) => item.unmount());
  vi.unstubAllGlobals();
});

describe("workspace GitHub selection", () => {
  it("starts a new connection with zero selected and saves only explicitly checked repository IDs", async () => {
    route.query = { github_attempt: "attempt-A" };
    const wrapper = render();
    await flushPromises();
    expect(wrapper.text()).toContain("Repositories for Private A");
    const choices = wrapper.findAll('input[type="checkbox"]');
    expect(choices).toHaveLength(2);
    expect(
      choices.every((item) => !(item.element as HTMLInputElement).checked),
    ).toBe(true);
    await choices[1]!.setValue(true);
    await button(wrapper, "Save repository selection").trigger("click");
    await flushPromises();
    expect(mocks.select).toHaveBeenCalledWith(
      "attempt-A",
      "shared-installation",
      ["2"],
      3,
      4,
      expect.any(AbortSignal),
    );
  });
  it("preserves reviewed selections across reconnect and search without inheriting other installation repositories", async () => {
    route.query = { github_attempt: "attempt-A" };
    mocks.candidates.mockResolvedValue({
      data: {
        repositories: [repo("1", true), repo("2")],
        connection_generation: 7,
      },
    });
    const wrapper = render();
    await flushPromises();
    expect(
      (wrapper.get('input[value="1"]').element as HTMLInputElement).checked,
    ).toBe(true);
    await wrapper.get('input[type="search"]').setValue("repo-2");
    await button(wrapper, "Save repository selection").trigger("click");
    await flushPromises();
    expect(mocks.select).toHaveBeenCalledWith(
      "attempt-A",
      "shared-installation",
      ["1"],
      7,
      4,
      expect.any(AbortSignal),
    );
  });
  it("confirms concrete repository removal and allows an explicitly empty selection", async () => {
    route.query = { github_attempt: "attempt-A" };
    mocks.candidates.mockResolvedValue({
      data: { repositories: [repo("1", true)] },
    });
    const wrapper = render();
    await flushPromises();
    await wrapper.get('input[value="1"]').setValue(false);
    mocks.confirm.mockResolvedValueOnce({ ok: false });
    await button(wrapper, "Save repository selection").trigger("click");
    await flushPromises();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("org/repo-1"),
      }),
    );
    await button(wrapper, "Save repository selection").trigger("click");
    await flushPromises();
    expect(mocks.select).toHaveBeenCalledWith(
      "attempt-A",
      "shared-installation",
      [],
      3,
      4,
      expect.any(AbortSignal),
    );
  });
  it("discards late candidates when switching between separate logins on the same installation", async () => {
    const old = deferred<{
      data: { repositories: ReturnType<typeof repo>[] };
    }>();
    route.query = { github_attempt: "attempt-A" };
    mocks.candidates.mockReturnValueOnce(old.promise);
    const wrapper = render();
    await flushPromises();
    const oldSignal = mocks.candidates.mock.calls[0]![2] as AbortSignal;
    team.value = "team-B";
    user.value = {
      id: "user-B",
      current_team_id: "team-B",
      current_team: { name: "Private B" },
    };
    await flushPromises();
    expect(oldSignal.aborted).toBe(true);
    expect(wrapper.find('[data-testid="github-selection"]').exists()).toBe(
      false,
    );
    mocks.attempt.mockResolvedValue(attempt("attempt-B", "team-B"));
    mocks.candidates.mockResolvedValue({
      data: { repositories: [repo("B", true)] },
    });
    route.query = { github_attempt: "attempt-B" };
    await flushPromises();
    old.resolve({ data: { repositories: [repo("A", true)] } });
    await flushPromises();
    expect(wrapper.text()).toContain("org/repo-B");
    expect(wrapper.text()).not.toContain("org/repo-A");
    await button(wrapper, "Save repository selection").trigger("click");
    await flushPromises();
    expect(mocks.select).toHaveBeenCalledWith(
      "attempt-B",
      "shared-installation",
      ["B"],
      3,
      4,
      expect.any(AbortSignal),
    );
  });
  it("requires confirmation of the named destination before starting authorization", async () => {
    mocks.start.mockResolvedValue({
      data: {
        team_id: "team-A",
        url: "https://github.com/login/oauth/authorize?state=bound",
      },
    });
    const wrapper = render();
    await flushPromises();
    await button(wrapper, "Connect GitHub").trigger("click");
    expect(wrapper.text()).toContain("including members invited later");
    expect(
      button(wrapper, "Continue to GitHub").attributes("disabled"),
    ).toBeDefined();
    expect(mocks.start).not.toHaveBeenCalled();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await button(wrapper, "Continue to GitHub").trigger("click");
    await flushPromises();
    expect(mocks.start).toHaveBeenCalledWith(
      undefined,
      true,
      expect.any(AbortSignal),
    );
  });
  it("shows callback failures and hides selection mutation from non-managers", async () => {
    route.query = {
      github_error: "access_denied",
      github_attempt: "attempt-A",
    };
    canManage.value = false;
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("cancelled");
    expect(mocks.attempt).not.toHaveBeenCalled();
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
  it("disconnects only the local connection after confirmation", async () => {
    mocks.list.mockResolvedValue({
      data: [
        {
          id: "local-A",
          provider: "github",
          login: "org",
          repository_count: 1,
          status: "active",
        },
      ],
    });
    mocks.disconnect.mockResolvedValue({});
    const wrapper = render();
    await flushPromises();
    await button(wrapper, "Disconnect from this account").trigger("click");
    await flushPromises();
    expect(mocks.disconnect).toHaveBeenCalledWith(
      "local-A",
      expect.any(AbortSignal),
    );
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining(
          "Other workspaces retain their selections",
        ),
      }),
    );
  });
  it("reviews inaccessible saved repositories and affected workloads without submitting inaccessible IDs", async () => {
    route.query = { github_attempt: "attempt-A" };
    mocks.candidates.mockResolvedValue({ data: { repositories: [repo("1", true), { ...repo("removed", true), unavailable: true, affected_workloads: [{ kind: "site", id: "site-1", name: "Production site" }] }] } });
    const wrapper = render();
    await flushPromises();
    const inaccessible = wrapper.get('input[value="removed"]');
    expect(inaccessible.attributes("disabled")).toBeDefined();
    expect((inaccessible.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.text()).toContain("Unavailable on GitHub");
    await button(wrapper, "Save repository selection").trigger("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Production site") }));
    expect(mocks.select).toHaveBeenCalledWith("attempt-A", "shared-installation", ["1"], 3, 4, expect.any(AbortSignal));
  });

  it("cannot save a failed candidate load as an empty selection", async () => {
    route.query = { github_attempt: "attempt-A" };
    mocks.candidates.mockRejectedValue(new Error("unavailable"));
    const wrapper = render();
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("Could not verify");
    expect(
      button(wrapper, "Save repository selection").attributes("disabled"),
    ).toBeDefined();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not disconnect A after its confirmation is accepted in account B", async () => {
    const confirmation = deferred<{ ok: boolean }>();
    mocks.confirm.mockReturnValue(confirmation.promise);
    mocks.list.mockResolvedValue({ data: [{ id: "local-A", provider: "github", login: "org", repository_count: 1, status: "active" }] });
    const wrapper = render();
    await flushPromises();
    await button(wrapper, "Disconnect from this account").trigger("click");
    team.value = "team-B";
    user.value = { id: "user-B", current_team_id: "team-B", current_team: { name: "Private B" } };
    confirmation.resolve({ ok: true });
    await flushPromises();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });

  it("does not submit A's repository removal after switching to B during confirmation", async () => {
    route.query = { github_attempt: "attempt-A" };
    const confirmation = deferred<{ ok: boolean }>();
    mocks.confirm.mockReturnValue(confirmation.promise);
    mocks.candidates.mockResolvedValue({ data: { repositories: [repo("A", true)] } });
    const wrapper = render();
    await flushPromises();
    await wrapper.get('input[value="A"]').setValue(false);
    await button(wrapper, "Save repository selection").trigger("click");
    team.value = "team-B";
    user.value = { id: "user-B", current_team_id: "team-B", current_team: { name: "Private B" } };
    confirmation.resolve({ ok: true });
    await flushPromises();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="github-selection"]').exists()).toBe(false);
  });

  it("does not save an earlier attempt using a replacement attempt's repository choices", async () => {
    route.query = { github_attempt: "attempt-A" };
    const confirmation = deferred<{ ok: boolean }>();
    mocks.confirm.mockReturnValue(confirmation.promise);
    mocks.candidates.mockResolvedValue({ data: { repositories: [repo("1", true)] } });
    const wrapper = render();
    await flushPromises();
    await wrapper.get('input[value="1"]').setValue(false);
    await button(wrapper, "Save repository selection").trigger("click");
    mocks.attempt.mockResolvedValue(attempt("replacement-attempt"));
    mocks.candidates.mockResolvedValue({ data: { repositories: [repo("2", true)] } });
    route.query = { github_attempt: "replacement-attempt" };
    await flushPromises();
    confirmation.resolve({ ok: true });
    await flushPromises();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("org/repo-2");
  });
});

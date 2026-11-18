import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { computed, defineComponent, ref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateApplicationSheet from "../../components/project/CreateApplicationSheet.vue";
import CreateComposeSheet from "../../components/project/CreateComposeSheet.vue";
import AddSite from "../../components/server/AddSite.vue";
import RepositoryPicker from "../../components/shared/RepositoryPicker.vue";
import { Checkbox } from "../../components/ui/checkbox";
import type { Repository } from "../../types";
import { createI18nStub } from "../helpers/i18n";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  repositories: vi.fn(),
  createApp: vi.fn(),
  createCompose: vi.fn(),
  registry: vi.fn(),
  api: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("~/services/sourceControlService", () => ({
  sourceControlService: { list: mocks.list, repositories: mocks.repositories },
}));
vi.mock("~/services/dockerService", () => ({
  dockerService: {
    applications: { create: mocks.createApp },
    composes: { create: mocks.createCompose },
    registryCredentials: { list: mocks.registry },
  },
}));
vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
const user = ref({ id: "user-A", current_team_id: "team-A" });
const team = ref("team-A");
const wrappers: VueWrapper[] = [];
const repo = (id: string): Repository => ({
  id,
  full_name: `org/${id}`,
  name: id,
  default_branch: "main",
  html_url: `https://github.com/org/${id}`,
  public: false,
});
const granted = [repo("grant-primary"), repo("grant-dependency")];
interface PickerVM {
  sourceType: string;
  gitBuildLocation: string;
  name: string;
  gitRepoFallback: string;
  sourceControlId: string;
  selectedRepo: Repository | null;
  dependencyRepositoryIds: string[];
  repositories: Repository[];
  sourceControls: Array<{ id: string; repository_count: number }>;
  repositorySearchTerm: string;
  fetchRepositories: (id: string) => Promise<void>;
  isOpen: boolean;
  handleSourceControlChange: (id: string) => void;
  handleRepoSelect: (repo: Repository) => void;
  submit: () => Promise<void>;
  sourceControlRepositoriesId: string;
  address: string;
  phpVersion: string;
  handleRepositorySelect: (repo: Repository) => void;
  onSubmit: () => Promise<void>;
}
const confirmation = defineComponent({
  setup(_, { expose }) {
    expose({ show: mocks.confirm });
  },
  template: "<div />",
});
const stubs = Object.fromEntries(
  [
    "Dialog",
    "DialogContent",
    "DialogHeader",
    "DialogDescription",
    "DialogTitle",
    "DialogFooter",
    "DialogTrigger",
    "Button",
    "Input",
    "Label",
    "Select",
    "SelectTrigger",
    "SelectValue",
    "SelectContent",
    "SelectItem",
    "Switch",
    "ComboboxRoot",
    "ComboboxAnchor",
    "ComboboxInput",
    "ComboboxTrigger",
    "ComboboxPortal",
    "ComboboxContent",
    "ComboboxEmpty",
    "ComboboxGroup",
    "ComboboxItem",
    "ComboboxItemIndicator",
    "CodeEditor",
    "SharedCodeEditor",
    "Textarea",
    "ServerAddSiteAdvancedOptions",
    "Icon",
  ].map((name) => [name, { template: "<div><slot /></div>" }]),
);
const render = async (
  component:
    | typeof CreateApplicationSheet
    | typeof CreateComposeSheet
    | typeof AddSite,
) => {
  const wrapper = shallowMount(component, {
    props:
      component === AddSite
        ? { serverId: "server-A" }
        : { open: false, serverId: "server-A", projectId: "project-A" },
    global: {
      renderStubDefaultSlot: true,
      stubs: { ...stubs, SharedConfirmationDialog: confirmation },
    },
  });
  wrappers.push(wrapper);
  const vm = wrapper.vm as unknown as PickerVM;
  if (component === AddSite) vm.isOpen = true;
  else await wrapper.setProps({ open: true });
  await flushPromises();
  return { wrapper, vm };
};
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  user.value = { id: "user-A", current_team_id: "team-A" };
  team.value = "team-A";
  mocks.list.mockResolvedValue({
    data: [
      {
        id: "connection-A",
        provider: "github",
        login: "org",
        repository_count: 2,
        status: "active",
      },
    ],
  });
  mocks.repositories.mockResolvedValue({ data: granted });
  mocks.registry.mockResolvedValue({ data: [] });
  mocks.createApp.mockResolvedValue({ data: {} });
  mocks.createCompose.mockResolvedValue({ data: {} });
  mocks.confirm.mockResolvedValue({ ok: true });
  mocks.api.mockImplementation(async (url: string) => ({
    data: url.endsWith("php-versions")
      ? [{ key: "php84", is_default: true }]
      : url.endsWith("create-options")
        ? {
            site_types: [
              {
                value: "laravel",
                label: "Laravel",
                requires_git: true,
                supports_git: true,
              },
            ],
          }
        : url.endsWith("hook-defaults")
          ? {}
          : [],
  }));
  for (const [key, value] of Object.entries({
    computed,
    ref,
    watch,
    useState: () => user,
    useCookie: () => team,
    useI18n: createI18nStub,
    $api: mocks.api,
  }))
    vi.stubGlobal(key, value);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

for (const [label, component] of [
  ["site", AddSite],
  ["application", CreateApplicationSheet],
  ["Compose", CreateComposeSheet],
] as const) {
  it(`${label} applies shadcn repository and dependency selections explicitly`, async () => {
    const { wrapper, vm } = await render(component);
    if (component !== AddSite) {
      vm.sourceType = "git";
      await flushPromises();
    }
    vm.handleSourceControlChange("connection-A");
    await flushPromises();
    wrapper.getComponent(RepositoryPicker).vm.$emit("update:modelValue", granted[0]);
    await flushPromises();
    expect(component === AddSite ? vm.sourceControlRepositoriesId : vm.selectedRepo?.id).toBe(granted[0]!.id);
    expect(vm.dependencyRepositoryIds).toEqual([]);
    const dependency = wrapper.getComponent(Checkbox);
    dependency.vm.$emit("update:modelValue", true);
    await flushPromises();
    expect(vm.dependencyRepositoryIds).toEqual([granted[1]!.id]);
    dependency.vm.$emit("update:modelValue", false);
    await flushPromises();
    expect(vm.dependencyRepositoryIds).toEqual([]);
    vm.handleSourceControlChange("other-connection");
    await flushPromises();
    expect(component === AddSite ? vm.sourceControlRepositoriesId : vm.selectedRepo).toBe(component === AddSite ? "" : null);
    expect(vm.dependencyRepositoryIds).toEqual([]);
  });

  it(`${label} reconciles a stale provider count with its available repositories`, async () => {
    mocks.list.mockResolvedValue({
      data: [
        {
          id: "connection-A",
          provider: "github",
          login: "org",
          repository_count: 11,
          status: "active",
        },
        {
          id: "other-connection",
          provider: "github",
          login: "other",
          repository_count: 7,
          status: "active",
        },
      ],
    });
    mocks.repositories.mockResolvedValueOnce({ data: [granted[0]] });
    const { vm } = await render(component);
    vm.handleSourceControlChange("connection-A");
    await flushPromises();
    expect(vm.repositories).toHaveLength(1);
    expect(
      vm.sourceControls.find((sc) => sc.id === "connection-A")
        ?.repository_count,
    ).toBe(1);
    expect(
      vm.sourceControls.find((sc) => sc.id === "other-connection")
        ?.repository_count,
    ).toBe(7);
    vm.repositorySearchTerm = "no-match";
    await flushPromises();
    expect(
      vm.sourceControls.find((sc) => sc.id === "connection-A")
        ?.repository_count,
    ).toBe(1);
    mocks.repositories.mockResolvedValueOnce({ data: [] });
    await vm.fetchRepositories("connection-A");
    expect(
      vm.sourceControls.find((sc) => sc.id === "connection-A")
        ?.repository_count,
    ).toBe(0);
    expect(
      vm.sourceControls.find((sc) => sc.id === "other-connection")
        ?.repository_count,
    ).toBe(7);
  });
}

for (const [label, component, create] of [
  ["application", CreateApplicationSheet, mocks.createApp],
  ["Compose", CreateComposeSheet, mocks.createCompose],
] as const) {
  describe(`${label} selected repository picker`, () => {
    it("submits selected local grant IDs and explicit dependencies, ignoring a pasted URL", async () => {
      const { vm } = await render(component);
      vm.sourceType = "git";
      await flushPromises();
      vm.name = "workload";
      vm.handleSourceControlChange("connection-A");
      await flushPromises();
      vm.handleRepoSelect(granted[0]!);
      vm.dependencyRepositoryIds = [granted[1]!.id];
      vm.gitRepoFallback = "https://attacker.test/repo";
      await vm.submit();
      expect(create).toHaveBeenCalledWith(
        "server-A",
        "project-A",
        expect.objectContaining({
          git: expect.objectContaining({
            source_control_id: "connection-A",
            repository_id: "grant-primary",
            dependency_repository_ids: ["grant-dependency"],
            repo: "https://github.com/org/grant-primary.git",
          }),
        }),
      );
    });
    it("requires server builds when explicit private dependencies are selected", async () => {
      const { vm } = await render(component);
      vm.sourceType = "git";
      await flushPromises();
      vm.name = "workload";
      vm.handleSourceControlChange("connection-A");
      await flushPromises();
      vm.handleRepoSelect(granted[0]!);
      vm.dependencyRepositoryIds = [granted[1]!.id];
      vm.gitBuildLocation = "github_actions";
      await vm.submit();
      expect(create).not.toHaveBeenCalled();
      vm.gitBuildLocation = "server";
      await vm.submit();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("rejects a connected URL fallback and permits public URL only without a connection", async () => {
      const { vm } = await render(component);
      vm.sourceType = "git";
      await flushPromises();
      vm.name = "workload";
      vm.handleSourceControlChange("connection-A");
      await flushPromises();
      vm.gitRepoFallback = "https://github.com/public/repo.git";
      await vm.submit();
      expect(create).not.toHaveBeenCalled();
      vm.handleSourceControlChange("");
      vm.gitRepoFallback = "https://github.com/public/repo.git";
      await vm.submit();
      const payload = create.mock.calls[0]![2];
      expect(payload.git).not.toHaveProperty("source_control_id");
      expect(payload.git).not.toHaveProperty("repository_id");
    });
    it("cancels and clears selected repositories on account switch despite late old data", async () => {
      let resolve!: (data: { data: Repository[] }) => void;
      mocks.repositories.mockImplementationOnce(
        () =>
          new Promise((yes) => {
            resolve = yes;
          }),
      );
      const { wrapper, vm } = await render(component);
      vm.handleSourceControlChange("connection-A");
      await flushPromises();
      const signal = mocks.repositories.mock.calls[0]![1] as AbortSignal;
      team.value = "team-B";
      user.value = { id: "user-B", current_team_id: "team-B" };
      await flushPromises();
      resolve({ data: granted });
      await flushPromises();
      expect(signal.aborted).toBe(true);
      expect(vm.repositories).toEqual([]);
      expect(vm.selectedRepo).toBeNull();
      expect(vm.sourceControlId).toBe("");
      expect(wrapper.emitted("update:open")).toContainEqual([false]);
    });
    it("does not restore the old source's repos when requests finish out of order", async () => {
      let resolve!: (data: { data: Repository[] }) => void;
      mocks.repositories
        .mockImplementationOnce(
          () =>
            new Promise((yes) => {
              resolve = yes;
            }),
        )
        .mockResolvedValueOnce({ data: [repo("new-grant")] });
      const { vm } = await render(component);
      vm.handleSourceControlChange("old-source");
      vm.handleSourceControlChange("new-source");
      await flushPromises();
      resolve({ data: granted });
      await flushPromises();
      expect(vm.repositories.map((item) => item.id)).toEqual(["new-grant"]);
      vm.handleRepoSelect(granted[0]!);
      expect(vm.selectedRepo).toBeNull();
    });
  });
}
describe("site selected repository picker", () => {
  it("sends local primary and dependency IDs from the current connection", async () => {
    const { vm } = await render(AddSite);
    vm.address = "app.example.test";
    vm.handleSourceControlChange("connection-A");
    await flushPromises();
    vm.handleRepositorySelect(granted[0]!);
    vm.dependencyRepositoryIds = [granted[1]!.id];
    await vm.onSubmit();
    expect(mocks.api).toHaveBeenCalledWith(
      "/servers/server-A/sites",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          source_control_id: "connection-A",
          source_control_repositories_id: "grant-primary",
          repository_dependency_ids: ["grant-dependency"],
        }),
      }),
    );
  });
  it("clears a site selection when the account or team changes", async () => {
    const { vm } = await render(AddSite);
    vm.handleSourceControlChange("connection-A");
    await flushPromises();
    vm.handleRepositorySelect(granted[0]!);
    team.value = "team-B";
    user.value = { id: "user-B", current_team_id: "team-B" };
    await flushPromises();
    expect(vm.sourceControlRepositoriesId).toBe("");
    expect(vm.repositories).toEqual([]);
    expect(vm.isOpen).toBe(false);
  });
});

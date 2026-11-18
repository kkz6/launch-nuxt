import { afterEach, describe, expect, it, vi } from "vitest";
import { githubConnectionService } from "../../services/githubConnectionService";

afterEach(() => vi.unstubAllGlobals());
describe("GitHub selection request contract", () => {
  it("sends an explicitly empty selection with both concurrency versions", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    const controller = new AbortController();
    vi.stubGlobal("useApi", () => ({ post }));
    await githubConnectionService.select("attempt-A", "installation", [], 7, 11, controller.signal);
    expect(post).toHaveBeenCalledWith("/settings/git-providers/github/connection-attempts/attempt-A/selection", { installation_id: "installation", repository_ids: [], expected_generation: 7, expected_selection_version: 11 }, { signal: controller.signal });
  });
  it("starts a review of the local connection with explicit workspace acknowledgement", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    vi.stubGlobal("useApi", () => ({ post }));
    await githubConnectionService.start("connection-A", true);
    expect(post).toHaveBeenCalledWith("/settings/git-providers/github/connection-attempts", { source_control_id: "connection-A", acknowledge_shared: true }, { signal: undefined });
  });
  it("disconnects only the account-local connection", async () => {
    const remove = vi.fn().mockResolvedValue({});
    vi.stubGlobal("useApi", () => ({ delete: remove }));
    await githubConnectionService.disconnect("connection-A");
    expect(remove).toHaveBeenCalledWith("/source-controls/connection-A", { signal: undefined });
  });
});

import { describe, expect, it } from "vitest";
import { createScopedRequest } from "../../utils/scopedRequest";
describe("context-bound requests", () => {
  it("rejects responses from the previous login, team, or connection even when transport ignores cancellation", () => {
    let context = "user-A:team-A:connection-1";
    const channel = createScopedRequest(() => context);
    const old = channel.start();
    context = "user-B:team-B:connection-1";
    expect(old.isCurrent()).toBe(false);
    const current = channel.start();
    expect(old.signal.aborted).toBe(true);
    expect(current.isCurrent()).toBe(true);
    context = "user-B:team-B:connection-2";
    expect(current.isCurrent()).toBe(false);
  });
  it("does not revive a cancelled request after switching back to the original context", () => {
    const channel = createScopedRequest(() => "same-context");
    const old = channel.start();
    channel.cancel();
    const current = channel.start();
    expect(old.isCurrent()).toBe(false);
    expect(current.isCurrent()).toBe(true);
  });
});

import { computed, effectScope, onScopeDispose, ref, unref, watch } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useBackupEvents,
  useDockerBackupEvents,
} from "../../composables/useChannelEvents";

const subscribe = vi.fn();
const subscribeToChannel = vi.fn();
const unsubscribeFromChannel = vi.fn();
const isConnected = ref(true);

describe("backup channel subscriptions", () => {
  beforeEach(() => {
    subscribe.mockReset().mockImplementation(() => vi.fn());
    subscribeToChannel.mockReset();
    unsubscribeFromChannel.mockReset();
    isConnected.value = true;
    vi.stubGlobal("computed", computed);
    vi.stubGlobal("onScopeDispose", onScopeDispose);
    vi.stubGlobal("unref", unref);
    vi.stubGlobal("watch", watch);
    vi.stubGlobal("useWebSocket", () => ({
      subscribe,
      subscribeToChannel,
      unsubscribeFromChannel,
      isConnected,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscribes to every server backup lifecycle event", () => {
    const scope = effectScope();
    scope.run(() => {
      useBackupEvents(ref("team-1"), vi.fn());
    });

    expect(subscribeToChannel).toHaveBeenCalledWith("team.team-1");
    expect(subscribe.mock.calls.map(([event]) => event)).toEqual([
      "backup.job.status",
      "backup.run.queued",
      "backup.run.started",
      "backup.run.succeeded",
      "backup.run.failed",
    ]);
    scope.stop();
    expect(unsubscribeFromChannel).toHaveBeenCalledWith("team.team-1");
  });

  it("subscribes to queued and running database backup events", () => {
    const scope = effectScope();
    scope.run(() => {
      useDockerBackupEvents("team-2", vi.fn());
    });

    expect(subscribeToChannel).toHaveBeenCalledWith("team.team-2");
    expect(subscribe.mock.calls.map(([event]) => event)).toEqual([
      "docker.database.backup.configured",
      "docker.database.backup.deleted",
      "docker.database.backup.restored",
      "docker.database.backup.run.queued",
      "docker.database.backup.run.started",
      "docker.database.backup.run.progress",
      "docker.database.backup.run.succeeded",
      "docker.database.backup.run.failed",
    ]);
    scope.stop();
  });
});

import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApi, useApiQuery } from "../../composables/useApi";
import { translateForLocale } from "../helpers/i18n";

const localeMocks = vi.hoisted(() => ({
  getEffectiveLocale: vi.fn(() => "ja"),
}));

vi.mock("~/composables/useLocalePreference", () => ({
  useLocalePreference: () => localeMocks,
}));

const cookies = new Map<string, { value: string | null }>();
const fetchMock = vi.fn();
const useFetchMock = vi.fn((url, options) => ({ url, options }));
const navigateToMock = vi.fn();
const activeUser = ref<{
  current_team_id: string | null;
  current_team?: { is_subscribed: boolean };
  role?: string;
} | null>(null);

describe("API locale headers", () => {
  beforeEach(() => {
    cookies.clear();
    activeUser.value = null;
    fetchMock.mockReset();
    useFetchMock.mockClear();
    navigateToMock.mockReset();
    localeMocks.getEffectiveLocale.mockReturnValue("ja");

    vi.stubGlobal("$fetch", fetchMock);
    vi.stubGlobal("useFetch", useFetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { apiBase: "https://api.example.test" },
    }));
    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: {
        t: (key: string) =>
          translateForLocale(
            localeMocks.getEffectiveLocale() as "en" | "ja",
            key,
          ),
      },
    }));
    vi.stubGlobal("useCookie", (key: string) => {
      if (!cookies.has(key)) cookies.set(key, { value: null });
      return cookies.get(key);
    });
    vi.stubGlobal("navigateTo", navigateToMock);
    vi.stubGlobal("useState", () => activeUser);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("adds the effective locale to regular API requests", async () => {
    fetchMock.mockResolvedValue({ success: true, data: {} });

    await useApi().get("/servers");

    expect(fetchMock).toHaveBeenCalledWith(
      "/servers",
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "ja" }),
      }),
    );
  });

  it("adds the effective locale to token refresh and the retried request", async () => {
    cookies.set("auth_token", { value: "expired" });
    cookies.set("auth_refresh_token", { value: "refresh-token" });
    fetchMock
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { access_token: "new-token" } })
      .mockResolvedValueOnce({ success: true, data: { id: "server" } });

    await useApi().get("/servers/server");

    expect(fetchMock.mock.calls[1][0]).toBe("/auth/refresh");
    expect(fetchMock.mock.calls[1][1].headers["Accept-Language"]).toBe("ja");
    expect(fetchMock.mock.calls[2][1].headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer new-token",
        "Accept-Language": "ja",
      }),
    );
  });

  it("rebuilds the locale header after waiting for a token refresh", async () => {
    cookies.set("auth_token", { value: "expired" });
    cookies.set("auth_refresh_token", { value: "refresh-token" });
    fetchMock
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockImplementationOnce(async () => {
        localeMocks.getEffectiveLocale.mockReturnValue("en");
        return { data: { access_token: "new-token" } };
      })
      .mockResolvedValueOnce({ success: true, data: { id: "server" } });

    await useApi().get("/servers/server");

    expect(fetchMock.mock.calls[2][1].headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer new-token",
        "Accept-Language": "en",
      }),
    );
  });

  it("adds the effective locale to useApiQuery", () => {
    useApiQuery("/servers", { immediate: false });

    expect(useFetchMock).toHaveBeenCalledWith(
      "/servers",
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "ja" }),
      }),
    );
  });

  it("uses stable error codes to clear an invalid team context", async () => {
    cookies.set("current_team_id", { value: "team-id" });
    activeUser.value = { current_team_id: "team-id" };
    fetchMock.mockRejectedValue({
      response: { status: 400 },
      data: {
        code: "team.context_required",
        message: "チームコンテキストが必要です。",
      },
    });

    await expect(useApi().get("/servers/server")).rejects.toMatchObject({
      data: { code: "team.context_required" },
    });

    expect(cookies.get("current_team_id")?.value).toBeNull();
    expect(activeUser.value.current_team_id).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith("/dashboard", {
      replace: true,
    });
  });

  it("keeps the new team when an older request fails", async () => {
    cookies.set("current_team_id", { value: "old-team" });
    fetchMock.mockImplementationOnce(async () => {
      cookies.get("current_team_id")!.value = "new-team";
      activeUser.value = { current_team_id: "new-team" };
      throw { data: { code: "team.not_member" } };
    });
    await expect(useApi().get("/servers")).rejects.toMatchObject({
      data: { code: "team.not_member" },
    });
    expect(cookies.get("current_team_id")?.value).toBe("new-team");
    expect(activeUser.value?.current_team_id).toBe("new-team");
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("shows the subscription prompt when the API rejects stale subscription status", async () => {
    cookies.set("current_team_id", { value: "team-id" });
    activeUser.value = {
      current_team_id: "team-id",
      current_team: { is_subscribed: true },
    };
    fetchMock.mockRejectedValueOnce({ response: { status: 402 } });

    await expect(useApi().get("/servers")).rejects.toMatchObject({
      response: { status: 402 },
    });
    expect(activeUser.value.current_team?.is_subscribed).toBe(false);
    expect(cookies.get("current_team_id")?.value).toBe("team-id");
    expect(navigateToMock).toHaveBeenCalledWith("/dashboard", {
      replace: true,
    });
  });

  it.each([
    ["membership", { data: { code: "team.not_member" } }],
    ["subscription", { response: { status: 402 } }],
  ])("ignores a stale %s error after the session changes", async (_kind, error) => {
    cookies.set("auth_token", { value: "same-access-token" });
    cookies.set("auth_refresh_token", { value: "original-session" });
    cookies.set("current_team_id", { value: "team-id" });
    activeUser.value = {
      current_team_id: "team-id",
      current_team: { is_subscribed: true },
      role: "owner",
    };
    fetchMock.mockImplementationOnce(async () => {
      cookies.get("auth_refresh_token")!.value = "replacement-session";
      throw error;
    });

    await expect(useApi().get("/servers")).rejects.toBe(error);
    expect(cookies.get("current_team_id")?.value).toBe("team-id");
    expect(activeUser.value.current_team_id).toBe("team-id");
    expect(activeUser.value.current_team?.is_subscribed).toBe(true);
    expect(activeUser.value.role).toBe("owner");
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("uses stable error codes in useApiQuery response handling", () => {
    cookies.set("current_team_id", { value: "team-id" });
    useApiQuery("/servers", { immediate: false });
    const options = useFetchMock.mock.calls[0]?.[1];

    options.onResponseError({
      response: {
        status: 403,
        _data: {
          code: "team.not_member",
          message: "このチームのメンバーではありません。",
        },
      },
    });

    expect(cookies.get("current_team_id")?.value).toBeNull();
    expect(navigateToMock).toHaveBeenCalledWith("/dashboard", {
      replace: true,
    });
  });

  it.each([
    ["permission.denied", "common.permissions.denied"],
    ["permission.read_only", "common.permissions.readOnly"],
  ])(
    "localizes %s without changing the denial or team context",
    async (code, key) => {
      cookies.set("current_team_id", { value: "team-id" });
      const response = {
        status: 403,
        _data: { code, message: "Raw permission message" },
      };
      const error = { response, data: response._data };
      fetchMock.mockImplementation(async (_url, options) => {
        options.onResponseError({ response });
        throw error;
      });

      await expect(
        useApi().post("/servers/server/sites/site/deploy"),
      ).rejects.toBe(error);

      expect(error.data).toEqual({
        code,
        message: translateForLocale("ja", key),
      });
      expect(error.response.status).toBe(403);
      expect(cookies.get("current_team_id")?.value).toBe("team-id");
      expect(navigateToMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "your team role (Member) lacks permission for this action",
      "common.permissions.denied",
    ],
    [
      "your team role lacks permission for this action",
      "common.permissions.denied",
    ],
    ["Read-only impersonation session", "common.permissions.readOnly"],
    [
      "read-only session cannot modify resources",
      "common.permissions.readOnly",
    ],
  ])("recognizes the legacy denial %s", async (message, key) => {
    localeMocks.getEffectiveLocale.mockReturnValue("en");
    const response = { status: 403, _data: { message } };
    fetchMock.mockImplementation(async (_url, options) => {
      options.onResponseError({ response });
      throw { response, data: response._data };
    });

    await expect(useApi().post("/resource")).rejects.toMatchObject({
      data: { message: translateForLocale("en", key) },
    });
  });

  it.each([
    [
      403,
      {
        code: "billing.subscription_required",
        message: "Your subscription is inactive",
      },
    ],
    [403, { message: "Your account is suspended" }],
    [403, { message: "resource does not belong to your team" }],
    [
      403,
      {
        code: "account.frozen",
        message: "your team role (Member) lacks permission for this action",
      },
    ],
    [422, { code: "permission.denied", message: "Validation failed" }],
  ])("preserves unrelated response %s %j", async (status, data) => {
    const response = { status, _data: { ...data } };
    const error = { response, data: response._data };
    fetchMock.mockImplementation(async (_url, options) => {
      options.onResponseError({ response });
      throw error;
    });

    await expect(useApi().post("/resource")).rejects.toBe(error);
    expect(error.data).toEqual(data);
  });

  it("keeps permission copy on the retried request after token refresh", async () => {
    cookies.set("auth_token", { value: "expired" });
    cookies.set("auth_refresh_token", { value: "refresh-token" });
    fetchMock
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { access_token: "new-token" } })
      .mockImplementationOnce(async (_url, options) => {
        const response = {
          status: 403,
          _data: { code: "permission.denied", message: "Raw denial" },
        };
        options.onResponseError({ response });
        throw { response, data: response._data };
      });

    await expect(useApi().post("/resource")).rejects.toMatchObject({
      data: { message: translateForLocale("ja", "common.permissions.denied") },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("localizes permission failures in query responses", () => {
    useApiQuery("/resource");
    const options = useFetchMock.mock.calls[0]?.[1];
    const response = {
      status: 403,
      _data: { code: "permission.read_only", message: "Raw denial" },
    };

    options.onResponseError({ response });

    expect(response._data.message).toBe(
      translateForLocale("ja", "common.permissions.readOnly"),
    );
    expect(response._data.code).toBe("permission.read_only");
    expect(navigateToMock).not.toHaveBeenCalled();
  });
  it("does not retry a GitHub mutation under a changed team after a token refresh", async () => {
    cookies.set("auth_token", { value: "expired" });
    cookies.set("auth_refresh_token", { value: "refresh-token" });
    cookies.set("current_team_id", { value: "team-A" });
    fetchMock
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockImplementationOnce(async () => {
        cookies.get("current_team_id")!.value = "team-B";
        return { data: { access_token: "new-token" } };
      });
    await expect(
      useApi().post(
        "/settings/git-providers/github/connection-attempts/attempt/selection",
        { repository_ids: ["1"] },
      ),
    ).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not replace a newly signed-in account's tokens with an old refresh response", async () => {
    cookies.set("auth_token", { value: "expired-A" });
    cookies.set("auth_refresh_token", { value: "refresh-A" });
    fetchMock
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockImplementationOnce(async () => {
        cookies.get("auth_token")!.value = "session-B";
        cookies.get("auth_refresh_token")!.value = "refresh-B";
        return { data: { access_token: "new-token-A" } };
      });
    await expect(useApi().get("/source-controls")).rejects.toBeDefined();
    expect(cookies.get("auth_token")!.value).toBe("session-B");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("forwards cancellation and never retries an aborted repository request", async () => {
    cookies.set("auth_token", { value: "expired" });
    cookies.set("auth_refresh_token", { value: "refresh-token" });
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw { response: { status: 401 } };
    });
    await expect(
      useApi().get("/source-controls/connection/repositories", {
        signal: controller.signal,
      }),
    ).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
  });

  it("refreshes B independently while an abandoned A refresh is still pending", async () => {
    let finishA!: (value: { data: { access_token: string } }) => void;
    cookies.set("auth_token", { value: "expired-A" });
    cookies.set("auth_refresh_token", { value: "refresh-A" });
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve; }))
      .mockResolvedValueOnce({ data: { access_token: "new-B" } });
    const refreshingA = useApi().refreshAccessToken();
    cookies.get("auth_token")!.value = "expired-B";
    cookies.get("auth_refresh_token")!.value = "refresh-B";
    expect(await useApi().refreshAccessToken()).toBe("new-B");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    finishA({ data: { access_token: "new-A" } });
    expect(await refreshingA).toBeNull();
    expect(cookies.get("auth_token")!.value).toBe("new-B");
  });

  it.each(["account", "team"])("rejects a successful response from an abandoned %s context", async (context) => {
    cookies.set("auth_token", { value: "access-A" });
    cookies.set("auth_refresh_token", { value: "refresh-A" });
    cookies.set("current_team_id", { value: "team-A" });
    fetchMock.mockImplementationOnce(async () => {
      if (context === "account") {
        cookies.get("auth_token")!.value = "access-B";
        cookies.get("auth_refresh_token")!.value = "refresh-B";
      } else cookies.get("current_team_id")!.value = "team-B";
      return { data: { repositories: ["account-A-private-repo"] } };
    });
    await expect(useApi().get("/source-controls/connection/repositories"))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});

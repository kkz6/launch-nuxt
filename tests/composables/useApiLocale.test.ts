import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApi, useApiQuery } from "../../composables/useApi";

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

describe("API locale headers", () => {
  beforeEach(() => {
    cookies.clear();
    fetchMock.mockReset();
    useFetchMock.mockClear();
    navigateToMock.mockReset();
    localeMocks.getEffectiveLocale.mockReturnValue("ja");

    vi.stubGlobal("$fetch", fetchMock);
    vi.stubGlobal("useFetch", useFetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { apiBase: "https://api.example.test" },
    }));
    vi.stubGlobal("useCookie", (key: string) => {
      if (!cookies.has(key)) cookies.set(key, { value: null });
      return cookies.get(key);
    });
    vi.stubGlobal("navigateTo", navigateToMock);
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
    expect(navigateToMock).toHaveBeenCalledWith("/servers");
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
    expect(navigateToMock).toHaveBeenCalledWith("/servers");
  });
});

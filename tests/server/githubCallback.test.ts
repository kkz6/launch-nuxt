// @vitest-environment node
import { createServer, type Server } from "node:http";
import {
  createApp,
  defineEventHandler,
  getCookie,
  getHeader,
  getQuery,
  getRouterParam,
  sendRedirect,
  toNodeListener,
} from "h3";
import { $fetch } from "ofetch";
import { afterEach, describe, expect, it, vi } from "vitest";

const servers: Server[] = [];
const listen = async (server: Server) => {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return `http://127.0.0.1:${address.port}`;
};
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
  vi.unstubAllGlobals();
  vi.resetModules();
});
const proxy = async (backendBase: string) => {
  for (const [name, value] of Object.entries({
    defineEventHandler,
    getCookie,
    getHeader,
    getQuery,
    getRouterParam,
    sendRedirect,
    $fetch,
  }))
    vi.stubGlobal(name, value);
  vi.stubGlobal("useRuntimeConfig", () => ({ backendBase }));
  const { default: handler } =
    await import("../../server/routes/settings/git-providers/[provider]/callback.get");
  return listen(
    createServer(
      toNodeListener(
        createApp().use(
          defineEventHandler((event) => {
            event.context.params = { provider: "github" };
            return handler(event);
          }),
        ),
      ),
    ),
  );
};
const cookies = {
  cookie: "auth_token=session-A; current_team_id=team-A; locale=ja",
};

describe("GitHub authorization callback", () => {
  it("forwards the originating session and redirects only to selection, without authorization secrets", async () => {
    let received: unknown;
    const backend = await listen(
      createServer((req, res) => {
        received = {
          url: req.url,
          token: req.headers.authorization,
          team: req.headers["x-team-id"],
          locale: req.headers["accept-language"],
        };
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            data: {
              attempt_id: "attempt-A",
              status: "authorized",
              team_id: "team-A",
            },
          }),
        );
      }),
    );
    const frontend = await proxy(backend);
    const response = await fetch(
      `${frontend}/callback?state=one-time-state&code=secret-code&unknown=ignored`,
      { headers: cookies, redirect: "manual" },
    );
    expect(received).toEqual({
      url: "/settings/git-providers/github/callback?state=one-time-state&code=secret-code",
      token: "Bearer session-A",
      team: "team-A",
      locale: "ja",
    });
    expect(response.headers.get("location")).toBe(
      "/dashboard?settings=connections&github_attempt=attempt-A",
    );
  });
  it.each([401, 403, 422, 500])(
    "shows a failure for backend %i instead of claiming success",
    async (status) => {
      const backend = await listen(
        createServer((_req, res) => {
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify({ message: "secret provider token" }));
        }),
      );
      const frontend = await proxy(backend);
      const response = await fetch(
        `${frontend}/callback?state=state&code=secret`,
        { headers: cookies, redirect: "manual" },
      );
      expect(response.headers.get("location")).toBe(
        `/dashboard?settings=connections&github_error=${status === 401 ? "session_required" : "connection_failed"}`,
      );
    },
  );
  it("rejects a successful response for another team", async () => {
    const backend = await listen(
      createServer((_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            data: {
              attempt_id: "attempt-B",
              status: "authorized",
              team_id: "team-B",
            },
          }),
        );
      }),
    );
    const frontend = await proxy(backend);
    const response = await fetch(`${frontend}/callback?state=state&code=code`, {
      headers: cookies,
      redirect: "manual",
    });
    expect(response.headers.get("location")).toContain(
      "github_error=connection_failed",
    );
  });
  it.each([
    ["?installation_id=123", cookies, "invalid_callback"],
    ["?code=code&state=state", {}, "session_required"],
    [
      "?error=access_denied&error_description=private",
      cookies,
      "access_denied",
    ],
  ])(
    "rejects incomplete, missing-session, and cancelled callbacks",
    async (query, headers, code) => {
      const fetchSpy = vi.fn();
      const frontend = await proxy("http://127.0.0.1:1");
      vi.stubGlobal("$fetch", fetchSpy);
      const response = await fetch(`${frontend}/callback${query}`, {
        headers,
        redirect: "manual",
      });
      expect(response.headers.get("location")).toBe(
        `/dashboard?settings=connections&github_error=${code}`,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
});

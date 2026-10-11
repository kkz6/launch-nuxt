// @vitest-environment node
import { createServer, type Server } from "node:http";
import {
  createApp,
  defineEventHandler,
  getRequestURL,
  getRouterParam,
  proxyRequest,
  toNodeListener,
} from "h3";
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
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
  vi.unstubAllGlobals();
  vi.resetModules();
});

const createProxy = async (backendBase: string) => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.stubGlobal("getRequestURL", getRequestURL);
  vi.stubGlobal("proxyRequest", proxyRequest);
  vi.stubGlobal("useRuntimeConfig", () => ({ backendBase }));
  const { default: handler } =
    await import("../../server/routes/deploy/[...path]");
  const app = createApp().use(
    defineEventHandler((event) => {
      event.context.params = {
        path: getRequestURL(event).pathname.slice("/deploy/".length),
      };
      return handler(event);
    }),
  );
  return listen(createServer(toNodeListener(app)));
};

describe("deployment webhook proxy", () => {
  it("forwards POST body, provider headers and query unchanged, and returns 204", async () => {
    let received: unknown;
    const backend = await listen(
      createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        received = {
          method: req.method,
          url: req.url,
          signature: req.headers["x-hub-signature-256"],
          event: req.headers["x-github-event"],
          body: Buffer.concat(chunks).toString(),
        };
        res.writeHead(204);
        res.end();
      }),
    );
    const frontend = await createProxy(`${backend}/`);
    const body = '{"ref":"refs/heads/main","message":"deploy"}';
    const response = await fetch(
      `${frontend}/deploy/site-id/token?branch=main&tag=a%2Fb&tag=c`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": "sha256=signature",
          "x-github-event": "push",
        },
        body,
      },
    );
    expect(response.status).toBe(204);
    expect(received).toEqual({
      method: "POST",
      url: "/deploy/site-id/token?branch=main&tag=a%2Fb&tag=c",
      signature: "sha256=signature",
      event: "push",
      body,
    });
  });

  it("supports GET triggers and preserves backend error responses", async () => {
    const backend = await listen(
      createServer((req, res) => {
        expect(req.method).toBe("GET");
        expect(req.url).toBe("/deploy/site-id/invalid-token?branch=main");
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Invalid deployment token" }));
      }),
    );
    const frontend = await createProxy(backend);
    const response = await fetch(
      `${frontend}/deploy/site-id/invalid-token?branch=main`,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "Invalid deployment token",
    });
  });
});

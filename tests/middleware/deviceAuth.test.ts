import { ref } from "vue";
import type { RouteLocationNormalized } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateTo = vi.fn();
const waitForAuth = vi.fn();
const token = ref<string | null>(null);
const isAuthenticated = ref(false);

describe("device authentication middleware", () => {
  beforeEach(() => {
    navigateTo.mockReset();
    waitForAuth.mockReset().mockResolvedValue(undefined);
    token.value = null;
    isAuthenticated.value = false;
    vi.stubGlobal("defineNuxtRouteMiddleware", (handler: unknown) => handler);
    vi.stubGlobal("useCookie", () => token);
    vi.stubGlobal("useAuth", () => ({ waitForAuth, isAuthenticated }));
    vi.stubGlobal("navigateTo", navigateTo);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the approval destination when a user needs to sign in", async () => {
    const middleware = (await import("../../middleware/device-auth")).default;
    await middleware(
      {} as RouteLocationNormalized,
      {} as RouteLocationNormalized,
    );
    expect(navigateTo).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/cli/auth" },
    });
  });

  it("checks an existing session before allowing approval", async () => {
    token.value = "present";
    const middleware = (await import("../../middleware/device-auth")).default;
    await middleware(
      {} as RouteLocationNormalized,
      {} as RouteLocationNormalized,
    );
    expect(waitForAuth).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith({
      path: "/login",
      query: { redirect: "/cli/auth" },
    });
    isAuthenticated.value = true;
    navigateTo.mockClear();
    await middleware(
      {} as RouteLocationNormalized,
      {} as RouteLocationNormalized,
    );
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("returns an already signed-in user from login to approval", async () => {
    token.value = "present";
    isAuthenticated.value = true;
    const middleware = (await import("../../middleware/guest")).default;
    await middleware(
      {
        query: { redirect: "/cli/auth" },
      } as unknown as RouteLocationNormalized,
      {} as RouteLocationNormalized,
    );
    expect(navigateTo).toHaveBeenCalledWith("/cli/auth");
  });
});

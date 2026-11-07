import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceAuthService } from "../../services/deviceAuthService";

describe("deviceAuthService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { user_code: "01234567", approve: true, code: "123456" },
    { user_code: "01234567", approve: false },
  ])(
    "posts an explicit decision through the authenticated API",
    async (request) => {
      const post = vi
        .fn()
        .mockResolvedValue({ success: true, data: { status: "approved" } });
      vi.stubGlobal("useApi", () => ({ post }));
      await deviceAuthService.authorize(request);
      expect(post).toHaveBeenCalledWith("/auth/device/authorize", request);
    },
  );
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { adminService } from "../../services/adminService";

describe("admin server deletion API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["deleted", "deletion_requested"])(
    "sends exact name confirmation and returns %s receipt",
    async (status) => {
      const response = {
        success: true,
        data: { server_id: "server-1", status },
      };
      const fetch = vi.fn().mockResolvedValue(response);
      vi.stubGlobal("useApi", () => ({ fetch }));
      expect(
        await adminService.deleteServer("server-1", "Production Web"),
      ).toEqual(response);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith("/admin/servers/server-1", {
        method: "DELETE",
        body: { confirmation_name: "Production Web" },
      });
    },
  );

  it("uses the dedicated record-removal endpoint and preserves the removed receipt", async () => {
    const response = {
      success: true,
      data: { server_id: "server-1", status: "removed" },
    };
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("useApi", () => ({ fetch }));
    expect(
      await adminService.removeServerRecord("server-1", "Production Web"),
    ).toEqual(response);
    expect(fetch).toHaveBeenCalledWith("/admin/servers/server-1/record", {
      method: "DELETE",
      body: { confirmation_name: "Production Web" },
    });
    const error = { status: 422, data: { message: "Remove sites first" } };
    fetch.mockRejectedValueOnce(error);
    await expect(
      adminService.removeServerRecord("server-1", "Production Web"),
    ).rejects.toBe(error);
  });

  it("uses the uninstall endpoint and preserves the offline result", async () => {
    const response = {
      data: { server_id: "server-1", status: "removed_offline" },
    };
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("useApi", () => ({ fetch }));
    expect(
      await adminService.uninstallServer("server-1", "Production Web"),
    ).toEqual(response);
    expect(fetch).toHaveBeenCalledWith("/admin/servers/server-1/uninstall", {
      method: "DELETE",
      body: { confirmation_name: "Production Web" },
    });
  });

  it("propagates a backend refusal without a success response", async () => {
    const error = { status: 422, data: { message: "Remove sites first" } };
    const fetch = vi.fn().mockRejectedValue(error);
    vi.stubGlobal("useApi", () => ({ fetch }));
    await expect(
      adminService.deleteServer("server-1", "Production Web"),
    ).rejects.toBe(error);
  });
});

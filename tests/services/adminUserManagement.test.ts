import { afterEach, describe, expect, it, vi } from "vitest";
import { adminService } from "../../services/adminService";

describe("admin user management API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the exact site domain and returns the queued deletion receipt", async () => {
    const response = {
      success: true,
      data: { site_id: "site-1", status: "deletion_requested" },
    };
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("useApi", () => ({ fetch }));
    expect(await adminService.deleteSite("site-1", "app.example.com")).toEqual(
      response,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/admin/sites/site-1", {
      method: "DELETE",
      body: { confirmation_domain: "app.example.com" },
    });
  });

  it.each([null, "support", "super_admin"] as const)(
    "sends staff_role %j, including explicit null",
    async (role) => {
      const response = {
        success: true,
        data: { id: "user-1", staff_role: role },
      };
      const patch = vi.fn().mockResolvedValue(response);
      vi.stubGlobal("useApi", () => ({ patch }));
      expect(await adminService.updateStaffRole("user-1", role)).toEqual(
        response,
      );
      expect(patch).toHaveBeenCalledTimes(1);
      expect(patch).toHaveBeenCalledWith("/admin/users/user-1/staff-role", {
        staff_role: role,
      });
    },
  );

  it("propagates queue and role refusals to the caller", async () => {
    const error = { status: 409, data: { message: "Operation unavailable" } };
    vi.stubGlobal("useApi", () => ({
      fetch: vi.fn().mockRejectedValue(error),
      patch: vi.fn().mockRejectedValue(error),
    }));
    await expect(
      adminService.deleteSite("site-1", "app.example.com"),
    ).rejects.toBe(error);
    await expect(adminService.updateStaffRole("user-1", null)).rejects.toBe(
      error,
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { authService } from "../../services/authService";

it("requests a personal team when registering against the existing API", async () => {
  const post = vi.fn().mockResolvedValue({ success: true });
  vi.stubGlobal("useApi", () => ({ post }));
  const data = {
    name: "New Customer",
    email: "customer@example.com",
    password: "example-password",
    password_confirmation: "example-password",
  };

  try {
    await authService.register(data);
    expect(post).toHaveBeenCalledWith("/auth/register", {
      ...data,
      create_personal_team: true,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

describe("authService locale preference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["auto", "en", "ja"] as const)(
    "persists %s through the locale endpoint",
    async (locale) => {
      const patch = vi.fn().mockResolvedValue({
        success: true,
        data: { locale: locale === "auto" ? null : locale },
      });
      vi.stubGlobal("useApi", () => ({ patch }));

      await authService.updateLocale(locale);

      expect(patch).toHaveBeenCalledWith("/auth/locale", { locale });
    },
  );
});

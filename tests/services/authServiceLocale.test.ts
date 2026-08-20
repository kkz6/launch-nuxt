import { afterEach, describe, expect, it, vi } from "vitest";
import { authService } from "../../services/authService";

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

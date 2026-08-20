import { describe, expect, it } from "vitest";
import {
  detectSupportedLocale,
  normalizeLocaleCode,
  normalizeLocalePreference,
  parseAcceptLanguage,
} from "../../utils/locale";

describe("locale detection utilities", () => {
  it("canonicalizes supported regional language tags", () => {
    expect(normalizeLocaleCode("ja-JP")).toBe("ja");
    expect(normalizeLocaleCode("JA_jp")).toBe("ja");
    expect(normalizeLocaleCode("en-US")).toBe("en");
    expect(normalizeLocaleCode("fr-FR")).toBeNull();
  });

  it("accepts only supported persisted preferences", () => {
    expect(normalizeLocalePreference("AUTO")).toBe("auto");
    expect(normalizeLocalePreference("ja")).toBe("ja");
    expect(normalizeLocalePreference("ja-JP")).toBeNull();
  });

  it("orders Accept-Language candidates by quality and ignores q=0", () => {
    expect(
      parseAcceptLanguage("fr-FR;q=0.4, ja-JP;q=0.9, en-US;q=0.7, de;q=0"),
    ).toEqual(["ja-JP", "en-US", "fr-FR"]);
  });

  it("selects the first supported candidate and otherwise falls back to English", () => {
    expect(detectSupportedLocale(["fr-FR", "ja-JP", "en-US"])).toBe("ja");
    expect(detectSupportedLocale(["fr-FR", "de-DE"])).toBe("en");
  });
});

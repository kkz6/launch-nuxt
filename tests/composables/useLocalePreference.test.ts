import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalePreference } from "../../composables/useLocalePreference";

const cookies = new Map<string, ReturnType<typeof ref>>();
const states = new Map<string, ReturnType<typeof ref>>();
const runtimeLocale = ref("en");
const setLocale = vi.fn(async (locale: string) => {
  runtimeLocale.value = locale;
});

const setBrowserLanguages = (languages: string[]) => {
  vi.stubGlobal("navigator", {
    language: languages[0] || "",
    languages,
  });
};

describe("useLocalePreference", () => {
  beforeEach(() => {
    cookies.clear();
    states.clear();
    runtimeLocale.value = "en";
    setLocale.mockClear();
    setBrowserLanguages(["ja-JP", "en-US"]);

    vi.stubGlobal("useNuxtApp", () => ({
      $i18n: { locale: runtimeLocale, setLocale },
    }));
    vi.stubGlobal("useCookie", (key: string) => {
      if (!cookies.has(key)) cookies.set(key, ref(null));
      return cookies.get(key);
    });
    vi.stubGlobal("useState", (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()));
      return states.get(key);
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("gives a saved user locale priority over the preference cookie and browser", async () => {
    cookies.set("locale_preference", ref("en"));

    const locale = useLocalePreference();
    await expect(locale.initializeLocale("ja")).resolves.toBe("ja");

    expect(locale.localePreference.value).toBe("ja");
    expect(cookies.get("locale_preference")?.value).toBe("ja");
    expect(cookies.get("locale")?.value).toBe("ja");
    expect(runtimeLocale.value).toBe("ja");
  });

  it("uses an explicit preference cookie before browser detection", async () => {
    cookies.set("locale_preference", ref("en"));

    const locale = useLocalePreference();
    await expect(locale.initializeLocale(null)).resolves.toBe("en");

    expect(setLocale).not.toHaveBeenCalled();
    expect(cookies.get("locale")?.value).toBe("en");
  });

  it("detects Japanese for automatic mode and synchronizes the effective cookie", async () => {
    cookies.set("locale_preference", ref("auto"));

    const locale = useLocalePreference();
    await expect(locale.initializeLocale(null)).resolves.toBe("ja");

    expect(locale.localePreference.value).toBe("auto");
    expect(cookies.get("locale")?.value).toBe("ja");
  });

  it("keeps the server-resolved effective locale during automatic hydration", async () => {
    cookies.set("locale_preference", ref("auto"));
    cookies.set("locale", ref("en"));

    const locale = useLocalePreference();
    await expect(locale.initializeLocale(null)).resolves.toBe("en");

    expect(setLocale).not.toHaveBeenCalled();
    expect(locale.localePreference.value).toBe("auto");
    expect(cookies.get("locale")?.value).toBe("en");
  });

  it("falls back to English when automatic mode finds no supported browser locale", async () => {
    setBrowserLanguages(["fr-FR", "de-DE"]);

    const locale = useLocalePreference();
    await expect(locale.setLocalePreference("auto")).resolves.toBe("en");

    expect(cookies.get("locale_preference")?.value).toBe("auto");
    expect(cookies.get("locale")?.value).toBe("en");
  });

  it("does not inherit an explicit locale from another account when the saved preference is automatic", async () => {
    cookies.set("locale_preference", ref("en"));

    const locale = useLocalePreference();
    await expect(locale.applySavedUserLocale(null)).resolves.toBe("ja");

    expect(locale.localePreference.value).toBe("auto");
    expect(cookies.get("locale_preference")?.value).toBe("auto");
    expect(cookies.get("locale")?.value).toBe("ja");
  });

  it("preserves the hydrated effective locale for an authenticated automatic preference", async () => {
    cookies.set("locale_preference", ref("auto"));
    cookies.set("locale", ref("en"));

    const locale = useLocalePreference();
    await expect(
      locale.applySavedUserLocale(null, { preferEffectiveCookie: true }),
    ).resolves.toBe("en");

    expect(locale.localePreference.value).toBe("auto");
    expect(setLocale).not.toHaveBeenCalled();
    expect(cookies.get("locale")?.value).toBe("en");
  });
});

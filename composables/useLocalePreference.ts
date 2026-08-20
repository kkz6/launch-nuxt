import { computed, unref, type Ref } from "vue";
import {
  DEFAULT_LOCALE,
  EFFECTIVE_LOCALE_COOKIE,
  LOCALE_PREFERENCE_COOKIE,
  type LocaleCode,
  type LocalePreference,
  type UserLocale,
} from "~/types/locale";
import {
  detectSupportedLocale,
  normalizeLocaleCode,
  normalizeLocalePreference,
  parseAcceptLanguage,
} from "~/utils/locale";

interface LocaleRuntime {
  locale: Ref<string> | string;
  setLocale: (locale: LocaleCode) => Promise<void> | void;
}

interface SavedUserLocaleOptions {
  preferEffectiveCookie?: boolean;
}

const cookieOptions = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  path: "/",
};

export const useLocalePreference = () => {
  const i18n = useNuxtApp().$i18n as unknown as LocaleRuntime;
  const preferenceCookie = useCookie<LocalePreference | null>(
    LOCALE_PREFERENCE_COOKIE,
    cookieOptions,
  );
  const effectiveLocaleCookie = useCookie<LocaleCode | null>(
    EFFECTIVE_LOCALE_COOKIE,
    cookieOptions,
  );
  const localePreference = useState<LocalePreference>(
    "locale_preference_state",
    () => normalizeLocalePreference(preferenceCookie.value) ?? "auto",
  );

  const browserLanguageCandidates = (): string[] => {
    if (typeof navigator === "undefined") return [];

    if (navigator.languages?.length) return [...navigator.languages];
    return navigator.language ? [navigator.language] : [];
  };

  const requestLanguageCandidates = (): string[] => {
    if (!import.meta.server) return [];

    const headers = useRequestHeaders(["accept-language"]);
    return parseAcceptLanguage(headers["accept-language"]);
  };

  const detectAutomaticLocale = (): LocaleCode =>
    detectSupportedLocale([
      ...requestLanguageCandidates(),
      ...browserLanguageCandidates(),
    ]);

  const resolveClientEffectiveCookie = (): LocaleCode | null =>
    import.meta.server
      ? null
      : normalizeLocaleCode(effectiveLocaleCookie.value);

  const applyEffectiveLocale = async (locale: LocaleCode): Promise<void> => {
    if (normalizeLocaleCode(unref(i18n.locale)) !== locale) {
      await i18n.setLocale(locale);
    }
    effectiveLocaleCookie.value = locale;
  };

  const resolveLocale = (savedUserLocale: UserLocale = null): LocaleCode => {
    const savedLocale = normalizeLocaleCode(savedUserLocale);
    if (savedLocale) return savedLocale;

    const cookiePreference = normalizeLocalePreference(preferenceCookie.value);
    if (cookiePreference && cookiePreference !== "auto") {
      return cookiePreference;
    }

    return detectAutomaticLocale();
  };

  const resolveInitialLocale = (savedUserLocale: UserLocale): LocaleCode => {
    const savedLocale = normalizeLocaleCode(savedUserLocale);
    if (savedLocale) return savedLocale;

    const cookiePreference = normalizeLocalePreference(preferenceCookie.value);
    if (cookiePreference && cookiePreference !== "auto") {
      return cookiePreference;
    }

    // The server has already resolved Automatic from Accept-Language and
    // mirrored that result into this cookie. Reuse it during hydration so a
    // browser/header disagreement cannot change the rendered language before
    // Vue hydrates. Explicitly choosing Automatic later still performs a fresh
    // browser detection in setLocalePreference().
    const effectiveCookieLocale = resolveClientEffectiveCookie();
    if (effectiveCookieLocale) return effectiveCookieLocale;

    return detectAutomaticLocale();
  };

  const initializeLocale = async (
    savedUserLocale: UserLocale = null,
  ): Promise<LocaleCode> => {
    const savedLocale = normalizeLocaleCode(savedUserLocale);
    const cookiePreference = normalizeLocalePreference(preferenceCookie.value);

    localePreference.value = savedLocale ?? cookiePreference ?? "auto";
    preferenceCookie.value = localePreference.value;

    const locale = resolveInitialLocale(savedLocale);
    await applyEffectiveLocale(locale);
    return locale;
  };

  const setLocalePreference = async (
    preference: LocalePreference,
  ): Promise<LocaleCode> => {
    const normalizedPreference = normalizeLocalePreference(preference);
    if (!normalizedPreference) {
      throw new TypeError(
        `Unsupported locale preference: ${String(preference)}`,
      );
    }

    localePreference.value = normalizedPreference;
    preferenceCookie.value = normalizedPreference;

    const locale =
      normalizedPreference === "auto"
        ? detectAutomaticLocale()
        : normalizedPreference;
    await applyEffectiveLocale(locale);
    return locale;
  };

  const applySavedUserLocale = async (
    savedUserLocale: UserLocale,
    options: SavedUserLocaleOptions = {},
  ): Promise<LocaleCode> => {
    const locale = normalizeLocaleCode(savedUserLocale);
    if (!locale) {
      // A persisted NULL means this account explicitly chose Automatic.
      // Clear any explicit cookie mirrored from a previous account before
      // detecting, otherwise account switching can inherit the old user's
      // language instead of following this browser/request.
      localePreference.value = "auto";
      preferenceCookie.value = "auto";
      const resolvedLocale =
        (options.preferEffectiveCookie && resolveClientEffectiveCookie()) ||
        detectAutomaticLocale();
      await applyEffectiveLocale(resolvedLocale);
      return resolvedLocale;
    }

    localePreference.value = locale;
    preferenceCookie.value = locale;
    await applyEffectiveLocale(locale);
    return locale;
  };

  const effectiveLocale = computed<LocaleCode>(
    () =>
      normalizeLocaleCode(unref(i18n.locale)) ??
      normalizeLocaleCode(effectiveLocaleCookie.value) ??
      DEFAULT_LOCALE,
  );

  const getEffectiveLocale = (): LocaleCode => effectiveLocale.value;

  return {
    localePreference,
    effectiveLocale,
    detectAutomaticLocale,
    resolveLocale,
    initializeLocale,
    setLocalePreference,
    applySavedUserLocale,
    getEffectiveLocale,
  };
};

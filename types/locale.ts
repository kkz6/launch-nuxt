export const SUPPORTED_LOCALES = ["en", "ja"] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];
export type UserLocale = LocaleCode | null;

export const LOCALE_PREFERENCES = ["auto", ...SUPPORTED_LOCALES] as const;
export type LocalePreference = (typeof LOCALE_PREFERENCES)[number];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const LOCALE_PREFERENCE_COOKIE = "locale_preference";
export const EFFECTIVE_LOCALE_COOKIE = "locale";

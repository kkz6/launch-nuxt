import {
  DEFAULT_LOCALE,
  LOCALE_PREFERENCES,
  SUPPORTED_LOCALES,
  type LocaleCode,
  type LocalePreference,
} from "~/types/locale";

export const normalizeLocaleCode = (value: unknown): LocaleCode | null => {
  if (typeof value !== "string") return null;

  const language = value
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .split("-")[0];
  return SUPPORTED_LOCALES.includes(language as LocaleCode)
    ? (language as LocaleCode)
    : null;
};

export const normalizeLocalePreference = (
  value: unknown,
): LocalePreference | null => {
  if (typeof value !== "string") return null;

  const preference = value.trim().toLowerCase();
  return LOCALE_PREFERENCES.includes(preference as LocalePreference)
    ? (preference as LocalePreference)
    : null;
};

export const isLocalePreference = (value: unknown): value is LocalePreference =>
  normalizeLocalePreference(value) !== null;

export const parseAcceptLanguage = (
  header: string | null | undefined,
): string[] => {
  if (!header) return [];

  return header
    .split(",")
    .map((part, index) => {
      const [language, ...parameters] = part.trim().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const parsedQuality = qualityParameter
        ? Number.parseFloat(qualityParameter.trim().slice(2))
        : 1;

      return {
        language,
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
        index,
      };
    })
    .filter(({ language, quality }) => Boolean(language) && quality > 0)
    .sort(
      (left, right) => right.quality - left.quality || left.index - right.index,
    )
    .map(({ language }) => language);
};

export const detectSupportedLocale = (
  candidates: readonly string[],
  fallback: LocaleCode = DEFAULT_LOCALE,
): LocaleCode => {
  for (const candidate of candidates) {
    const locale = normalizeLocaleCode(candidate);
    if (locale) return locale;
  }

  return fallback;
};

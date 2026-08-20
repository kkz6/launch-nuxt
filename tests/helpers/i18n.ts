import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ref } from "vue";

interface MessageTree {
  [key: string]: string | MessageTree;
}

const mergeMessages = (target: MessageTree, source: MessageTree) => {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      target[key] = value;
      continue;
    }
    const branch = target[key];
    if (!branch || typeof branch === "string") target[key] = {};
    mergeMessages(target[key] as MessageTree, value);
  }
};

type TestLocale = "en" | "ja";

const loadMessages = (locale: TestLocale): MessageTree => {
  const messages: MessageTree = {};
  const catalogDir = join(process.cwd(), "i18n", "locales", locale);
  for (const file of readdirSync(catalogDir).filter((name) =>
    name.endsWith(".json"),
  )) {
    mergeMessages(
      messages,
      JSON.parse(readFileSync(join(catalogDir, file), "utf8")),
    );
  }
  return messages;
};

const localeMessages: Record<TestLocale, MessageTree> = {
  en: loadMessages("en"),
  ja: loadMessages("ja"),
};

const resolveMessage = (
  locale: TestLocale,
  key: string,
): string | undefined => {
  let value: string | MessageTree = localeMessages[locale];
  for (const segment of key.split(".")) {
    if (typeof value === "string") return undefined;
    value = value[segment];
    if (value === undefined) return undefined;
  }
  return typeof value === "string" ? value : undefined;
};

export const translate = (
  key: string,
  params: Record<string, unknown> = {},
): string => translateForLocale("en", key, params);

export const translateForLocale = (
  locale: TestLocale,
  key: string,
  params: Record<string, unknown> = {},
): string => {
  const message = resolveMessage(locale, key) ?? key;
  return message.replace(/\{([^}]+)}/g, (_match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : `{${name}}`,
  );
};

export const createI18nStub = (initialLocale: TestLocale = "en") => {
  const locale = ref<TestLocale>(initialLocale);
  return {
    t: (key: string, params: Record<string, unknown> = {}) =>
      translateForLocale(locale.value, key, params),
    locale,
  };
};

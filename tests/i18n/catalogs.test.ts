import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface MessageTree {
  [key: string]: string | MessageTree;
}

const localeRoot = join(process.cwd(), "i18n", "locales");
const readCatalog = (locale: "en" | "ja", file: string): MessageTree =>
  JSON.parse(
    readFileSync(join(localeRoot, locale, file), "utf8"),
  ) as MessageTree;

const flattenMessages = (
  tree: MessageTree,
  prefix = "",
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string"
        ? [[path, value]]
        : Object.entries(flattenMessages(value, path));
    }),
  );

const placeholders = (message: string): string[] =>
  [...message.matchAll(/\{([^}]+)}/g)].map((match) => match[1]).sort();

describe("locale catalogs", () => {
  it("keeps English and Japanese catalog files and message keys in parity", () => {
    const englishFiles = readdirSync(join(localeRoot, "en")).sort();
    const japaneseFiles = readdirSync(join(localeRoot, "ja")).sort();
    expect(japaneseFiles).toEqual(englishFiles);

    for (const file of englishFiles) {
      const english = flattenMessages(readCatalog("en", file));
      const japanese = flattenMessages(readCatalog("ja", file));
      expect(Object.keys(japanese).sort(), file).toEqual(
        Object.keys(english).sort(),
      );

      for (const key of Object.keys(english)) {
        expect(japanese[key].trim(), `${file}:${key}`).not.toBe("");
        expect(placeholders(japanese[key]), `${file}:${key}`).toEqual(
          placeholders(english[key]),
        );
      }
    }
  });

  it("uses endonyms in the language picker", () => {
    const english = flattenMessages(readCatalog("en", "common.json"));
    const japanese = flattenMessages(readCatalog("ja", "common.json"));

    expect(english["common.english"]).toBe("English");
    expect(japanese["common.english"]).toBe("English");
    expect(english["common.japanese"]).toBe("日本語");
    expect(japanese["common.japanese"]).toBe("日本語");
  });
});

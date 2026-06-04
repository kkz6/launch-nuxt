import { describe, it, expect } from "vitest";
import { parseAnsiToHtml } from "~/utils/logs";

// The real-world driver for this: zerolog console output (env=development)
// streams ANSI colour codes that used to render as literal "[32mINF[0m"
// text in the log viewer. parseAnsiToHtml turns them into balanced,
// HTML-escaped coloured spans.
describe("parseAnsiToHtml", () => {
  const ESC = "\x1b";

  it("returns plain text untouched (no ANSI = no spans)", () => {
    expect(parseAnsiToHtml("Starting API server...")).toBe(
      "Starting API server...",
    );
  });

  it("wraps a single colour run in one span and consumes the codes", () => {
    const got = parseAnsiToHtml(`${ESC}[32mINF${ESC}[0m hello`);
    expect(got).toBe('<span class="text-green-400">INF</span> hello');
    // No raw escape text leaks through.
    expect(got).not.toContain("[32m");
    expect(got).not.toContain("\x1b");
  });

  it("keeps spans balanced for a bold+colour combo (zerolog FTL)", () => {
    // ESC[1m ESC[31m FTL ESC[0m — two opens, one reset. A naive
    // code→tag replace leaves an unclosed <span>; we must not.
    const got = parseAnsiToHtml(`${ESC}[1m${ESC}[31mFTL${ESC}[0m boom`);
    expect(got).toBe(
      '<span class="text-red-400 font-bold">FTL</span> boom',
    );
    // Exactly as many closing tags as opening tags.
    const opens = (got.match(/<span/g) || []).length;
    const closes = (got.match(/<\/span>/g) || []).length;
    expect(opens).toBe(closes);
  });

  it("HTML-escapes content so log text can't inject markup", () => {
    const got = parseAnsiToHtml(`${ESC}[31m<img src=x onerror=alert(1)>${ESC}[0m`);
    expect(got).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(got).not.toContain("<img");
  });

  it("drops unknown codes (backgrounds, underline) without emitting them", () => {
    const got = parseAnsiToHtml(`${ESC}[4m${ESC}[44munderlined${ESC}[0m`);
    expect(got).toBe("underlined");
    expect(got).not.toContain("[4");
  });

  it("handles combined SGR params in one sequence (ESC[1;31m)", () => {
    const got = parseAnsiToHtml(`${ESC}[1;31mERR${ESC}[0m`);
    expect(got).toBe('<span class="text-red-400 font-bold">ERR</span>');
  });

  it("returns empty string for empty input", () => {
    expect(parseAnsiToHtml("")).toBe("");
  });
});

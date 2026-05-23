import { describe, it, expect } from "vitest";
import {
  parseDotEnv,
  looksLikeCron,
  isValidPortMapping,
  isValidHostname,
  shellish,
  joinShellArgs,
} from "~/composables/useDockerHelpers";

describe("parseDotEnv", () => {
  it("parses a simple KEY=VALUE list", () => {
    const got = parseDotEnv("FOO=bar\nBAZ=qux");
    expect(got).toEqual([
      { key: "FOO", value: "bar" },
      { key: "BAZ", value: "qux" },
    ]);
  });

  it("skips comments and blank lines", () => {
    const got = parseDotEnv("# heading\n\nFOO=bar\n# trailing");
    expect(got).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("strips `export ` prefixes copied from shell init files", () => {
    expect(parseDotEnv("export FOO=bar")).toEqual([{ key: "FOO", value: "bar" }]);
  });

  it("strips matching single or double quotes around the value", () => {
    expect(parseDotEnv(`FOO='hello world'`)).toEqual([
      { key: "FOO", value: "hello world" },
    ]);
    expect(parseDotEnv(`FOO="hello world"`)).toEqual([
      { key: "FOO", value: "hello world" },
    ]);
    // Mismatched quotes are preserved verbatim — better than silently
    // dropping a quote the user actually meant.
    expect(parseDotEnv(`FOO="oops'`)).toEqual([
      { key: "FOO", value: `"oops'` },
    ]);
  });

  it("rejects lines whose key isn't a POSIX env var name", () => {
    // 1NUM_FIRST, hyphen-key, space in key — all dropped.
    const got = parseDotEnv("1FIRST=x\nbad-key=y\nbad key=z\nGOOD=ok");
    expect(got).toEqual([{ key: "GOOD", value: "ok" }]);
  });

  it("preserves an empty value", () => {
    // Common in .env files for "set but blank" feature flags.
    expect(parseDotEnv("FOO=")).toEqual([{ key: "FOO", value: "" }]);
  });

  it("handles `=` inside the value", () => {
    // Important for connection strings like
    // DATABASE_URL=postgres://u:p@h/db?sslmode=require
    expect(
      parseDotEnv("DATABASE_URL=postgres://u:p@h/db?sslmode=require"),
    ).toEqual([
      {
        key: "DATABASE_URL",
        value: "postgres://u:p@h/db?sslmode=require",
      },
    ]);
  });
});

describe("looksLikeCron", () => {
  it("accepts five-field expressions", () => {
    expect(looksLikeCron("0 * * * *")).toBe(true);
    expect(looksLikeCron("*/5 * * * 1-5")).toBe(true);
    expect(looksLikeCron("   5  10  *  *  *   ")).toBe(true);
  });

  it("rejects wrong field counts and empty input", () => {
    expect(looksLikeCron("")).toBe(false);
    expect(looksLikeCron("0 * * *")).toBe(false); // 4 fields
    expect(looksLikeCron("0 * * * * *")).toBe(false); // 6 fields
    expect(looksLikeCron("@daily")).toBe(false);
  });
});

describe("isValidPortMapping", () => {
  it("accepts simple host:container", () => {
    expect(isValidPortMapping("8080:80")).toBe(true);
  });

  it("accepts protocol suffix", () => {
    expect(isValidPortMapping("5432:5432/tcp")).toBe(true);
    expect(isValidPortMapping("53:53/udp")).toBe(true);
  });

  it("rejects malformed mappings", () => {
    expect(isValidPortMapping("8080")).toBe(false);
    expect(isValidPortMapping("8080:80/sctp")).toBe(false); // unsupported proto
    expect(isValidPortMapping("abc:80")).toBe(false);
    expect(isValidPortMapping("8080:80 extra")).toBe(false);
  });
});

describe("isValidHostname", () => {
  it("accepts ordinary DNS names", () => {
    expect(isValidHostname("api.example.com")).toBe(true);
    expect(isValidHostname("staging-2.api.example.com")).toBe(true);
  });

  it("normalises trailing dot + case", () => {
    expect(isValidHostname("API.EXAMPLE.COM.")).toBe(true);
  });

  it("rejects single-label names", () => {
    // We need at least one dot — bare "localhost" is technically a
    // valid host but useless behind Traefik routing.
    expect(isValidHostname("localhost")).toBe(false);
  });

  it("rejects underscores and leading hyphens", () => {
    expect(isValidHostname("api_v2.example.com")).toBe(false);
    expect(isValidHostname("-api.example.com")).toBe(false);
    expect(isValidHostname("api-.example.com")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidHostname("")).toBe(false);
    expect(isValidHostname("   ")).toBe(false);
  });
});

describe("shellish", () => {
  it("passes through safe-charset args unchanged", () => {
    // Letters, digits, and a handful of common path/url chars are
    // unambiguous in a shell context — no need to quote.
    expect(shellish("traefik")).toBe("traefik");
    expect(shellish("--providers.swarm.network=launch-network")).toBe(
      "--providers.swarm.network=launch-network",
    );
    expect(shellish("/usr/local/bin/entrypoint.sh")).toBe(
      "/usr/local/bin/entrypoint.sh",
    );
  });

  it("quotes args containing whitespace or shell metas", () => {
    expect(shellish("hello world")).toBe(`'hello world'`);
    expect(shellish("a;b")).toBe(`'a;b'`);
    expect(shellish("$HOME")).toBe(`'$HOME'`);
    expect(shellish("a|b")).toBe(`'a|b'`);
  });

  it("escapes embedded single quotes with the close-then-reopen trick", () => {
    // The classic bash escape: 'it'\''s' renders as it's because the
    // shell concatenates the two quoted segments. Anything less
    // careful breaks on names like O'Brien.
    expect(shellish(`it's`)).toBe(`'it'\\''s'`);
  });

  it("represents an empty arg as two single quotes", () => {
    // Distinct from "no arg" — preserving the empty slot matters
    // for some entrypoints that expect a positional placeholder.
    expect(shellish("")).toBe(`''`);
  });
});

describe("joinShellArgs", () => {
  it("returns empty string for null / undefined / empty list", () => {
    expect(joinShellArgs(null)).toBe("");
    expect(joinShellArgs(undefined)).toBe("");
    expect(joinShellArgs([])).toBe("");
  });

  it("joins safe args with single spaces", () => {
    expect(joinShellArgs(["traefik", "--api"])).toBe("traefik --api");
  });

  it("quotes each arg independently before joining", () => {
    // Each element is quoted on its own — joining a list with embedded
    // spaces shouldn't smear the spaces into the wrong arg boundary.
    expect(joinShellArgs(["sh", "-c", "echo hello world"])).toBe(
      `sh -c 'echo hello world'`,
    );
  });
});

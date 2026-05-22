/**
 * Pure helpers shared by docker UI components. Extracted so they can
 * be unit-tested without mounting Vue components — same rationale as
 * useServerTypeRules.
 */

/**
 * Parse a pasted `.env` body into rows ready to send to the bulk-set
 * endpoint. Tolerates:
 *   - blank lines
 *   - `#` comments
 *   - `export FOO=bar` prefixes (people paste these from shell init)
 *   - surrounding single/double quotes around the value
 *
 * Rejects lines that don't look like KEY=VALUE with a POSIX-ish key —
 * silently, by skipping them. Callers should compare the input line
 * count to the output length if they want to surface "we skipped N".
 */
export type ParsedEnvVar = { key: string; value: string };

const envKeyRe = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseDotEnv(text: string): ParsedEnvVar[] {
  const out: ParsedEnvVar[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!envKeyRe.test(key)) continue;
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out.push({ key, value });
  }
  return out;
}

/**
 * Minimum-viable cron syntax check — exactly 5 whitespace-separated
 * fields. Matches the looksLikeCron rule on the Go side intentionally;
 * the host cron daemon catches deeper grammar errors so we don't
 * duplicate them.
 */
export function looksLikeCron(s: string): boolean {
  const fields = s.trim().split(/\s+/);
  if (s.trim() === "") return false;
  return fields.length === 5;
}

/**
 * Host:container port-mapping validation for the Application Advanced
 * extra-ports field. Same regex the Advanced.vue form uses inline,
 * exposed here so a test can pin it.
 */
const portMappingRe = /^\d+:\d+(\/(tcp|udp))?$/;
export function isValidPortMapping(s: string): boolean {
  return portMappingRe.test(s.trim());
}

/**
 * Hostname validator — minimum-RFC-1035-ish, matches the server-side
 * regex in DomainService.validHostname. Domain inputs go through this
 * for immediate feedback before submit.
 */
const hostnameRe =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
export function isValidHostname(s: string): boolean {
  const normalised = s.trim().toLowerCase().replace(/\.$/, "");
  return hostnameRe.test(normalised);
}

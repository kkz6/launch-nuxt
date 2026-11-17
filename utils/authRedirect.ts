export function authRedirect(value: unknown): string | undefined {
  if (value === "/cli/auth") return value;
  if (typeof value !== "string") return;

  const match = /^\/servers\?provision=([0-7][0-9a-hjkmnp-tv-z]{25})$/i.exec(
    value,
  );
  if (match) return `/servers?provision=${match[1]}`;
}

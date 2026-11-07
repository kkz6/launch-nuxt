// Only this account-authorization page may override the normal sign-in destination.
export const cliAuthRedirect = (value: unknown): "/cli/auth" | undefined =>
  value === "/cli/auth" ? "/cli/auth" : undefined;

interface PermissionResponse {
  status: number;
  _data?: unknown;
}

// Only known authorization failures get shared copy. Billing, account status,
// and other forbidden responses keep their own actionable explanations.
export function localizePermissionError(
  response: PermissionResponse,
  translate: (key: string) => string,
): void {
  if (
    response.status !== 403 ||
    !response._data ||
    typeof response._data !== "object"
  )
    return;

  const data = response._data as { code?: unknown; message?: unknown };
  let key: string | undefined;
  if (data.code === "permission.denied") {
    key = "common.permissions.denied";
  } else if (data.code === "permission.read_only") {
    key = "common.permissions.readOnly";
  } else if (!data.code && typeof data.message === "string") {
    // Compatibility with APIs predating permission error codes.
    if (
      /^your team role(?: \((?:Owner|Admin|Editor|Member)\))? lacks permission for this action$/.test(
        data.message,
      )
    ) {
      key = "common.permissions.denied";
    } else if (
      data.message === "Read-only impersonation session" ||
      data.message === "read-only session cannot modify resources"
    ) {
      key = "common.permissions.readOnly";
    }
  }
  if (key) data.message = translate(key);
}

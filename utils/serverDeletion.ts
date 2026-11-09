// Provider response text can contain sensitive details. Only known codes select copy.
export function serverDeletionErrorKey(code: unknown): string {
  if (code === "provider_unauthorized")
    return "admin.serverDetail.deleteProviderUnauthorized";
  if (code === "provider_forbidden")
    return "admin.serverDetail.deleteProviderForbidden";
  return "admin.serverDetail.deleteFailed";
}

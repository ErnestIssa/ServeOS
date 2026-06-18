/** Allow only same-origin relative paths in password-reset / post-auth redirects. */
export function sanitizeReturnTo(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

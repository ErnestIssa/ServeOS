export function sanitizeReturnTo(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  return trimmed;
}

export function readReturnToFromLocation(): string | null {
  return sanitizeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
}

export function inviteEnrollmentReturnPath(token: string): string {
  return `/invite?token=${encodeURIComponent(token)}`;
}

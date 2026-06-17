/** Normalize email for identity lookup — one email = one user. */
export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone toward E.164-style storage.
 * Full libphonenumber is out of scope; we enforce consistent trimming and common prefixes.
 */
export function normalizeAuthPhone(phone: string): string {
  const compact = phone.trim().replace(/[\s\-()]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0") && /^\d+$/.test(compact)) {
    return `+46${compact.slice(1)}`;
  }
  return compact;
}

export function isMergedIdentityEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.startsWith("merged+") && email.endsWith("@serveos.invalid");
}

export function readPendingAccountCompletion(signupProfile: unknown): boolean {
  if (!signupProfile || typeof signupProfile !== "object" || Array.isArray(signupProfile)) return false;
  return Boolean((signupProfile as { pendingAccountCompletion?: boolean }).pendingAccountCompletion);
}

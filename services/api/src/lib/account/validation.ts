export function validatePasswordStrength(password: string): { ok: true } | { ok: false; error: string } {
  if (password.length < 8) return { ok: false, error: "password_too_short" };
  if (!/[a-z]/.test(password)) return { ok: false, error: "password_needs_lowercase" };
  if (!/[A-Z]/.test(password)) return { ok: false, error: "password_needs_uppercase" };
  if (!/[0-9]/.test(password)) return { ok: false, error: "password_needs_number" };
  return { ok: true };
}

export function validatePhone(phone: string): boolean {
  const v = phone.trim();
  if (v.length < 7 || v.length > 20) return false;
  return /^\+?[0-9\s\-()]+$/.test(v);
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, " ");
}

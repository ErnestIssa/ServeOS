import type { AuthUser } from "../../api";

export function profileFirstName(user: AuthUser | null): string {
  if (!user) return "Guest";
  const sp = user.signupProfile;
  if (sp && typeof sp === "object") {
    const first = String((sp as { firstName?: string }).firstName ?? "").trim();
    if (first) return first;
  }
  const email = user.email?.trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "Guest";
}

export function profileFullName(user: AuthUser | null): string {
  if (!user) return "Guest";
  const sp = user.signupProfile;
  if (sp && typeof sp === "object") {
    const o = sp as { firstName?: string; lastName?: string };
    const first = String(o.firstName ?? "").trim();
    const last = String(o.lastName ?? "").trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
  }
  const email = user.email?.trim();
  if (email) return email;
  return "Guest";
}

export function profileInitial(user: AuthUser | null): string {
  const name = profileFullName(user);
  return (name.charAt(0) || "G").toUpperCase();
}

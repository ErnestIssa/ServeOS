/**
 * `EXPO_PUBLIC_API_URL` → unified API, e.g. `http://192.168.x.x:3000` (LAN) or
 * `https://serveos-api.onrender.com` for production / EAS.
 * Common typo `http//host` (missing colon) is fixed automatically.
 *
 * - **__DEV__** and env unset: `http://127.0.0.1:3000` (simulator / emulators; use EXPO on a real device).
 * - **Release** and env unset: hosted API on Render.
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

function fixUrlScheme(s: string): string {
  const t = s.trim();
  if (/^https\/\//i.test(t)) return t.replace(/^https\/\//i, "https://");
  if (/^http\/\//.test(t)) return t.replace(/^http\/\//, "http://");
  if (/^https:\/(?!\/)/.test(t)) return t.replace(/^https:\//, "https://");
  if (/^http:\/(?!\/)/.test(t)) return t.replace(/^http:\//, "http://");
  return t;
}

function normalizeBase(u: string) {
  return u.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  if (fromEnv && fromEnv.length > 0) return normalizeBase(fixUrlScheme(fromEnv));
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return "http://127.0.0.1:3000";
  }
  return "https://serveos-api.onrender.com";
}

export const API_URL = getApiBaseUrl();

export function apiHttpToWsBase(u: string) {
  const t = u.trim();
  if (t.startsWith("https://")) return `wss://${t.slice(8)}`;
  if (t.startsWith("http://")) return `ws://${t.slice(7)}`;
  return `ws://${t}`;
}

export type AuthUser = { id: string; email?: string | null; phone?: string | null; role: string };

export type AuthResponse = { ok: boolean; token?: string; user?: AuthUser; error?: string };
export type MeResponse = { ok: boolean; user?: AuthUser; error?: string };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return { ok: false, error: text ? "bad_response" : "empty_response" } as T;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "request_failed";
    if (/network|failed to fetch|load failed|aborted|unable to resolve/i.test(msg) || msg === "Aborted") {
      return {
        ok: false,
        error: "network_unreachable — check EXPO_PUBLIC_API_URL (use http://192.168.x.x:3000 on a phone, fix http// typos) or that the API is running"
      } as T;
    }
    return { ok: false, error: msg } as T;
  }
}

export async function authLogin(params: { email: string; password: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: params.email, password: params.password })
  });
}

export async function authSignup(params: { email: string; password: string; role: "OWNER" | "STAFF" | "CUSTOMER" }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: params.email, password: params.password, role: params.role })
  });
}

export async function authMe(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

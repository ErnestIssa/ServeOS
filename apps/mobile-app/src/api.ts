/**
 * `EXPO_PUBLIC_API_URL` → your API (e.g. https://serveos-api.onrender.com or http://192.168.x.x:3000 for local).
 * If unset, production builds and physical devices use the hosted API so auth works out of the box.
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

function normalizeBase(u: string) {
  return u.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  if (fromEnv && fromEnv.length > 0) return normalizeBase(fromEnv);
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
      return { ok: false, error: "network_unreachable_check_expo_public_api_url" } as T;
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

/**
 * Production API only (see `docs/deploymentArchitecture.md`). No local / env override —
 * a stray `EXPO_PUBLIC_API_URL` in `.env` was easy to misconfigure; use this constant for dev and release.
 */
const API_BASE = "https://serveos-api.onrender.com";

export function getApiBaseUrl(): string {
  return API_BASE;
}

export const API_URL = getApiBaseUrl();

export function apiHttpToWsBase(u: string) {
  const t = u.trim();
  if (t.startsWith("https://")) return `wss://${t.slice(8)}`;
  if (t.startsWith("http://")) return `ws://${t.slice(7)}`;
  return `ws://${t}`;
}

export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  signupProfile?: unknown | null;
  /** Server-held customer venue preference; source of truth for “current restaurant”. */
  preferredRestaurantId?: string | null;
};

export type AuthResponse = { ok: boolean; token?: string; user?: AuthUser; error?: string };
export type MeResponse = { ok: boolean; user?: AuthUser; error?: string };

export type CompanyLookupResponse =
  | {
      success: true;
      found: true;
      data: {
        companyName?: string;
        address?: string;
        postalCode?: string;
        city?: string;
        legalForm?: string;
        status?: string;
        vatNumber?: string;
        source?: string;
      };
    }
  | { success: true; found: false }
  | { success: false; message: string };

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
    if (
      /network|failed to fetch|load failed|aborted|unable to resolve|Network request failed|timed out|timeout/i.test(
        msg
      ) ||
      msg === "Aborted"
    ) {
      return {
        ok: false,
        error: "Can’t reach the API. Check Wi‑Fi or VPN, then try again."
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

export async function authSignup(params: {
  email: string;
  password: string;
  role: "OWNER" | "STAFF" | "CUSTOMER";
  phone?: string;
  registrationProfile?: Record<string, unknown>;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      role: params.role,
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.registrationProfile ? { registrationProfile: params.registrationProfile } : {})
    })
  });
}

export async function authMe(token: string): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
}

export type CustomerRestaurantRow = { id: string; name: string; openingHours?: string | null };

export type CustomerDirectoryResponse =
  | { ok: true; restaurants: CustomerRestaurantRow[] }
  | { ok: false; error?: string };

export async function fetchCustomerRestaurantDirectory(token: string): Promise<CustomerDirectoryResponse> {
  return apiFetch<CustomerDirectoryResponse>("/customer/restaurant-directory", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export type PatchPreferredRestaurantResponse =
  | { ok: true; preferredRestaurantId: string; restaurantName: string }
  | { ok: false; error?: string };

export async function patchCustomerPreferredRestaurant(
  token: string,
  restaurantId: string
): Promise<PatchPreferredRestaurantResponse> {
  return apiFetch<PatchPreferredRestaurantResponse>("/customer/preferred-restaurant", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ restaurantId })
  });
}

export async function lookupCompany(orgNumber: string): Promise<CompanyLookupResponse> {
  return apiFetch<CompanyLookupResponse>("/api/business/lookup-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgNumber })
  });
}

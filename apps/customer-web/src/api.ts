const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "https://serveos-api.onrender.com";

export function getApiBaseUrl(): string {
  return API_BASE.replace(/\/$/, "");
}

export type AuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  signupProfile?: unknown | null;
};

export type AuthResponse = { ok: boolean; token?: string; user?: AuthUser; error?: string };

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
      };
    }
  | { success: true; found: false }
  | { success: false; message: string };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, init);
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return { ok: false, error: text ? "bad_response" : "empty_response" } as T;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "request_failed";
    if (/network|failed to fetch|timed out|timeout/i.test(msg)) {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." } as T;
    }
    return { ok: false, error: msg } as T;
  }
}

export async function authSignup(params: {
  email: string;
  password: string;
  role: "OWNER" | "CUSTOMER";
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

export async function lookupCompany(orgNumber: string): Promise<CompanyLookupResponse> {
  return apiFetch<CompanyLookupResponse>("/api/business/lookup-company", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgNumber })
  });
}

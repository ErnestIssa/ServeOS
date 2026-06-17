import { getApiBaseUrl } from "../api";
import { readStoredAdminToken } from "../authStorage";
import type { CommunicationPreferencesState } from "./communicationCategories";

export type CommunicationPreferencesPreview = {
  ok: true;
  tokenValid: boolean;
  emailMasked: string;
  email: string;
  workspaces: string[];
  preferences: CommunicationPreferencesState;
  lastUpdatedAt: string;
};

type PreviewFail = {
  ok: false;
  error: string;
  emailMasked?: string;
};

function authHeaders(): Record<string, string> {
  const token = readStoredAdminToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { ok: false, error: text || "bad_response" } as T;
  }
}

export async function fetchCommunicationPreferences(
  token?: string
): Promise<CommunicationPreferencesPreview | PreviewFail> {
  if (token) {
    const res = await fetch(
      `${getApiBaseUrl()}/communication-preferences?token=${encodeURIComponent(token)}`
    );
    return parseJson(res);
  }

  const res = await fetch(`${getApiBaseUrl()}/communication-preferences/session`, {
    headers: authHeaders()
  });
  return parseJson(res);
}

export async function saveCommunicationPreferences(input: {
  token?: string;
  emailPrefs?: Partial<CommunicationPreferencesState["email"]>;
  inAppPrefs?: Partial<CommunicationPreferencesState["inApp"]>;
  source?: string;
}): Promise<CommunicationPreferencesPreview | PreviewFail> {
  const res = await fetch(`${getApiBaseUrl()}/communication-preferences`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(input)
  });
  return parseJson(res);
}

export async function unsubscribeAllNonEssential(input: {
  token?: string;
  source?: string;
}): Promise<CommunicationPreferencesPreview | PreviewFail> {
  const res = await fetch(`${getApiBaseUrl()}/communication-preferences/unsubscribe-all`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input)
  });
  return parseJson(res);
}

export async function enableAllCommunications(input: {
  token?: string;
  source?: string;
}): Promise<CommunicationPreferencesPreview | PreviewFail> {
  const res = await fetch(`${getApiBaseUrl()}/communication-preferences/enable-all`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input)
  });
  return parseJson(res);
}

export async function requestPreferencesLookup(email: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${getApiBaseUrl()}/communication-preferences/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  return parseJson(res);
}

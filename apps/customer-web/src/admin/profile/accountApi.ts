import { readApiMessage } from "../../bootstrap/clientConfig";
import { getApiBaseUrl } from "../../api";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } as const;
}

async function meFetch<T>(token: string, path: string, init?: RequestInit): Promise<T & { ok: boolean; error?: string }> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) }
  });
  const data = (await res.json().catch(() => ({}))) as T & { ok: boolean; error?: string };
  if (!res.ok && data.ok !== false) return { ...data, ok: false, error: data.error ?? `http_${res.status}` };
  return data;
}

export type AccountBundle = {
  userId: string;
  email: string | null;
  phone: string | null;
  role: string;
  fullName: string | null;
  jobTitle: string | null;
  profileImageUrl: string | null;
  profileUpdatedAt: string;
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    theme: string;
  };
  twoFactor: {
    enabled: boolean;
    lastVerifiedAt: string | null;
    enabledAt: string | null;
    backupCodesGenerated: boolean;
  };
  venues: Array<{ id: string; name: string; role: string }>;
};

export type UserSessionRow = {
  id: string;
  deviceName: string;
  browser: string;
  ipMasked: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
};

export type SecurityActivityRow = {
  id: string;
  type: string;
  label: string;
  ipMasked: string | null;
  createdAt: string;
};

export type PermissionsOverview = {
  platformRole: string;
  venueRole: string;
  venueName: string | null;
  highlights: Array<{ key: string; label: string; granted: boolean }>;
};

export async function fetchAccountProfile(token: string) {
  return meFetch<{ account?: AccountBundle; notificationPreferences?: unknown }>(token, "/me");
}

export async function patchAccountProfile(
  token: string,
  body: { fullName?: string; phone?: string; jobTitle?: string }
) {
  return meFetch<{ account?: AccountBundle }>(token, "/me", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export async function uploadProfileImage(token: string, file: File) {
  const contentType = file.type || "image/jpeg";
  const session = await meFetch<{ upload?: { imageKey: string; maxBytes: number } }>(
    token,
    "/me/profile-image/upload-session",
    { method: "POST", body: JSON.stringify({ contentType }) }
  );
  if (!session.ok || !session.upload) return { ok: false as const, error: session.error ?? "upload_session_failed" };

  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  return meFetch<{ ok: boolean; profileImageUrl?: string; error?: string }>(token, "/me/profile-image", {
    method: "POST",
    body: JSON.stringify({
      imageKey: session.upload.imageKey,
      dataBase64,
      contentType
    })
  });
}

export async function requestEmailChange(token: string, newEmail: string, password: string) {
  return meFetch(token, "/me/email", {
    method: "PATCH",
    body: JSON.stringify({ newEmail, password })
  });
}

export async function confirmEmailChange(token: string, changeToken: string) {
  const res = await fetch(`${getApiBaseUrl()}/me/email/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: changeToken })
  });
  return (await res.json()) as { ok: boolean; token?: string; email?: string; error?: string };
}

export async function changePassword(
  token: string,
  body: { currentPassword: string; newPassword: string; confirmPassword: string }
) {
  return meFetch(token, "/me/password", { method: "PATCH", body: JSON.stringify(body) });
}

export async function fetchSessions(token: string) {
  return meFetch<{ sessions?: UserSessionRow[] }>(token, "/me/sessions");
}

export async function revokeSession(token: string, sessionId: string) {
  return meFetch(token, `/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

export async function revokeOtherSessions(token: string) {
  return meFetch<{ revokedCount?: number }>(token, "/me/sessions/revoke-others", { method: "POST" });
}

export async function setupTwoFactor(token: string) {
  return meFetch<{ otpauthUrl?: string; secretPreview?: string }>(token, "/me/2fa/setup", {
    method: "POST",
    body: "{}"
  });
}

export async function enableTwoFactor(token: string, code: string) {
  return meFetch<{ backupCodes?: string[] }>(token, "/me/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function disableTwoFactor(token: string, password: string, code?: string) {
  return meFetch(token, "/me/2fa/disable", {
    method: "POST",
    body: JSON.stringify({ password, code })
  });
}

export async function fetchSecurityActivity(token: string, days = 90) {
  return meFetch<{ activity?: SecurityActivityRow[] }>(token, `/me/security-activity?days=${days}`);
}

export async function fetchPermissionsOverview(token: string) {
  return meFetch<{ permissions?: PermissionsOverview }>(token, "/me/permissions");
}

export async function fetchMePreferences(token: string) {
  return meFetch<{
    appPreferences?: AccountBundle["preferences"];
    notificationPreferences?: {
      pushEnabled: boolean;
      emailEnabled: boolean;
      smsEnabled: boolean;
      categoryFlags?: Record<string, boolean>;
    };
  }>(token, "/me/preferences");
}

export async function patchMePreferences(
  token: string,
  body: {
    language?: string;
    timezone?: string;
    dateFormat?: string;
    timeFormat?: "12h" | "24h";
    theme?: "system" | "light" | "dark";
    notificationPreferences?: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      categoryFlags?: Record<string, boolean>;
    };
  }
) {
  return meFetch(token, "/me/preferences", { method: "PATCH", body: JSON.stringify(body) });
}

export async function requestOwnershipTransfer(
  token: string,
  body: { toEmail: string; restaurantId: string; password: string; twoFaCode?: string }
) {
  return meFetch(token, "/me/ownership-transfer", { method: "POST", body: JSON.stringify(body) });
}

export async function requestAccountClosure(token: string, password: string, reason?: string) {
  return meFetch(token, "/me/account-closure", {
    method: "POST",
    body: JSON.stringify({ password, reason })
  });
}

export { readApiMessage };

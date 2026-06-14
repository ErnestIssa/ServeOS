import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ServiceAccount } from "firebase-admin/app";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

export type SendPushParams = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type SendPushResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; invalidToken?: boolean };

let firebaseApp: App | null = null;

function parseServiceAccountJson(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadFirebaseServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) {
    const parsed = parseServiceAccountJson(inline);
    if (parsed) return parsed;
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (path) {
    try {
      const abs = resolve(path);
      const raw = readFileSync(abs, "utf8");
      return parseServiceAccountJson(raw);
    } catch {
      return null;
    }
  }

  return null;
}

export function isPushProviderConfigured(): boolean {
  return Boolean(loadFirebaseServiceAccount());
}

function getMessagingClient(): Messaging | null {
  const account = loadFirebaseServiceAccount();
  if (!account) return null;

  if (!firebaseApp) {
    firebaseApp =
      getApps()[0] ??
      initializeApp({
        credential: cert(account),
        projectId: account.project_id
      });
  }

  return getMessaging(firebaseApp);
}

function asFcmData(data?: Record<string, string>): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = String(value ?? "");
  }
  return out;
}

/** Send a single device notification via FCM HTTP v1 (Firebase Admin SDK). */
export async function sendPushNotification(params: SendPushParams): Promise<SendPushResult> {
  const messaging = getMessagingClient();
  if (!messaging) {
    return { ok: false, error: "fcm_not_configured" };
  }

  try {
    const messageId = await messaging.send({
      token: params.token,
      notification: {
        title: params.title,
        body: params.body
      },
      data: asFcmData(params.data),
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "serveos_default"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      }
    });
    return { ok: true, messageId };
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    const message = err instanceof Error ? err.message : String(err);
    const invalidToken =
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/invalid-argument";
    return { ok: false, error: code || message, invalidToken };
  }
}

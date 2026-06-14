import { getApiBaseUrl } from "../api";

export type PublicClientConfig = {
  ok: true;
  environment: string;
  urls: {
    customerWeb: string | null;
    webAdmin: string | null;
    apiPublic: string | null;
  };
  observability: {
    sentry: {
      enabled: boolean;
      dsn: string | null;
      tracesSampleRate: number;
      environment: string;
      release: string | null;
    };
  };
  capabilities: {
    pushNotifications: boolean;
    transactionalEmail: boolean;
    objectStorage: boolean;
    mediaCdnCache: boolean;
    smsNotifications: boolean;
  };
};

let cached: PublicClientConfig | null = null;

export async function loadClientConfig(): Promise<PublicClientConfig | null> {
  if (cached) return cached;
  try {
    const res = await fetch(`${getApiBaseUrl()}/config/client`);
    if (!res.ok) return null;
    const data = (await res.json()) as PublicClientConfig;
    if (data?.ok) {
      cached = data;
      return data;
    }
  } catch {
    /* API unreachable during bootstrap */
  }
  return null;
}

export function getClientConfig(): PublicClientConfig | null {
  return cached;
}

/** Prefer backend `message`; never map error codes on the client. */
export function readApiMessage(res?: { message?: string; error?: string } | null): string {
  if (!res) return "Something went wrong. Try again.";
  const message = res.message?.trim();
  if (message) return message;
  const error = res.error?.trim();
  if (error && /reach the API|reach the server|Network request failed|timed out|timeout|ECONNREFUSED|Failed to fetch|network/i.test(error)) {
    return "Couldn't reach the server. Check Wi-Fi, or wait 30–60s if the backend was asleep, then try again.";
  }
  return error || "Something went wrong. Try again.";
}

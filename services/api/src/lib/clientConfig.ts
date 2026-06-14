import { isEmailProviderConfigured } from "./integrations/emailProvider.js";
import { isCloudflareCdnConfigured } from "./integrations/cloudflareCdn.js";
import { isObjectStorageConfigured } from "./integrations/objectStorage.js";
import { isPushProviderConfigured } from "./integrations/pushProvider.js";
import { isSmsProviderConfigured } from "./integrations/smsProvider.js";
import { isSentryEnabled } from "./integrations/sentry.js";

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

function trimUrl(v?: string | null): string | null {
  const t = v?.trim();
  return t || null;
}

/** Public runtime config for web/mobile clients — all service setup comes from backend `.env`. */
export function buildPublicClientConfig(): PublicClientConfig {
  const sentryDsn = trimUrl(process.env.SENTRY_CLIENT_DSN) ?? trimUrl(process.env.SENTRY_DSN);
  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1");

  return {
    ok: true,
    environment: process.env.NODE_ENV ?? "development",
    urls: {
      customerWeb: trimUrl(process.env.CUSTOMER_WEB_URL),
      webAdmin: trimUrl(process.env.WEB_ADMIN_URL),
      apiPublic: trimUrl(process.env.API_PUBLIC_URL) ?? trimUrl(process.env.CUSTOMER_WEB_URL)
    },
    observability: {
      sentry: {
        enabled: isSentryEnabled(),
        dsn: sentryDsn,
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
        environment: process.env.NODE_ENV ?? "development",
        release: trimUrl(process.env.SENTRY_RELEASE)
      }
    },
    capabilities: {
      pushNotifications: isPushProviderConfigured(),
      transactionalEmail: isEmailProviderConfigured(),
      objectStorage: isObjectStorageConfigured(),
      mediaCdnCache: isCloudflareCdnConfigured(),
      smsNotifications: isSmsProviderConfigured()
    }
  };
}

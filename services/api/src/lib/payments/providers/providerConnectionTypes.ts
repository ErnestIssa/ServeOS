import type { EncryptedSecret } from "./credentialVault.js";

export type ProviderConnectionId = "stripe" | "swish" | "terminals";

export type ProviderVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "failed"
  | "expired"
  | "revoked";

export type ProviderHealthStatus = "unknown" | "healthy" | "degraded" | "unavailable";

/**
 * Persisted connection record. Secrets are ciphertext only.
 * Public APIs must return masked projections — never decrypt into responses.
 */
export type PaymentProviderConnectionRecord = {
  provider: ProviderConnectionId;
  connected: boolean;
  displayName?: string;
  environment: "sandbox" | "production";
  publicMerchantId?: string;
  publicAccountId?: string;
  /** Encrypted API secret / cert material — never expose. */
  encryptedApiSecret?: EncryptedSecret | null;
  encryptedCertificate?: EncryptedSecret | null;
  encryptedWebhookSecret?: EncryptedSecret | null;
  hasApiSecret: boolean;
  hasCertificate: boolean;
  hasWebhookSecret: boolean;
  verificationStatus: ProviderVerificationStatus;
  verifiedAt: string | null;
  verificationExpiresAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  nextRequiredAction: string | null;
  health: ProviderHealthStatus;
  lastHealthCheckAt: string | null;
  lastHealthyAt: string | null;
  connectedAt: string | null;
  configuredByUserId?: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
};

export type PaymentProviderConnectionPublic = {
  provider: ProviderConnectionId;
  connected: boolean;
  displayName?: string;
  environment: "sandbox" | "production";
  merchantId: string | null;
  accountId: string | null;
  apiSecret: "Configured" | "Not configured" | string;
  certificate: "Configured" | "Not configured";
  webhookSecret: "Configured" | "Not configured";
  verificationStatus: ProviderVerificationStatus;
  verifiedAt: string | null;
  verificationExpiresAt: string | null;
  failureCode: string | null;
  failureReason: string | null;
  nextRequiredAction: string | null;
  health: ProviderHealthStatus;
  lastHealthCheckAt: string | null;
  connectedAt: string | null;
  rotatedAt: string | null;
};

export function emptyConnection(provider: ProviderConnectionId): PaymentProviderConnectionRecord {
  return {
    provider,
    connected: false,
    environment: "sandbox",
    hasApiSecret: false,
    hasCertificate: false,
    hasWebhookSecret: false,
    verificationStatus: "unverified",
    verifiedAt: null,
    verificationExpiresAt: null,
    failureCode: null,
    failureReason: null,
    nextRequiredAction: "CONNECT_ADAPTER",
    health: "unknown",
    lastHealthCheckAt: null,
    lastHealthyAt: null,
    connectedAt: null,
    configuredByUserId: null,
    rotatedAt: null,
    revokedAt: null,
    encryptedApiSecret: null,
    encryptedCertificate: null,
    encryptedWebhookSecret: null
  };
}

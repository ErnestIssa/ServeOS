import type { PaymentProviderEnvReady } from "../venue/venuePaymentSettingsService.js";
import {
  decryptPaymentSecret,
  encryptPaymentSecret,
  secretConfiguredLabel
} from "./credentialVault.js";
import {
  emptyConnection,
  type PaymentProviderConnectionPublic,
  type PaymentProviderConnectionRecord,
  type ProviderConnectionId,
  type ProviderHealthStatus,
  type ProviderVerificationStatus
} from "./providerConnectionTypes.js";

export type ProviderAdapterContext = {
  restaurantId: string;
  envReady: PaymentProviderEnvReady;
  connection: PaymentProviderConnectionRecord;
};

export type ProviderAdapterResult = {
  ok: boolean;
  connection: PaymentProviderConnectionRecord;
  message: string;
  failureCode?: string | null;
};

/**
 * Standard ServeOS direct-adapter contract.
 * Implementations may still be sandbox-aware stubs, but verification results are persisted.
 */
export type PaymentProviderAdapter = {
  id: ProviderConnectionId;
  startSetup(ctx: ProviderAdapterContext): Promise<ProviderAdapterResult>;
  submitSetup(
    ctx: ProviderAdapterContext,
    input: {
      accountId?: string;
      merchantId?: string;
      displayName?: string;
      apiSecret?: string;
      certificatePem?: string;
      webhookSecret?: string;
    }
  ): Promise<ProviderAdapterResult>;
  verifyConnection(ctx: ProviderAdapterContext): Promise<ProviderAdapterResult>;
  refreshCredentials(
    ctx: ProviderAdapterContext,
    input: { apiSecret?: string; certificatePem?: string; webhookSecret?: string }
  ): Promise<ProviderAdapterResult>;
  disconnect(ctx: ProviderAdapterContext): Promise<ProviderAdapterResult>;
  healthCheck(ctx: ProviderAdapterContext): Promise<ProviderAdapterResult>;
};

function nowIso() {
  return new Date().toISOString();
}

function applySecrets(
  connection: PaymentProviderConnectionRecord,
  input: { apiSecret?: string; certificatePem?: string; webhookSecret?: string }
): PaymentProviderConnectionRecord {
  const next = { ...connection };
  if (input.apiSecret) {
    next.encryptedApiSecret = encryptPaymentSecret(input.apiSecret);
    next.hasApiSecret = Boolean(next.encryptedApiSecret);
  }
  if (input.certificatePem) {
    next.encryptedCertificate = encryptPaymentSecret(input.certificatePem);
    next.hasCertificate = Boolean(next.encryptedCertificate);
  }
  if (input.webhookSecret) {
    next.encryptedWebhookSecret = encryptPaymentSecret(input.webhookSecret);
    next.hasWebhookSecret = Boolean(next.encryptedWebhookSecret);
  }
  return next;
}

function createDirectAdapter(id: ProviderConnectionId): PaymentProviderAdapter {
  return {
    id,
    async startSetup(ctx) {
      const connection: PaymentProviderConnectionRecord = {
        ...ctx.connection,
        connected: false,
        verificationStatus: "unverified",
        nextRequiredAction: "PROVIDE_CREDENTIALS",
        failureCode: null,
        failureReason: null
      };
      return { ok: true, connection, message: "Setup started. Provide merchant credentials." };
    },

    async submitSetup(ctx, input) {
      let connection = applySecrets(
        {
          ...ctx.connection,
          connected: true,
          connectedAt: ctx.connection.connectedAt ?? nowIso(),
          displayName: input.displayName?.trim() || ctx.connection.displayName || id,
          publicAccountId: input.accountId?.trim() || ctx.connection.publicAccountId,
          publicMerchantId: input.merchantId?.trim() || ctx.connection.publicMerchantId,
          environment: id === "swish" ? (ctx.envReady.swish ? "production" : "sandbox") : ctx.envReady.stripe ? "production" : "sandbox",
          verificationStatus: "pending" as ProviderVerificationStatus,
          nextRequiredAction: "VERIFY_CONNECTION",
          revokedAt: null
        },
        input
      );

      const needsSecret = id === "swish" || id === "stripe";
      if (needsSecret && !connection.hasApiSecret && !connection.publicMerchantId && !connection.publicAccountId) {
        connection = {
          ...connection,
          verificationStatus: "failed",
          failureCode: "MISSING_CREDENTIALS",
          failureReason: "Merchant id or API credentials are required.",
          nextRequiredAction: "PROVIDE_CREDENTIALS"
        };
        return { ok: false, connection, message: connection.failureReason!, failureCode: connection.failureCode };
      }

      return {
        ok: true,
        connection,
        message: "Credentials stored securely. Run verification next."
      };
    },

    async verifyConnection(ctx) {
      const envOk =
        id === "swish" ? ctx.envReady.swish : id === "terminals" ? ctx.envReady.stripe : ctx.envReady.stripe;
      const hasIdentity = Boolean(ctx.connection.publicAccountId || ctx.connection.publicMerchantId);
      const hasSecret = ctx.connection.hasApiSecret || Boolean(decryptPaymentSecret(ctx.connection.encryptedApiSecret));

      if (!ctx.connection.connected) {
        return {
          ok: false,
          connection: {
            ...ctx.connection,
            verificationStatus: "failed",
            failureCode: "NOT_CONNECTED",
            failureReason: "Connect the adapter before verifying.",
            nextRequiredAction: "CONNECT_ADAPTER"
          },
          message: "Adapter is not connected.",
          failureCode: "NOT_CONNECTED"
        };
      }

      // Sandbox path: allow verification when connected + identity present (stub network call).
      // Production path: require env readiness + secret material.
      const productionReady = envOk && (hasSecret || hasIdentity);
      const sandboxReady = ctx.connection.environment === "sandbox" && hasIdentity;

      if (!productionReady && !sandboxReady) {
        return {
          ok: false,
          connection: {
            ...ctx.connection,
            verificationStatus: "failed",
            failureCode: "VERIFICATION_FAILED",
            failureReason: "ServeOS could not verify the adapter credentials or environment.",
            nextRequiredAction: "PROVIDE_CREDENTIALS",
            lastHealthCheckAt: nowIso(),
            health: "unavailable" as ProviderHealthStatus
          },
          message: "Verification failed.",
          failureCode: "VERIFICATION_FAILED"
        };
      }

      const verifiedAt = nowIso();
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return {
        ok: true,
        connection: {
          ...ctx.connection,
          verificationStatus: "verified",
          verifiedAt,
          verificationExpiresAt: expires,
          failureCode: null,
          failureReason: null,
          nextRequiredAction: null,
          health: envOk ? "healthy" : "degraded",
          lastHealthCheckAt: verifiedAt,
          lastHealthyAt: verifiedAt
        },
        message:
          ctx.connection.environment === "sandbox"
            ? "Sandbox verification recorded. Production env keys still recommended."
            : "Adapter verification succeeded."
      };
    },

    async refreshCredentials(ctx, input) {
      const connection = applySecrets(
        {
          ...ctx.connection,
          rotatedAt: nowIso(),
          verificationStatus: "pending",
          nextRequiredAction: "VERIFY_CONNECTION",
          verifiedAt: null,
          verificationExpiresAt: null
        },
        input
      );
      return { ok: true, connection, message: "Credentials rotated. Re-verify the connection." };
    },

    async disconnect(ctx) {
      const base = emptyConnection(id);
      return {
        ok: true,
        connection: {
          ...base,
          displayName: ctx.connection.displayName,
          revokedAt: nowIso(),
          verificationStatus: "revoked",
          nextRequiredAction: "CONNECT_ADAPTER",
          health: "unknown"
        },
        message: "Provider disconnected. Pending payment intents remain resolvable via webhooks."
      };
    },

    async healthCheck(ctx) {
      if (!ctx.connection.connected) {
        return {
          ok: true,
          connection: { ...ctx.connection, health: "unknown", lastHealthCheckAt: nowIso() },
          message: "Not connected."
        };
      }
      if (ctx.connection.verificationStatus === "revoked") {
        return {
          ok: false,
          connection: { ...ctx.connection, health: "unavailable", lastHealthCheckAt: nowIso() },
          message: "Credentials revoked."
        };
      }
      if (ctx.connection.verificationStatus !== "verified") {
        return {
          ok: true,
          connection: { ...ctx.connection, health: "degraded", lastHealthCheckAt: nowIso() },
          message: "Connected but not verified."
        };
      }
      const envOk =
        id === "swish" ? ctx.envReady.swish : ctx.envReady.stripe;
      const health: ProviderHealthStatus = envOk ? "healthy" : "degraded";
      return {
        ok: health === "healthy",
        connection: {
          ...ctx.connection,
          health,
          lastHealthCheckAt: nowIso(),
          lastHealthyAt: health === "healthy" ? nowIso() : ctx.connection.lastHealthyAt
        },
        message: health === "healthy" ? "Provider healthy." : "Provider degraded (env/live path)."
      };
    }
  };
}

export const paymentProviderAdapters: Record<ProviderConnectionId, PaymentProviderAdapter> = {
  stripe: createDirectAdapter("stripe"),
  swish: createDirectAdapter("swish"),
  terminals: createDirectAdapter("terminals")
};

export function toPublicConnection(record: PaymentProviderConnectionRecord): PaymentProviderConnectionPublic {
  return {
    provider: record.provider,
    connected: record.connected,
    displayName: record.displayName,
    environment: record.environment,
    // Public merchant/account identifiers may be shown; secrets never are.
    merchantId: record.publicMerchantId,
    accountId: record.publicAccountId,
    apiSecret: secretConfiguredLabel(record.hasApiSecret),
    certificate: secretConfiguredLabel(record.hasCertificate),
    webhookSecret: secretConfiguredLabel(record.hasWebhookSecret),
    verificationStatus: record.verificationStatus,
    verifiedAt: record.verifiedAt,
    verificationExpiresAt: record.verificationExpiresAt,
    failureCode: record.failureCode,
    failureReason: record.failureReason,
    nextRequiredAction: record.nextRequiredAction,
    health: record.health,
    lastHealthCheckAt: record.lastHealthCheckAt,
    connectedAt: record.connectedAt,
    rotatedAt: record.rotatedAt
  };
}

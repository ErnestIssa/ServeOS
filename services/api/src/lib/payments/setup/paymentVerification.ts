import type { PrismaClient } from "@prisma/client";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";
import { paymentProviderAdapters } from "../providers/providerAdapter.js";
import { emptyConnection, type ProviderConnectionId } from "../providers/providerConnectionTypes.js";
import { getCatalogEntry } from "../catalog/paymentMethodCatalog.js";
import {
  getPaymentProviderEnvReady,
  updateVenuePaymentSettings,
  type VenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";

function adapterToConnectionId(
  adapterId: "card" | "swish" | "klarna" | "terminal" | "native"
): ProviderConnectionId | null {
  if (adapterId === "card" || adapterId === "klarna") return "stripe";
  if (adapterId === "swish") return "swish";
  if (adapterId === "terminal") return "terminals";
  return null;
}

/** Read-only verification snapshot (no persistence). */
export function verifyAdapterConnection(
  settings: VenuePaymentSettings,
  adapterId: "card" | "swish" | "klarna" | "terminal" | "native"
): { ok: boolean; verified: boolean; message: string } {
  const envReady = getPaymentProviderEnvReady();
  const fact = resolveAdapterConnection(settings, envReady, adapterId);
  if (adapterId === "native") {
    return { ok: true, verified: true, message: "Native method — no external verification required." };
  }
  if (!fact.connected) {
    return { ok: false, verified: false, message: "Adapter is not connected for this venue." };
  }
  if (fact.verificationStatus === "revoked") {
    return { ok: false, verified: false, message: "Adapter credentials were revoked." };
  }
  if (!fact.verified) {
    return {
      ok: false,
      verified: false,
      message: "Adapter connected but credentials/environment are not verified yet."
    };
  }
  return {
    ok: true,
    verified: true,
    message:
      fact.environment === "sandbox"
        ? "Sandbox verification recorded. Production credentials still recommended."
        : "Adapter verification passed."
  };
}

export function verifyMethodAdapter(
  settings: VenuePaymentSettings,
  methodKey: string
): { ok: boolean; verified: boolean; message: string } {
  const entry = getCatalogEntry(methodKey);
  if (!entry) return { ok: false, verified: false, message: "Unknown payment method." };
  return verifyAdapterConnection(settings, entry.requiredAdapter);
}

/**
 * Run the provider adapter verification contract and persist verification fields.
 * A method must not become READY merely because config fields are present.
 */
export async function verifyAndPersistProviderConnection(
  prisma: PrismaClient,
  restaurantId: string,
  provider: ProviderConnectionId,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const current = await (
    await import("../venue/venuePaymentSettingsService.js")
  ).getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const envReady = getPaymentProviderEnvReady();
  const existing = current.settings.providerConnections?.[provider] ?? emptyConnection(provider);
  const adapter = paymentProviderAdapters[provider];
  const verified = await adapter.verifyConnection({
    restaurantId,
    envReady,
    connection: existing
  });

  const connection = verified.connection;
  const result = await updateVenuePaymentSettings(
    prisma,
    restaurantId,
    {
      providerConnections: {
        ...(current.settings.providerConnections ?? {}),
        [provider]: connection
      },
      providers: {
        stripe:
          provider === "stripe"
            ? {
                ...current.settings.providers.stripe,
                connected: connection.connected,
                verificationStatus: connection.verificationStatus,
                verifiedAt: connection.verifiedAt,
                health: connection.health,
                environment: connection.environment
              }
            : current.settings.providers.stripe,
        swish:
          provider === "swish"
            ? {
                ...current.settings.providers.swish,
                connected: connection.connected,
                verificationStatus: connection.verificationStatus,
                verifiedAt: connection.verifiedAt,
                health: connection.health,
                environment: connection.environment
              }
            : current.settings.providers.swish
      }
    },
    {
      ...audit,
      action: verified.ok ? "payment.method_verified" : "payment.method_verification_failed",
      path: `providerConnections.${provider}`
    }
  );

  if (!result.ok) return result;
  return {
    ...result,
    verification: {
      ok: verified.ok,
      verified: connection.verificationStatus === "verified",
      status: connection.verificationStatus,
      verifiedAt: connection.verifiedAt,
      verificationExpiresAt: connection.verificationExpiresAt,
      failureCode: connection.failureCode,
      failureReason: connection.failureReason,
      nextRequiredAction: connection.nextRequiredAction,
      message: verified.message
    }
  };
}

export async function verifyAndPersistMethodAdapter(
  prisma: PrismaClient,
  restaurantId: string,
  methodKey: string,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const entry = getCatalogEntry(methodKey);
  if (!entry) return { ok: false as const, error: "method_not_found" };
  if (entry.requiredAdapter === "native") {
    return {
      ok: true as const,
      verification: {
        ok: true,
        verified: true,
        status: "verified" as const,
        verifiedAt: new Date().toISOString(),
        verificationExpiresAt: null,
        failureCode: null,
        failureReason: null,
        nextRequiredAction: null,
        message: "Native method — no external verification required."
      }
    };
  }
  const provider = adapterToConnectionId(entry.requiredAdapter);
  if (!provider) return { ok: false as const, error: "adapter_not_supported" };
  return verifyAndPersistProviderConnection(prisma, restaurantId, provider, audit);
}

export async function runAndPersistProviderHealthCheck(
  prisma: PrismaClient,
  restaurantId: string,
  provider: ProviderConnectionId,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const { getVenuePaymentSettings } = await import("../venue/venuePaymentSettingsService.js");
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const envReady = getPaymentProviderEnvReady();
  const existing = current.settings.providerConnections?.[provider] ?? emptyConnection(provider);
  const adapter = paymentProviderAdapters[provider];
  const health = await adapter.healthCheck({ restaurantId, envReady, connection: existing });

  const result = await updateVenuePaymentSettings(
    prisma,
    restaurantId,
    {
      providerConnections: {
        ...(current.settings.providerConnections ?? {}),
        [provider]: health.connection
      },
      providers: {
        stripe:
          provider === "stripe"
            ? { ...current.settings.providers.stripe, health: health.connection.health }
            : current.settings.providers.stripe,
        swish:
          provider === "swish"
            ? { ...current.settings.providers.swish, health: health.connection.health }
            : current.settings.providers.swish
      }
    },
    {
      ...audit,
      action: "payment.provider_health_changed",
      path: `providerConnections.${provider}.health`
    }
  );
  if (!result.ok) return result;
  return {
    ...result,
    health: {
      ok: health.ok,
      status: health.connection.health,
      message: health.message,
      lastHealthCheckAt: health.connection.lastHealthCheckAt
    }
  };
}

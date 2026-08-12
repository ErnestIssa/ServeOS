import {
  getCatalogEntry,
  type PaymentAdapterId,
  type ServeOSPaymentCatalogEntry
} from "../catalog/paymentMethodCatalog.js";
import type { PaymentProviderEnvReady, VenuePaymentSettings } from "../venue/venuePaymentSettingsService.js";
import { getAdapterDefinition } from "./providerRegistry.js";
import type { ProviderConnectionId } from "./providerConnectionTypes.js";

export type AdapterConnectionFact = {
  adapterId: PaymentAdapterId;
  connected: boolean;
  environment: "sandbox" | "production" | "n/a";
  accountOrMerchantId?: string;
  envReady: boolean;
  verified: boolean;
  health: "unknown" | "healthy" | "degraded" | "unavailable" | "n/a";
  verificationStatus?: string;
};

function surfaceForAdapter(adapterId: PaymentAdapterId): ProviderConnectionId | "native" {
  if (adapterId === "native") return "native";
  if (adapterId === "swish") return "swish";
  if (adapterId === "terminal") return "terminals";
  return "stripe";
}

export function resolveAdapterConnection(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady,
  adapterId: PaymentAdapterId
): AdapterConnectionFact {
  if (adapterId === "native") {
    return {
      adapterId: "native",
      connected: true,
      environment: "n/a",
      envReady: true,
      verified: true,
      health: "healthy",
      verificationStatus: "verified"
    };
  }

  const surface = surfaceForAdapter(adapterId);
  const record =
    surface === "swish"
      ? settings.providerConnections?.swish
      : surface === "terminals"
        ? settings.providerConnections?.terminals ?? settings.providerConnections?.stripe
        : settings.providerConnections?.stripe;

  const legacy =
    adapterId === "swish"
      ? settings.providers.swish
      : settings.providers.stripe;

  const connected = Boolean(record?.connected ?? legacy?.connected);
  const environment = (record?.environment ?? legacy?.environment ?? "sandbox") as "sandbox" | "production";
  const accountOrMerchantId =
    record?.publicMerchantId ||
    record?.publicAccountId ||
    legacy?.merchantId ||
    legacy?.accountId;
  const envOk = adapterId === "swish" ? Boolean(envReady.swish) : Boolean(envReady.stripe);

  const verificationStatus = record?.verificationStatus ?? legacy?.verificationStatus ?? "unverified";
  const verified =
    verificationStatus === "verified" ||
    (connected && !record && (envOk || environment === "sandbox"));

  const health =
    record?.health ??
    legacy?.health ??
    (connected ? (verified ? (envOk ? "healthy" : "degraded") : "degraded") : "unknown");

  return {
    adapterId,
    connected,
    environment,
    accountOrMerchantId,
    envReady: envOk,
    verified,
    health,
    verificationStatus
  };
}

export function methodsUnlockedByConnections(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady
): Set<string> {
  const unlocked = new Set<string>();
  for (const adapter of ["native", "card", "swish", "klarna", "terminal"] as PaymentAdapterId[]) {
    const fact = resolveAdapterConnection(settings, envReady, adapter);
    if (!fact.connected && adapter !== "native") continue;
    const def = getAdapterDefinition(adapter);
    for (const key of def?.unlocksMethods ?? []) unlocked.add(key);
  }
  return unlocked;
}

export function catalogEntryAvailableForVenue(
  entry: ServeOSPaymentCatalogEntry,
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady
): boolean {
  const fact = resolveAdapterConnection(settings, envReady, entry.requiredAdapter);
  if (entry.requiredAdapter === "native") return true;
  return fact.connected;
}

export function resolveRequiredAdapter(methodKey: string): PaymentAdapterId {
  return getCatalogEntry(methodKey)?.requiredAdapter ?? "native";
}

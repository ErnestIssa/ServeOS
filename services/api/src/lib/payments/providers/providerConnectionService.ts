import type { PrismaClient } from "@prisma/client";
import {
  connectPaymentProvider as connectPaymentProviderCore,
  disconnectPaymentProvider as disconnectPaymentProviderCore,
  getPaymentProviderEnvReady,
  type VenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";

/** Connection surface for ServeOS direct adapters (UI-compatible ids). */
export type ProviderConnectionId = "stripe" | "swish";

export async function connectDirectAdapter(
  prisma: PrismaClient,
  restaurantId: string,
  provider: ProviderConnectionId,
  input: { accountId?: string; merchantId?: string; displayName?: string } = {},
  audit?: { actorUserId?: string; actorRole?: string }
) {
  return connectPaymentProviderCore(prisma, restaurantId, provider, input, audit);
}

export async function disconnectDirectAdapter(
  prisma: PrismaClient,
  restaurantId: string,
  provider: ProviderConnectionId,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  return disconnectPaymentProviderCore(prisma, restaurantId, provider, audit);
}

export function listProviderSurfaces(settings: VenuePaymentSettings) {
  const envReady = getPaymentProviderEnvReady();
  return [
    {
      id: "stripe" as const,
      label: "Card rails",
      adapterIds: ["card", "klarna", "terminal"],
      connected: Boolean(settings.providers.stripe.connected),
      environment: settings.providers.stripe.environment ?? "sandbox",
      accountId: settings.providers.stripe.accountId,
      envReady: envReady.stripe,
      capabilities: {
        cards: envReady.stripe || settings.providers.stripe.connected,
        applePay: settings.providers.stripe.connected,
        googlePay: settings.providers.stripe.connected,
        klarna: settings.providers.stripe.connected,
        swish: false
      }
    },
    {
      id: "swish" as const,
      label: "Swish",
      adapterIds: ["swish"],
      connected: Boolean(settings.providers.swish.connected),
      environment: settings.providers.swish.environment ?? "sandbox",
      merchantId: settings.providers.swish.merchantId,
      envReady: envReady.swish,
      capabilities: {
        cards: false,
        applePay: false,
        googlePay: false,
        klarna: false,
        swish: settings.providers.swish.connected
      }
    },
    {
      id: "terminals" as const,
      label: "Card terminals",
      adapterIds: ["terminal"],
      connected: Boolean(settings.providers.stripe.connected) || Boolean(settings.methods.cardTerminal),
      environment: settings.providers.stripe.environment ?? "sandbox",
      envReady: envReady.stripe,
      capabilities: {
        cards: Boolean(settings.methods.cardTerminal),
        applePay: Boolean(settings.methods.applePayTerminal),
        googlePay: Boolean(settings.methods.googlePayTerminal),
        klarna: false,
        swish: false
      }
    }
  ];
}

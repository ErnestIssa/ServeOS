/**
 * Stripe Connect Express/Standard hosted onboarding via Stripe REST API.
 * Uses platform STRIPE_SECRET_KEY. No venue API secrets required for SERVEOS_MANAGED.
 */

import { randomUUID } from "node:crypto";
import {
  CAPABILITY_CATALOG,
  emptyCapabilities,
  type PaymentCapabilityId,
  type PaymentCapabilityStatus,
  type VenuePaymentAccount,
  type VenuePaymentCapability
} from "./venuePaymentAccountTypes.js";

function stripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

function stripeApiBase(): string {
  return process.env.STRIPE_API_BASE?.trim() || "https://api.stripe.com";
}

async function stripeRequest<T>(
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string; code?: string }> {
  const secret = stripeSecret();
  if (!secret) {
    return { ok: false, status: 503, message: "STRIPE_SECRET_KEY is not configured on ServeOS.", code: "STRIPE_ENV_MISSING" };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    "Stripe-Version": process.env.STRIPE_API_VERSION?.trim() || "2024-11-20.acacia"
  };
  let payload: BodyInit | undefined;
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body).toString();
  }
  const res = await fetch(`${stripeApiBase()}${path}`, { method, headers, body: payload });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string; code?: string } | undefined;
    return {
      ok: false,
      status: res.status,
      message: err?.message || `Stripe API error (${res.status})`,
      code: err?.code
    };
  }
  return { ok: true, data: json as T };
}

type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  country?: string;
  default_currency?: string;
  capabilities?: Record<string, string>;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    disabled_reason?: string | null;
  };
  business_profile?: { name?: string | null };
};

type StripeAccountLink = {
  url: string;
  expires_at?: number;
};

function mapCapStatus(raw: string | undefined): PaymentCapabilityStatus {
  if (raw === "active") return "active";
  if (raw === "pending" || raw === "pending_verification") return "pending";
  if (raw === "inactive") return "inactive";
  return "unavailable";
}

function capabilitiesFromStripeAccount(account: StripeAccount): VenuePaymentCapability[] {
  const caps = emptyCapabilities();
  const byId = new Map(caps.map((c) => [c.id, c]));
  const stripeCaps = account.capabilities ?? {};

  const apply = (id: PaymentCapabilityId, stripeKey: string) => {
    const row = byId.get(id);
    if (!row) return;
    const status = mapCapStatus(stripeCaps[stripeKey]);
    row.providerStatus = status;
    row.normalizedStatus = status;
    row.lastVerifiedAt = new Date().toISOString();
    row.unlocksMethods = [...CAPABILITY_CATALOG[id].unlocksMethods];
  };

  apply("card_payments", "card_payments");
  apply("transfers", "transfers");
  // Wallets / Klarna often ride card_payments until Connect capabilities are explicit.
  if (mapCapStatus(stripeCaps.card_payments) === "active") {
    for (const id of ["apple_pay", "google_pay", "klarna", "terminal"] as PaymentCapabilityId[]) {
      const row = byId.get(id)!;
      row.providerStatus = "active";
      row.normalizedStatus = "active";
      row.lastVerifiedAt = new Date().toISOString();
    }
  }

  // Swish is not a Stripe Connect capability — leave inactive unless a Nordic PSP is connected later.
  return [...byId.values()];
}

export function deriveOnboardingStateFromStripe(account: StripeAccount): VenuePaymentAccount["onboardingState"] {
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) return "ACTIVE";
  if (account.charges_enabled && account.details_submitted) return "CONNECTED";
  const due = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.eventually_due ?? [])
  ];
  if (account.requirements?.disabled_reason) return "RESTRICTED";
  if (due.length) return "ACTION_REQUIRED";
  if (account.details_submitted) return "UNDER_REVIEW";
  return "IN_PROGRESS";
}

export async function createStripeConnectAccount(input: {
  restaurantId: string;
  email?: string;
  country?: string;
}): Promise<
  | { ok: true; accountId: string; sandbox: false }
  | { ok: true; accountId: string; sandbox: true }
  | { ok: false; message: string; code?: string }
> {
  const secret = stripeSecret();
  if (!secret) {
    // Dev/sandbox without platform key: deterministic stub account for local UX.
    return {
      ok: true,
      sandbox: true,
      accountId: `acct_sim_${input.restaurantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || randomUUID().slice(0, 12)}`
    };
  }

  const created = await stripeRequest<StripeAccount>("POST", "/v1/accounts", {
    type: "express",
    country: (input.country || "SE").toUpperCase(),
    "capabilities[card_payments][requested]": "true",
    "capabilities[transfers][requested]": "true",
    "business_profile[product_description]": "ServeOS venue guest payments",
    ...(input.email ? { email: input.email } : {})
  });
  if (!created.ok) return { ok: false, message: created.message, code: created.code };
  return { ok: true, sandbox: false, accountId: created.data.id };
}

export async function createStripeAccountLink(input: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<
  | { ok: true; url: string; expiresAt: string; sandbox: boolean }
  | { ok: false; message: string; code?: string }
> {
  const secret = stripeSecret();
  if (!secret || input.accountId.startsWith("acct_sim_")) {
    // Local simulation: bounce through ServeOS return URL with a flag.
    const url = new URL(input.returnUrl);
    url.searchParams.set("connect", "simulated");
    url.searchParams.set("account", input.accountId);
    return {
      ok: true,
      sandbox: true,
      url: url.toString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  const link = await stripeRequest<StripeAccountLink>("POST", "/v1/account_links", {
    account: input.accountId,
    refresh_url: input.refreshUrl,
    return_url: input.returnUrl,
    type: "account_onboarding"
  });
  if (!link.ok) return { ok: false, message: link.message, code: link.code };
  return {
    ok: true,
    sandbox: false,
    url: link.data.url,
    expiresAt: link.data.expires_at
      ? new Date(link.data.expires_at * 1000).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString()
  };
}

export async function retrieveStripeConnectAccount(
  accountId: string
): Promise<
  | { ok: true; account: StripeAccount; sandbox: boolean }
  | { ok: false; message: string; code?: string }
> {
  if (accountId.startsWith("acct_sim_") || !stripeSecret()) {
    return {
      ok: true,
      sandbox: true,
      account: {
        id: accountId,
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        country: "SE",
        default_currency: "sek",
        capabilities: {
          card_payments: "active",
          transfers: "active"
        },
        business_profile: { name: "Simulated ServeOS venue" }
      }
    };
  }
  const got = await stripeRequest<StripeAccount>("GET", `/v1/accounts/${encodeURIComponent(accountId)}`);
  if (!got.ok) return { ok: false, message: got.message, code: got.code };
  return { ok: true, sandbox: false, account: got.data };
}

export function applyStripeAccountToVenueAccount(
  current: VenuePaymentAccount,
  account: StripeAccount,
  sandbox: boolean
): VenuePaymentAccount {
  const onboardingState = deriveOnboardingStateFromStripe(account);
  const due = account.requirements?.currently_due ?? [];
  return {
    ...current,
    providerAccountId: account.id,
    displayName: account.business_profile?.name || current.displayName,
    country: (account.country || current.country || "SE").toUpperCase(),
    currency: (account.default_currency || current.currency || "SEK").toUpperCase(),
    onboardingState,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    environment: sandbox ? "sandbox" : "production",
    capabilities: capabilitiesFromStripeAccount(account),
    reasonCode: due[0] ?? account.requirements?.disabled_reason ?? null,
    requiredAction:
      onboardingState === "ACTION_REQUIRED"
        ? "COMPLETE_PROVIDER_ONBOARDING"
        : onboardingState === "ACTIVE" || onboardingState === "CONNECTED"
          ? "ENABLE_METHODS"
          : "CONTINUE_ONBOARDING",
    actionUrl: null,
    lastProviderSyncAt: new Date().toISOString(),
    connectedAt:
      onboardingState === "ACTIVE" || onboardingState === "CONNECTED"
        ? current.connectedAt ?? new Date().toISOString()
        : current.connectedAt ?? null,
    updatedAt: new Date().toISOString()
  };
}

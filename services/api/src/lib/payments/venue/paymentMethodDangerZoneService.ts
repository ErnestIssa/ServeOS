import { randomInt, randomUUID } from "node:crypto";
import { getCatalogEntry } from "../catalog/paymentMethodCatalog.js";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";
import {
  evaluatePaymentMethodReadiness,
  type PaymentMethodReadiness
} from "../venue/paymentMethodReadiness.js";
import {
  disconnectPaymentProvider,
  getPaymentProviderEnvReady,
  getVenuePaymentSettings,
  updateVenuePaymentSettings,
  type PaymentMethodKey,
  type VenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";
import type { PrismaClient } from "@prisma/client";

export type PaymentMethodDangerActionId =
  | "DISABLE"
  | "CLEAR_DEFAULT"
  | "RESET_CONFIGURATION"
  | "CLEAR_SETUP_SESSION"
  | "DISCONNECT_ADAPTER";

export type PaymentMethodDangerAction = {
  id: PaymentMethodDangerActionId;
  label: string;
  description: string;
  severity: "warning" | "critical";
  consequences: string[];
  confirmLabel: string;
  available: boolean;
  unavailableReason?: string;
};

export type PaymentMethodDangerZone = {
  methodKey: string;
  methodLabel: string;
  readinessStatus: PaymentMethodReadiness["status"];
  enabled: boolean;
  isDefault: boolean;
  actions: PaymentMethodDangerAction[];
};

export type PaymentDangerChallenge = {
  id: string;
  restaurantId: string;
  methodKey: string;
  actionId: PaymentMethodDangerActionId;
  /** Display / type-in phrase — three random words. */
  phrase: string;
  expiresAt: string;
  createdAt: string;
  createdBy?: string;
};

const PHRASE_WORDS = [
  "amber",
  "basin",
  "cedar",
  "delta",
  "ember",
  "flint",
  "grove",
  "harbor",
  "ivory",
  "jasper",
  "kettle",
  "lagoon",
  "maple",
  "nebula",
  "orchid",
  "pebble",
  "quartz",
  "ridge",
  "saffron",
  "timber",
  "umbra",
  "violet",
  "willow",
  "xenon",
  "yellow",
  "zephyr",
  "anchor",
  "breeze",
  "canyon",
  "drift",
  "echo",
  "fjord",
  "glacier",
  "hearth",
  "island",
  "juniper",
  "keel",
  "lantern",
  "meadow",
  "north",
  "olive",
  "pine",
  "quill",
  "river",
  "summit",
  "tide",
  "valley",
  "wave"
] as const;

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function pickPhrase(): string {
  const a = PHRASE_WORDS[randomInt(PHRASE_WORDS.length)]!;
  let b = PHRASE_WORDS[randomInt(PHRASE_WORDS.length)]!;
  let c = PHRASE_WORDS[randomInt(PHRASE_WORDS.length)]!;
  while (b === a) b = PHRASE_WORDS[randomInt(PHRASE_WORDS.length)]!;
  while (c === a || c === b) c = PHRASE_WORDS[randomInt(PHRASE_WORDS.length)]!;
  return `${a} ${b} ${c}`;
}

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function relatedMethodKeys(methodKey: string): PaymentMethodKey[] {
  const entry = getCatalogEntry(methodKey);
  if (!entry) return [methodKey as PaymentMethodKey];
  if (entry.requiredAdapter === "swish") return ["swish", "swishAtVenue"];
  if (entry.requiredAdapter === "native") return [methodKey as PaymentMethodKey];
  if (entry.requiredAdapter === "terminal") {
    return ["cardTerminal", "applePayTerminal", "googlePayTerminal", "samsungPayTerminal"];
  }
  return [
    "card",
    "visa",
    "mastercard",
    "amex",
    "applePay",
    "googlePay",
    "samsungPay",
    "klarnaPayNow",
    "klarnaPayLater",
    "klarnaInstallments"
  ];
}

function adapterSurface(methodKey: string): "stripe" | "swish" | null {
  const entry = getCatalogEntry(methodKey);
  if (!entry || entry.requiredAdapter === "native") return null;
  if (entry.requiredAdapter === "swish") return "swish";
  return "stripe";
}

export function buildPaymentMethodDangerZone(
  settings: VenuePaymentSettings,
  methodKey: string
): PaymentMethodDangerZone | null {
  const entry = getCatalogEntry(methodKey);
  if (!entry) return null;

  const envReady = getPaymentProviderEnvReady();
  const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);
  const config = settings.methodConfig?.[methodKey as PaymentMethodKey];
  const enabled = Boolean(config?.enabled ?? settings.methods?.[methodKey as PaymentMethodKey]);
  const isDefault =
    settings.defaultPaymentMethodKey === methodKey || Boolean(config?.isDefault);
  const adapter = resolveAdapterConnection(settings, envReady, entry.requiredAdapter);
  const surface = adapterSurface(methodKey);
  const siblings = relatedMethodKeys(methodKey).filter((k) => k !== methodKey);
  const enabledSiblings = siblings.filter((k) =>
    Boolean(settings.methodConfig?.[k]?.enabled ?? settings.methods?.[k])
  );

  const actions: PaymentMethodDangerAction[] = [
    {
      id: "DISABLE",
      label: "Disable method",
      description: "Stop accepting this method for new checkout attempts.",
      severity: "warning",
      confirmLabel: "Disable method",
      consequences: [
        "New guest and staff checkouts will no longer offer this method.",
        "In-flight payment attempts and webhooks are preserved.",
        "Refund and reconciliation history remains available.",
        "You can re-enable later only after readiness checks pass."
      ],
      available: enabled,
      unavailableReason: enabled ? undefined : "This method is already disabled."
    },
    {
      id: "CLEAR_DEFAULT",
      label: "Clear default",
      description: "Remove this method as the venue default settlement preference.",
      severity: "warning",
      confirmLabel: "Clear default",
      consequences: [
        "This method will no longer be preferred for new settlement flows.",
        "Other enabled methods remain available.",
        "No payment history is deleted."
      ],
      available: isDefault,
      unavailableReason: isDefault ? undefined : "This method is not the venue default."
    },
    {
      id: "CLEAR_SETUP_SESSION",
      label: "Clear setup session",
      description: "Discard the saved setup wizard progress for this method.",
      severity: "warning",
      confirmLabel: "Clear setup session",
      consequences: [
        "Saved setup wizard progress for this method is removed.",
        "Provider connection and method configuration are not deleted by this action.",
        "Opening Set up again starts a fresh backend setup session."
      ],
      available: Boolean(settings.setupSessions?.[methodKey]),
      unavailableReason: settings.setupSessions?.[methodKey]
        ? undefined
        : "There is no saved setup session for this method."
    },
    {
      id: "RESET_CONFIGURATION",
      label: "Reset configuration",
      description: "Reset this method to ServeOS defaults and disable it.",
      severity: "critical",
      confirmLabel: "Reset configuration",
      consequences: [
        "Channel, limit, instruction, and policy settings for this method are reset to defaults.",
        "The method is disabled for new attempts.",
        "If it was the default method, that preference is cleared.",
        "Provider adapter connection is kept — disconnect separately if required.",
        "Setup session progress for this method is cleared."
      ],
      available: Boolean(config) || enabled || Boolean(settings.setupSessions?.[methodKey]),
      unavailableReason: "Nothing configured to reset for this method."
    },
    {
      id: "DISCONNECT_ADAPTER",
      label: surface === "swish" ? "Disconnect Swish adapter" : "Disconnect card adapter",
      description: "Disconnect the shared ServeOS adapter this method depends on.",
      severity: "critical",
      confirmLabel: "Disconnect adapter",
      consequences: [
        `This disconnects the ${surface ?? "provider"} adapter for the whole venue.`,
        enabledSiblings.length
          ? `Related methods also disabled for new attempts: ${enabledSiblings.join(", ")}.`
          : "Related methods that share this adapter will be blocked for new attempts.",
        "Encrypted credentials are revoked for this adapter.",
        "Pending payment intents remain resolvable via webhooks where possible.",
        "Payment history is preserved."
      ],
      available: Boolean(surface) && adapter.connected,
      unavailableReason: !surface
        ? "This native method does not use an external adapter."
        : adapter.connected
          ? undefined
          : "The required adapter is not connected."
    }
  ];

  return {
    methodKey: entry.key,
    methodLabel: entry.label,
    readinessStatus: readiness.status,
    enabled,
    isDefault,
    actions
  };
}

type ChallengeStore = NonNullable<VenuePaymentSettings["dangerChallenges"]>;

function pruneChallenges(store: ChallengeStore | undefined, now = Date.now()): ChallengeStore {
  const next: ChallengeStore = {};
  for (const [id, row] of Object.entries(store ?? {})) {
    if (!row?.expiresAt) continue;
    if (new Date(row.expiresAt).getTime() > now) next[id] = row;
  }
  return next;
}

export async function createPaymentMethodDangerChallenge(
  prisma: PrismaClient,
  restaurantId: string,
  methodKey: string,
  actionId: PaymentMethodDangerActionId,
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const zone = buildPaymentMethodDangerZone(current.settings, methodKey);
  if (!zone) return { ok: false as const, error: "method_not_found" };
  const action = zone.actions.find((a) => a.id === actionId);
  if (!action) return { ok: false as const, error: "action_not_found" };
  if (!action.available) {
    return {
      ok: false as const,
      error: "action_unavailable",
      message: action.unavailableReason ?? "This action is not available right now."
    };
  }

  const now = Date.now();
  const challenge: PaymentDangerChallenge = {
    id: `pdc_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    restaurantId,
    methodKey,
    actionId,
    phrase: pickPhrase(),
    expiresAt: new Date(now + CHALLENGE_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
    createdBy: audit?.actorUserId
  };

  const pruned = pruneChallenges(current.settings.dangerChallenges, now);
  pruned[challenge.id] = challenge;

  const saved = await updateVenuePaymentSettings(
    prisma,
    restaurantId,
    { dangerChallenges: pruned } as Partial<VenuePaymentSettings>,
    {
      ...audit,
      action: "payment.danger_challenge_created",
      path: `dangerChallenges.${challenge.id}`
    }
  );
  if (!saved.ok) return saved;

  return {
    ok: true as const,
    challenge: {
      id: challenge.id,
      methodKey: challenge.methodKey,
      actionId: challenge.actionId,
      phrase: challenge.phrase,
      expiresAt: challenge.expiresAt,
      createdAt: challenge.createdAt
    },
    action,
    zone
  };
}

export async function executePaymentMethodDangerAction(
  prisma: PrismaClient,
  restaurantId: string,
  methodKey: string,
  input: {
    actionId: PaymentMethodDangerActionId;
    challengeId: string;
    typedPhrase: string;
  },
  audit?: { actorUserId?: string; actorRole?: string }
) {
  const current = await getVenuePaymentSettings(prisma, restaurantId);
  if (!current.ok) return current;

  const zone = buildPaymentMethodDangerZone(current.settings, methodKey);
  if (!zone) return { ok: false as const, error: "method_not_found" };
  const action = zone.actions.find((a) => a.id === input.actionId);
  if (!action) return { ok: false as const, error: "action_not_found" };
  if (!action.available) {
    return {
      ok: false as const,
      error: "action_unavailable",
      message: action.unavailableReason ?? "This action is not available right now."
    };
  }

  const store = pruneChallenges(current.settings.dangerChallenges);
  const challenge = store[input.challengeId];
  if (!challenge) {
    return {
      ok: false as const,
      error: "challenge_invalid",
      message: "Confirmation challenge expired or was not found. Start again."
    };
  }
  if (challenge.methodKey !== methodKey || challenge.actionId !== input.actionId) {
    return {
      ok: false as const,
      error: "challenge_mismatch",
      message: "Confirmation challenge does not match this action."
    };
  }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return {
      ok: false as const,
      error: "challenge_expired",
      message: "Confirmation challenge expired. Start again."
    };
  }
  if (normalizePhrase(input.typedPhrase) !== normalizePhrase(challenge.phrase)) {
    return {
      ok: false as const,
      error: "phrase_mismatch",
      message: "Typed confirmation phrase does not match. Pasting is not allowed — type it carefully."
    };
  }

  // Consume challenge before executing.
  const nextChallenges = { ...store };
  delete nextChallenges[input.challengeId];

  if (input.actionId === "DISCONNECT_ADAPTER") {
    const surface = adapterSurface(methodKey);
    if (!surface) {
      return { ok: false as const, error: "action_unavailable", message: "No adapter to disconnect." };
    }
    const disconnected = await disconnectPaymentProvider(prisma, restaurantId, surface, audit);
    if (!disconnected.ok) return disconnected;
    await updateVenuePaymentSettings(
      prisma,
      restaurantId,
      { dangerChallenges: nextChallenges } as Partial<VenuePaymentSettings>,
      { ...audit, action: "payment.danger_challenge_consumed", path: `dangerChallenges.${input.challengeId}` }
    );
    return {
      ok: true as const,
      settings: disconnected.settings,
      actionId: input.actionId,
      message: `${action.label} completed.`
    };
  }

  const prev = current.settings.methodConfig[methodKey as PaymentMethodKey];
  let patch: Partial<VenuePaymentSettings> = {
    dangerChallenges: nextChallenges
  };

  if (input.actionId === "DISABLE") {
    patch = {
      ...patch,
      methods: { [methodKey]: false },
      methodConfig: {
        [methodKey]: {
          ...(prev as object),
          enabled: false
        }
      }
    };
  } else if (input.actionId === "CLEAR_DEFAULT") {
    patch = {
      ...patch,
      defaultPaymentMethodKey: null,
      methodConfig: prev
        ? {
            [methodKey]: {
              ...prev,
              isDefault: false
            }
          }
        : undefined
    };
  } else if (input.actionId === "CLEAR_SETUP_SESSION") {
    const sessions = { ...(current.settings.setupSessions ?? {}) };
    delete sessions[methodKey];
    patch = {
      ...patch,
      setupSessions: sessions
    };
  } else if (input.actionId === "RESET_CONFIGURATION") {
    const sessions = { ...(current.settings.setupSessions ?? {}) };
    delete sessions[methodKey];
    patch = {
      ...patch,
      methods: { [methodKey]: false },
      defaultPaymentMethodKey:
        current.settings.defaultPaymentMethodKey === methodKey
          ? null
          : current.settings.defaultPaymentMethodKey,
      setupSessions: sessions,
      methodConfig: {
        [methodKey]: {
          ...(prev as object),
          enabled: false,
          isDefault: false,
          displayName: "",
          instructionsStaff: "",
          instructionsCustomer: "",
          minCents: null,
          maxCents: null,
          priority: 100
        }
      }
    };
  }

  const saved = await updateVenuePaymentSettings(prisma, restaurantId, patch, {
    ...audit,
    action: `payment.danger_${input.actionId.toLowerCase()}`,
    path: `methods.${methodKey}`
  });
  if (!saved.ok) return saved;
  return {
    ok: true as const,
    settings: saved.settings,
    actionId: input.actionId,
    message: `${action.label} completed.`
  };
}

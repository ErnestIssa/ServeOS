import { getMethodCapabilities } from "../catalog/paymentMethodCapabilities.js";
import { getCatalogEntry } from "../catalog/paymentMethodCatalog.js";
import {
  getRequirementLabels,
  type PaymentRequirementId
} from "../catalog/paymentMethodRequirements.js";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";
import type {
  PaymentMethodConfig,
  PaymentMethodKey,
  PaymentProviderEnvReady,
  VenuePaymentSettings
} from "./venuePaymentSettingsService.js";
import {
  canEnableFromStatus,
  mapLifecycleToUiHealth,
  type PaymentMethodLifecycleStatus,
  type PaymentMethodNextAction,
  type PaymentMethodUiHealth
} from "./paymentMethodStateMachine.js";

export type PaymentMethodReadiness = {
  methodKey: PaymentMethodKey | string;
  status: PaymentMethodLifecycleStatus;
  uiHealth: PaymentMethodUiHealth;
  statusLabel: string;
  supportedByServeOS: boolean;
  availableForVenue: boolean;
  canEnable: boolean;
  canDisable: boolean;
  missingRequirements: PaymentRequirementId[];
  missingRequirementLabels: string[];
  nextAction: PaymentMethodNextAction;
  reason: string;
  adapterId: string;
  adapterConnected: boolean;
  adapterVerified: boolean;
  adapterEnvironment: string;
};

function defaultConfigForKey(
  settings: VenuePaymentSettings,
  key: string
): PaymentMethodConfig | null {
  return settings.methodConfig?.[key as PaymentMethodKey] ?? null;
}

export function evaluatePaymentMethodReadiness(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady,
  methodKey: string
): PaymentMethodReadiness {
  const entry = getCatalogEntry(methodKey);
  const labels = getRequirementLabels();
  const config = defaultConfigForKey(settings, methodKey);
  const enabled = Boolean(config?.enabled ?? settings.methods?.[methodKey as PaymentMethodKey]);
  const isDefault =
    settings.defaultPaymentMethodKey === methodKey || Boolean(config?.isDefault);

  if (!entry) {
    const status: PaymentMethodLifecycleStatus = enabled ? "ERROR" : "DISABLED";
    const ui = mapLifecycleToUiHealth(status, false);
    return {
      methodKey,
      status,
      uiHealth: ui.health,
      statusLabel: ui.statusLabel,
      supportedByServeOS: false,
      availableForVenue: false,
      canEnable: false,
      canDisable: enabled,
      missingRequirements: [],
      missingRequirementLabels: [],
      nextAction: "NONE",
      reason: "This method is not in the ServeOS payment catalog.",
      adapterId: "none",
      adapterConnected: false,
      adapterVerified: false,
      adapterEnvironment: "n/a"
    };
  }

  const caps = getMethodCapabilities(entry.key);
  const adapter = resolveAdapterConnection(settings, envReady, entry.requiredAdapter);
  const missing: PaymentRequirementId[] = [];

  if (entry.requiredAdapter !== "native") {
    if (!adapter.connected) missing.push("ADAPTER_CONNECTION");
    if (adapter.connected && !adapter.accountOrMerchantId && entry.requiredAdapter !== "terminal") {
      missing.push("ADAPTER_CREDENTIALS");
    }
    if (adapter.connected && !adapter.verified) missing.push("ADAPTER_VERIFICATION");
    const connMode =
      entry.requiredAdapter === "swish"
        ? settings.providerConnections?.swish?.connectionMode
        : settings.providerConnections?.stripe?.connectionMode;
    const managed = connMode === "SERVEOS_MANAGED" || (adapter.connected && !settings.providerConnections?.stripe?.hasApiSecret && entry.requiredAdapter !== "swish");
    if (caps.requiresWebhook && !envReady.webhook && adapter.connected && !managed) {
      missing.push("WEBHOOK_CONFIGURATION");
    }
  }

  const sources = config?.supportedOrderSources ?? [];
  if (!sources.length) missing.push("ORDER_SOURCES");

  const currencies = config?.currencies ?? [];
  if (currencies.length && !currencies.includes("SEK") && entry.group !== "business") {
    // Soft: prefer SEK for consumer methods; only block if currencies explicitly set without SEK
    if (currencies.length > 0 && !currencies.some((c) => c === "SEK")) {
      missing.push("CURRENCY_SEK");
    }
  }

  let status: PaymentMethodLifecycleStatus;
  let nextAction: PaymentMethodNextAction;
  let reason: string;

  if (enabled) {
    if (adapter.health === "unavailable" || adapter.verificationStatus === "revoked") {
      status = "DEGRADED";
      nextAction = "RECONNECT";
      reason = "Method is enabled but the provider connection is unavailable or revoked. New attempts should use a fallback.";
    } else if (missing.includes("ADAPTER_CONNECTION") || missing.includes("ADAPTER_VERIFICATION")) {
      status = "ERROR";
      nextAction = "FIX_ISSUE";
      reason = "Method is enabled but the ServeOS adapter connection is missing or invalid.";
    } else if (adapter.health === "degraded") {
      status = "DEGRADED";
      nextAction = "FIX_ISSUE";
      reason = "Method is enabled but provider health is degraded.";
    } else if (missing.length > 0) {
      status = "DEGRADED";
      nextAction = "FIX_ISSUE";
      reason = "Method is enabled but some requirements are incomplete.";
    } else if (adapter.environment === "sandbox" && entry.requiredAdapter !== "native") {
      status = "PENDING_VERIFICATION";
      nextAction = "VERIFY_CONNECTION";
      reason = "Connected in sandbox — production verification still pending.";
    } else {
      status = "ENABLED";
      nextAction = "DISABLE";
      reason = "Method is enabled and meeting ServeOS readiness checks.";
    }
  } else if (adapter.verificationStatus === "revoked") {
    status = "REVOKED";
    nextAction = "RECONNECT";
    reason = "Provider credentials were revoked. Reconnect to continue setup.";
  } else if (entry.requiredAdapter === "native") {
    if (missing.includes("ORDER_SOURCES")) {
      status = "SETUP_REQUIRED";
      nextAction = "CONFIGURE_CHANNELS";
      reason = "Choose where this method can be used, then enable it.";
    } else {
      status = "READY";
      nextAction = "ACTIVATE";
      reason = "Ready to enable.";
    }
  } else if (!adapter.connected) {
    status = "SETUP_REQUIRED";
    nextAction = "CONNECT_ADAPTER";
    reason = `Connect payments first, then you can enable ${entry.label}.`;
  } else if (!adapter.verified || missing.includes("ADAPTER_VERIFICATION")) {
    status = "PENDING_VERIFICATION";
    nextAction = "VERIFY_CONNECTION";
    reason = "Payments are linked — finish verification before enabling.";
  } else if (missing.includes("ORDER_SOURCES") || missing.includes("CURRENCY_SEK")) {
    status = "CONFIGURING";
    nextAction = "CONFIGURE_CHANNELS";
    reason = "Choose where this method can be used, then enable it.";
  } else {
    status = "READY";
    nextAction = "ACTIVATE";
    reason = "Ready to enable for guests.";
  }

  const ui = mapLifecycleToUiHealth(status, isDefault && status === "ENABLED");

  const canEnable =
    !enabled &&
    (canEnableFromStatus(status) ||
      (status === "PENDING_VERIFICATION" && adapter.connected) ||
      (status === "CONFIGURING" && adapter.connected && !missing.includes("ORDER_SOURCES")));

  return {
    methodKey: entry.key,
    status,
    uiHealth: ui.health,
    statusLabel: ui.statusLabel,
    supportedByServeOS: true,
    availableForVenue: entry.requiredAdapter === "native" || adapter.connected,
    canEnable,
    canDisable: enabled,
    missingRequirements: missing,
    missingRequirementLabels: missing.map((id) => labels[id]),
    nextAction: enabled && status === "ENABLED" ? "NONE" : nextAction,
    reason,
    adapterId: entry.requiredAdapter,
    adapterConnected: adapter.connected,
    adapterVerified: adapter.verified,
    adapterEnvironment: adapter.environment
  };
}

export function evaluateAllMethodReadiness(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady,
  keys: string[]
): PaymentMethodReadiness[] {
  return keys.map((key) => evaluatePaymentMethodReadiness(settings, envReady, key));
}

/** Returns true when enabling this method is allowed by readiness facts. */
export function assertMethodCanEnable(
  settings: VenuePaymentSettings,
  envReady: PaymentProviderEnvReady,
  methodKey: string
): { ok: true } | { ok: false; error: string; readiness: PaymentMethodReadiness } {
  const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);
  if (readiness.status === "READY" || readiness.status === "ENABLED") {
    return { ok: true };
  }
  // Allow enable when only sandbox-pending after connection (maps to Pending UI once on).
  if (
    readiness.status === "PENDING_VERIFICATION" &&
    readiness.adapterConnected &&
    readiness.missingRequirements.every(
      (r) => r === "WEBHOOK_CONFIGURATION" || r === "ADAPTER_VERIFICATION"
    )
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    error: readiness.reason || "Method is not ready to enable.",
    readiness
  };
}

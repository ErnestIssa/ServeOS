import {
  CATALOG_METHOD_KEYS,
  SERVEOS_PAYMENT_CATALOG,
  SERVEOS_PAYMENT_CATALOG_VERSION,
  getCatalogEntry
} from "../catalog/paymentMethodCatalog.js";
import { getMethodCapabilities } from "../catalog/paymentMethodCapabilities.js";
import {
  getPaymentProviderEnvReady,
  type PaymentMethodConfig,
  type PaymentMethodKey,
  type VenuePaymentSettings
} from "./venuePaymentSettingsService.js";
import {
  evaluatePaymentMethodReadiness,
  type PaymentMethodReadiness
} from "./paymentMethodReadiness.js";

export type VenuePaymentMethodView = {
  key: string;
  label: string;
  group: string;
  family: string;
  hint: string;
  rails: string;
  instrument: string;
  channels: string[];
  lifecycleVersion: number;
  supportedByServeOS: true;
  /** How the venue connects acquiring for this method. */
  integrationMode: "serveos_managed" | "direct" | "native";
  availableFromProvider: boolean;
  config: PaymentMethodConfig | null;
  enabled: boolean;
  isDefault: boolean;
  readiness: PaymentMethodReadiness;
};

export type VenuePaymentMethodsPayloadOptions = {
  /** Methods unlocked by the connected VenuePaymentAccount capabilities. */
  unlockedMethodKeys?: Set<string>;
  hasManagedAccount?: boolean;
};

function resolveConfig(settings: VenuePaymentSettings, key: PaymentMethodKey): PaymentMethodConfig | null {
  return settings.methodConfig?.[key] ?? null;
}

export function buildVenuePaymentMethodViews(
  settings: VenuePaymentSettings,
  options?: VenuePaymentMethodsPayloadOptions
): VenuePaymentMethodView[] {
  const envReady = getPaymentProviderEnvReady();
  return SERVEOS_PAYMENT_CATALOG.map((entry) => {
    const config = resolveConfig(settings, entry.key);
    const enabled = Boolean(config?.enabled ?? settings.methods[entry.key]);
    const isDefault =
      settings.defaultPaymentMethodKey === entry.key || Boolean(config?.isDefault);
    let readiness = evaluatePaymentMethodReadiness(settings, envReady, entry.key);

    const isNative = entry.requiredAdapter === "native";
    const unlocked =
      isNative ||
      !options?.unlockedMethodKeys ||
      options.unlockedMethodKeys.size === 0 ||
      options.unlockedMethodKeys.has(entry.key);

    // Platform account is connected but this capability is not provisioned for the venue.
    if (!isNative && options?.hasManagedAccount && options.unlockedMethodKeys && !unlocked) {
      readiness = {
        ...readiness,
        availableForVenue: false,
        canEnable: false,
        status: enabled ? readiness.status : "NOT_CONFIGURED",
        nextAction: "CONNECT_ADAPTER",
        reason:
          "ServeOS supports this method, but it is not available on this venue’s connected payment account yet.",
        missingRequirements: [...readiness.missingRequirements, "ADAPTER_CONNECTION"],
        missingRequirementLabels: [
          ...readiness.missingRequirementLabels,
          "Payment capability not provisioned for this account"
        ]
      };
      const ui = {
        health: readiness.uiHealth,
        statusLabel: "Unavailable for account"
      };
      readiness = {
        ...readiness,
        uiHealth: "setup",
        statusLabel: ui.statusLabel
      };
    }

    const integrationMode: VenuePaymentMethodView["integrationMode"] = isNative
      ? "native"
      : options?.hasManagedAccount
        ? "serveos_managed"
        : "direct";

    return {
      key: entry.key,
      label: entry.label,
      group: entry.group,
      family: entry.family,
      hint: entry.hint,
      rails: entry.rails,
      instrument: entry.instrument,
      channels: entry.channels,
      lifecycleVersion: entry.lifecycleVersion,
      supportedByServeOS: true,
      integrationMode,
      availableFromProvider: unlocked,
      config,
      enabled,
      isDefault,
      readiness
    };
  });
}

export function getVenuePaymentMethodsPayload(
  settings: VenuePaymentSettings,
  options?: VenuePaymentMethodsPayloadOptions
) {
  const methods = buildVenuePaymentMethodViews(settings, options);
  return {
    catalogVersion: SERVEOS_PAYMENT_CATALOG_VERSION,
    methods,
    counts: {
      total: methods.length,
      enabled: methods.filter((m) => m.enabled).length,
      setupRequired: methods.filter((m) => m.readiness.status === "SETUP_REQUIRED").length,
      ready: methods.filter((m) => m.readiness.status === "READY").length,
      issues: methods.filter((m) => m.readiness.uiHealth === "issue").length
    }
  };
}

export function getSingleVenuePaymentMethod(
  settings: VenuePaymentSettings,
  methodKey: string,
  options?: VenuePaymentMethodsPayloadOptions
): VenuePaymentMethodView | null {
  if (!getCatalogEntry(methodKey)) return null;
  return buildVenuePaymentMethodViews(settings, options).find((m) => m.key === methodKey) ?? null;
}

export { CATALOG_METHOD_KEYS, getMethodCapabilities };

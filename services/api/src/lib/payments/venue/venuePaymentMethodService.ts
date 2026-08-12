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
  integrationMode: "direct";
  config: PaymentMethodConfig | null;
  enabled: boolean;
  isDefault: boolean;
  readiness: PaymentMethodReadiness;
};

function resolveConfig(settings: VenuePaymentSettings, key: PaymentMethodKey): PaymentMethodConfig | null {
  return settings.methodConfig?.[key] ?? null;
}

export function buildVenuePaymentMethodViews(settings: VenuePaymentSettings): VenuePaymentMethodView[] {
  const envReady = getPaymentProviderEnvReady();
  return SERVEOS_PAYMENT_CATALOG.map((entry) => {
    const config = resolveConfig(settings, entry.key);
    const enabled = Boolean(config?.enabled ?? settings.methods[entry.key]);
    const isDefault =
      settings.defaultPaymentMethodKey === entry.key || Boolean(config?.isDefault);
    const readiness = evaluatePaymentMethodReadiness(settings, envReady, entry.key);
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
      integrationMode: "direct",
      config,
      enabled,
      isDefault,
      readiness
    };
  });
}

export function getVenuePaymentMethodsPayload(settings: VenuePaymentSettings) {
  const methods = buildVenuePaymentMethodViews(settings);
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
  methodKey: string
): VenuePaymentMethodView | null {
  if (!getCatalogEntry(methodKey)) return null;
  return buildVenuePaymentMethodViews(settings).find((m) => m.key === methodKey) ?? null;
}

export { CATALOG_METHOD_KEYS };

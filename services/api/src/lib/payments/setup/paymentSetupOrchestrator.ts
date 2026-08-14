import { getMethodCapabilities } from "../catalog/paymentMethodCapabilities.js";
import { getCatalogEntry } from "../catalog/paymentMethodCatalog.js";
import {
  getSetupStepsForMethod,
  type PaymentSetupStep,
  type PaymentSetupStepId
} from "../catalog/paymentMethodRequirements.js";
import { resolveAdapterConnection } from "../providers/providerCapabilityResolver.js";
import {
  evaluatePaymentMethodReadiness,
  type PaymentMethodReadiness
} from "../venue/paymentMethodReadiness.js";
import {
  getPaymentProviderEnvReady,
  type VenuePaymentSettings
} from "../venue/venuePaymentSettingsService.js";
import { resolveConnectionSurface } from "./paymentSetupSessionService.js";

export type PaymentSetupContract = {
  methodKey: string;
  label: string;
  status: PaymentMethodReadiness["status"];
  reason: string;
  nextAction: PaymentMethodReadiness["nextAction"];
  missingRequirements: string[];
  setupSteps: Array<
    PaymentSetupStep & {
      state: "done" | "current" | "upcoming" | "blocked";
    }
  >;
  readiness: PaymentMethodReadiness;
};

function adapterSurface(methodKey: string) {
  const entry = getCatalogEntry(methodKey);
  if (!entry || entry.requiredAdapter === "native") return "native" as const;
  if (entry.requiredAdapter === "swish") return "swish" as const;
  if (entry.requiredAdapter === "terminal") return "terminals" as const;
  return "stripe" as const;
}

function stepState(
  stepId: PaymentSetupStepId,
  readiness: PaymentMethodReadiness,
  settings: VenuePaymentSettings,
  methodKey: string
): "done" | "current" | "upcoming" | "blocked" {
  const entry = getCatalogEntry(methodKey);
  const envReady = getPaymentProviderEnvReady();
  const adapter = entry
    ? resolveAdapterConnection(settings, envReady, entry.requiredAdapter)
    : null;
  const config = settings.methodConfig?.[methodKey as keyof typeof settings.methodConfig];
  const hasSources = Boolean(config?.supportedOrderSources?.length);
  const surface = resolveConnectionSurface(settings, adapterSurface(methodKey));

  const done = new Set<PaymentSetupStepId>();
  if (surface === "managed" || surface === "native" || adapter?.connected) done.add("CONNECT_ADAPTER");
  if (surface === "managed" || surface === "native" || adapter?.accountOrMerchantId || adapter?.connected) {
    done.add("PROVIDE_CREDENTIALS");
  }
  if (surface === "managed" || surface === "native" || adapter?.verified) done.add("VERIFY_CONNECTION");
  if (hasSources) done.add("CONFIGURE_CHANNELS");
  done.add("CONFIGURE_PAYMENT_RULES");
  done.add("TEST_PAYMENT");
  if (readiness.status === "ENABLED") done.add("ACTIVATE");

  if (done.has(stepId)) return "done";

  const order: PaymentSetupStepId[] =
    surface === "managed" || surface === "native"
      ? ["CONFIGURE_CHANNELS", "ACTIVATE"]
      : [
          "CONNECT_ADAPTER",
          "PROVIDE_CREDENTIALS",
          "VERIFY_CONNECTION",
          "CONFIGURE_CHANNELS",
          "ACTIVATE"
        ];
  const firstOpen = order.find((id) => !done.has(id));
  if (firstOpen === stepId) return "current";
  return "upcoming";
}

export function getPaymentMethodSetupContract(
  settings: VenuePaymentSettings,
  methodKey: string
): PaymentSetupContract | null {
  const entry = getCatalogEntry(methodKey);
  if (!entry) return null;

  const envReady = getPaymentProviderEnvReady();
  const readiness = evaluatePaymentMethodReadiness(settings, envReady, methodKey);
  const surface = resolveConnectionSurface(settings, adapterSurface(methodKey));
  const steps = getSetupStepsForMethod(methodKey, surface);

  return {
    methodKey: entry.key,
    label: entry.label,
    status: readiness.status,
    reason: readiness.reason,
    nextAction: readiness.nextAction,
    missingRequirements: readiness.missingRequirementLabels,
    setupSteps: steps.map((step) => ({
      ...step,
      state: stepState(step.id, readiness, settings, methodKey)
    })),
    readiness
  };
}

export function describeSetupStepResult(
  methodKey: string,
  step: PaymentSetupStepId,
  ok: boolean,
  message?: string
) {
  const caps = getMethodCapabilities(methodKey);
  return {
    ok,
    step,
    message:
      message ??
      (ok
        ? `Step ${step} completed.`
        : `Step ${step} could not be completed yet.`),
    capabilities: caps
  };
}

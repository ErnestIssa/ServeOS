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

  const done = new Set<PaymentSetupStepId>();
  if (entry?.requiredAdapter === "native" || adapter?.connected) done.add("CONNECT_ADAPTER");
  if (entry?.requiredAdapter === "native" || adapter?.accountOrMerchantId || adapter?.connected) {
    done.add("PROVIDE_CREDENTIALS");
  }
  if (entry?.requiredAdapter === "native" || adapter?.verified) done.add("VERIFY_CONNECTION");
  if (hasSources) done.add("CONFIGURE_CHANNELS");
  done.add("CONFIGURE_PAYMENT_RULES");
  if (readiness.status === "READY" || readiness.status === "ENABLED") done.add("TEST_PAYMENT");
  if (readiness.status === "ENABLED") done.add("ACTIVATE");

  if (done.has(stepId)) return "done";

  const order: PaymentSetupStepId[] = [
    "CONNECT_ADAPTER",
    "PROVIDE_CREDENTIALS",
    "VERIFY_CONNECTION",
    "CONFIGURE_CHANNELS",
    "CONFIGURE_PAYMENT_RULES",
    "TEST_PAYMENT",
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
  const steps = getSetupStepsForMethod(methodKey);

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

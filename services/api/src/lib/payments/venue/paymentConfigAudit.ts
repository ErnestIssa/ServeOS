export type PaymentConfigAuditAction =
  | "payment.method_setup_started"
  | "payment.provider_connected"
  | "payment.credentials_updated"
  | "payment.credentials_rotated"
  | "payment.method_verified"
  | "payment.method_verification_failed"
  | "payment.method_enabled"
  | "payment.method_disabled"
  | "payment.method_default_changed"
  | "payment.provider_disconnected"
  | "payment.configuration_failed"
  | "payment.configuration_recovered"
  | "payment.provider_health_changed"
  | "payment_settings_updated"
  | "payment_method_updated"
  | "payment_method_activated";

export type PaymentConfigAuditEntry = {
  id: string;
  at: string;
  action: PaymentConfigAuditAction | string;
  actorUserId?: string;
  actorRole?: string;
  restaurantId?: string;
  methodKey?: string;
  provider?: string;
  previousState?: string | null;
  newState?: string | null;
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export function createPaymentAuditEntry(
  partial: Omit<PaymentConfigAuditEntry, "id" | "at"> & { id?: string; at?: string }
): PaymentConfigAuditEntry {
  return {
    id: partial.id ?? `pay_aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    at: partial.at ?? new Date().toISOString(),
    action: partial.action,
    actorUserId: partial.actorUserId,
    actorRole: partial.actorRole,
    restaurantId: partial.restaurantId,
    methodKey: partial.methodKey,
    provider: partial.provider,
    previousState: partial.previousState,
    newState: partial.newState,
    path: partial.path,
    // Never persist raw secrets in audit payloads
    oldValue: sanitizeAuditValue(partial.oldValue),
    newValue: sanitizeAuditValue(partial.newValue)
  };
}

function sanitizeAuditValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const obj = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("certificate") ||
      lower.includes("encrypted")
    ) {
      obj[key] = "[redacted]";
    }
  }
  return obj;
}

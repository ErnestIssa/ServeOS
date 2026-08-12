export type PaymentRiskSignalType =
  | "repeated_payment_failures"
  | "excessive_retries"
  | "multiple_instruments_per_order"
  | "high_refund_velocity"
  | "staff_external_payment"
  | "manual_override"
  | "refund_immediately_after_payment"
  | "method_toggle_churn"
  | "failed_qr_burst"
  | "unknown_outcome";

export type PaymentRiskSignal = {
  id: string;
  type: PaymentRiskSignalType;
  restaurantId: string;
  orderId?: string;
  severity: "info" | "warning" | "high";
  at: string;
  metadata?: Record<string, unknown>;
};

const SIGNALS: PaymentRiskSignal[] = [];

export function emitPaymentRiskSignal(
  partial: Omit<PaymentRiskSignal, "id" | "at"> & { id?: string; at?: string }
): PaymentRiskSignal {
  const signal: PaymentRiskSignal = {
    id: partial.id ?? `risk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: partial.at ?? new Date().toISOString(),
    type: partial.type,
    restaurantId: partial.restaurantId,
    orderId: partial.orderId,
    severity: partial.severity,
    metadata: partial.metadata
  };
  SIGNALS.unshift(signal);
  if (SIGNALS.length > 500) SIGNALS.length = 500;
  return signal;
}

export function listPaymentRiskSignals(restaurantId: string, limit = 50): PaymentRiskSignal[] {
  return SIGNALS.filter((s) => s.restaurantId === restaurantId).slice(0, limit);
}

export function clearPaymentRiskSignals() {
  SIGNALS.length = 0;
}

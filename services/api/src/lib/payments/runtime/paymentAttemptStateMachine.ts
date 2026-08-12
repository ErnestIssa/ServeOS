/**
 * Canonical ServeOS payment-attempt lifecycle (provider-agnostic).
 * Order.paymentStatus is DERIVED from attempts — never from frontend claims.
 */

export type PaymentAttemptStatus =
  | "CREATED"
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "AUTHORIZED"
  | "CAPTURE_PENDING"
  | "CAPTURED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REQUIRES_RETRY"
  | "UNKNOWN"
  | "REQUIRES_RECONCILIATION"
  | "REVERSED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "CHARGEBACK"
  | "DISPUTED"
  | "PAYMENT_ORDER_MISMATCH";

/** Terminal financial states — further charge transitions are blocked. */
export const TERMINAL_PAYMENT_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  "SUCCEEDED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REVERSED",
  "REFUNDED",
  "CHARGEBACK"
]);

/** States that still allow provider callbacks / reconciliation. */
export const RESOLVABLE_AFTER_DISABLE: ReadonlySet<PaymentAttemptStatus> = new Set([
  "CREATED",
  "REQUIRES_ACTION",
  "PROCESSING",
  "AUTHORIZED",
  "CAPTURE_PENDING",
  "UNKNOWN",
  "REQUIRES_RECONCILIATION",
  "PAYMENT_ORDER_MISMATCH",
  "PARTIALLY_REFUNDED",
  "DISPUTED"
]);

/** Active attempts that block creating another charge for the same obligation. */
export const ACTIVE_PAYMENT_ATTEMPT_STATUSES: ReadonlySet<PaymentAttemptStatus> = new Set([
  "CREATED",
  "REQUIRES_ACTION",
  "PROCESSING",
  "AUTHORIZED",
  "CAPTURE_PENDING",
  "UNKNOWN",
  "REQUIRES_RECONCILIATION"
]);

const ALLOWED: Record<PaymentAttemptStatus, ReadonlySet<PaymentAttemptStatus>> = {
  CREATED: new Set(["REQUIRES_ACTION", "PROCESSING", "CANCELLED", "EXPIRED", "FAILED"]),
  REQUIRES_ACTION: new Set([
    "PROCESSING",
    "AUTHORIZED",
    "SUCCEEDED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "UNKNOWN",
    "REQUIRES_RECONCILIATION"
  ]),
  PROCESSING: new Set([
    "AUTHORIZED",
    "CAPTURE_PENDING",
    "SUCCEEDED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "UNKNOWN",
    "REQUIRES_RECONCILIATION",
    "PAYMENT_ORDER_MISMATCH"
  ]),
  AUTHORIZED: new Set([
    "CAPTURE_PENDING",
    "CAPTURED",
    "SUCCEEDED",
    "CANCELLED",
    "REVERSED",
    "FAILED",
    "REQUIRES_RECONCILIATION"
  ]),
  CAPTURE_PENDING: new Set([
    "CAPTURED",
    "SUCCEEDED",
    "FAILED",
    "UNKNOWN",
    "REQUIRES_RECONCILIATION"
  ]),
  CAPTURED: new Set([
    "SUCCEEDED",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
    "REVERSED",
    "CHARGEBACK",
    "DISPUTED",
    "PAYMENT_ORDER_MISMATCH"
  ]),
  SUCCEEDED: new Set([
    "PARTIALLY_REFUNDED",
    "REFUNDED",
    "REVERSED",
    "CHARGEBACK",
    "DISPUTED",
    "PAYMENT_ORDER_MISMATCH"
  ]),
  FAILED: new Set(["REQUIRES_RETRY", "CANCELLED"]),
  CANCELLED: new Set(["PAYMENT_ORDER_MISMATCH"]), // late provider success → mismatch path only
  EXPIRED: new Set(["REQUIRES_RETRY", "PAYMENT_ORDER_MISMATCH"]),
  REQUIRES_RETRY: new Set(["CREATED", "REQUIRES_ACTION", "CANCELLED"]),
  UNKNOWN: new Set([
    "SUCCEEDED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "REQUIRES_RECONCILIATION",
    "PAYMENT_ORDER_MISMATCH"
  ]),
  REQUIRES_RECONCILIATION: new Set([
    "SUCCEEDED",
    "CAPTURED",
    "FAILED",
    "CANCELLED",
    "REFUNDED",
    "PAYMENT_ORDER_MISMATCH"
  ]),
  REVERSED: new Set([]),
  PARTIALLY_REFUNDED: new Set(["REFUNDED", "CHARGEBACK", "DISPUTED"]),
  REFUNDED: new Set(["CHARGEBACK", "DISPUTED"]),
  CHARGEBACK: new Set(["DISPUTED"]),
  DISPUTED: new Set(["CHARGEBACK", "REFUNDED", "SUCCEEDED"]),
  PAYMENT_ORDER_MISMATCH: new Set(["REQUIRES_RECONCILIATION", "REFUNDED", "CANCELLED"])
};

export type PaymentTransitionResult =
  | { ok: true; from: PaymentAttemptStatus; to: PaymentAttemptStatus }
  | { ok: false; from: PaymentAttemptStatus; to: PaymentAttemptStatus; error: string };

export function assertPaymentTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus
): PaymentTransitionResult {
  if (from === to) return { ok: true, from, to };
  const allowed = ALLOWED[from];
  if (!allowed?.has(to)) {
    return {
      ok: false,
      from,
      to,
      error: `Invalid payment transition ${from} → ${to}`
    };
  }
  // Never allow SUCCEEDED after CANCELLED except via PAYMENT_ORDER_MISMATCH path.
  if (from === "CANCELLED" && (to === "SUCCEEDED" || to === "CAPTURED")) {
    return {
      ok: false,
      from,
      to,
      error: "Cancelled payment cannot become SUCCEEDED; use PAYMENT_ORDER_MISMATCH reconciliation."
    };
  }
  return { ok: true, from, to };
}

export function applyPaymentTransition(
  from: PaymentAttemptStatus,
  to: PaymentAttemptStatus
): PaymentAttemptStatus {
  const result = assertPaymentTransition(from, to);
  if (!result.ok) {
    throw Object.assign(new Error(result.error), { statusCode: 409, code: "invalid_payment_transition" });
  }
  return to;
}

/** Map provider-ish event names into canonical states. */
export function mapProviderEventToStatus(eventType: string): PaymentAttemptStatus | null {
  const t = eventType.toLowerCase().replace(/[.\s-]+/g, "_");
  if (t.includes("require") && t.includes("action")) return "REQUIRES_ACTION";
  if (t.includes("processing") || t.includes("pending")) return "PROCESSING";
  if (t.includes("authoriz")) return "AUTHORIZED";
  if (t.includes("capture") && t.includes("pending")) return "CAPTURE_PENDING";
  if (t.includes("succeed") || t.includes("captured") || t.includes("paid") || t.includes("completed")) {
    return "SUCCEEDED";
  }
  if (t.includes("fail")) return "FAILED";
  if (t.includes("cancel")) return "CANCELLED";
  if (t.includes("expir")) return "EXPIRED";
  if (t.includes("partial") && t.includes("refund")) return "PARTIALLY_REFUNDED";
  if (t.includes("refund")) return "REFUNDED";
  if (t.includes("chargeback")) return "CHARGEBACK";
  if (t.includes("disput")) return "DISPUTED";
  if (t.includes("unknown") || t.includes("timeout")) return "UNKNOWN";
  return null;
}

/**
 * Out-of-order protection: reject transitions that would move "backwards"
 * when incoming event is older than last applied provider version.
 */
export function shouldApplyProviderEvent(input: {
  currentStatus: PaymentAttemptStatus;
  incomingStatus: PaymentAttemptStatus;
  lastEventVersion?: string | null;
  incomingEventVersion?: string | null;
  lastEventAtMs?: number | null;
  incomingEventAtMs?: number | null;
}): { apply: boolean; reason: string } {
  if (input.currentStatus === input.incomingStatus) {
    return { apply: false, reason: "idempotent_replay" };
  }
  if (
    input.lastEventVersion &&
    input.incomingEventVersion &&
    input.incomingEventVersion < input.lastEventVersion
  ) {
    return { apply: false, reason: "stale_event_version" };
  }
  if (
    input.lastEventAtMs != null &&
    input.incomingEventAtMs != null &&
    input.incomingEventAtMs < input.lastEventAtMs &&
    TERMINAL_PAYMENT_STATUSES.has(input.currentStatus)
  ) {
    return { apply: false, reason: "stale_event_timestamp_after_terminal" };
  }
  const transition = assertPaymentTransition(input.currentStatus, input.incomingStatus);
  if (!transition.ok) {
    // Idempotent replay of equivalent terminal success
    if (
      TERMINAL_PAYMENT_STATUSES.has(input.currentStatus) &&
      (input.incomingStatus === "SUCCEEDED" || input.incomingStatus === "CAPTURED") &&
      (input.currentStatus === "SUCCEEDED" || input.currentStatus === "CAPTURED")
    ) {
      return { apply: false, reason: "idempotent_replay" };
    }
    return { apply: false, reason: transition.error };
  }
  return { apply: true, reason: "ok" };
}

import type { PaymentLogRow } from "../../../api";

const CATEGORIES: PaymentLogRow["category"][] = [
  "webhook",
  "payment",
  "refund",
  "security",
  "config",
  "reconciliation"
];

const LEVELS: PaymentLogRow["level"][] = [
  "info",
  "info",
  "info",
  "warn",
  "info",
  "error",
  "info",
  "warn"
];

const MESSAGES: Record<PaymentLogRow["category"], string[]> = {
  webhook: [
    "Webhook received · payment.succeeded",
    "Webhook received · payment.failed",
    "Duplicate event ignored",
    "Webhook received · charge.refunded",
    "Webhook retry delivered",
    "Webhook received · payout.paid"
  ],
  payment: [
    "Payment intent created",
    "Payment authorized",
    "Payment captured",
    "Payment authorization failed",
    "Terminal capture confirmed",
    "Pay at venue marked paid"
  ],
  refund: [
    "Refund requested",
    "Refund sent to provider",
    "Refund completed",
    "Partial refund captured",
    "Refund failed at provider"
  ],
  security: [
    "Webhook signature rejected",
    "Idempotency key reused",
    "Rate limit approaching",
    "API key rotated"
  ],
  config: [
    "Default payment method updated",
    "Pay at venue rules saved",
    "Provider credentials verified",
    "Refund policy updated"
  ],
  reconciliation: [
    "Reconciliation mismatch detected",
    "Mismatch marked investigating",
    "Daily settlement matched",
    "Fee delta above threshold"
  ]
};

function metaFor(category: PaymentLogRow["category"], i: number): Record<string, unknown> {
  const orderNum = 18420 + (i % 40);
  if (category === "webhook") {
    return {
      eventType: i % 3 === 0 ? "payment.succeeded" : "payment.updated",
      provider: i % 4 === 0 ? "swish" : "stripe",
      requestId: `req_${String(i + 11).padStart(4, "0")}`,
      httpStatus: 200
    };
  }
  if (category === "payment") {
    return { paymentId: `pay_demo_${String(i + 1).padStart(2, "0")}`, orderId: `#${orderNum}`, provider: "stripe" };
  }
  if (category === "refund") {
    return { refundId: `re_demo_${String(i + 1).padStart(2, "0")}`, orderId: `#${orderNum}`, amountCents: 4500 + i * 80 };
  }
  if (category === "security") {
    return { reason: i % 2 === 0 ? "bad_signature" : "replay_window", ip: "203.0.113.12" };
  }
  if (category === "config") {
    return { actorRole: "owner", path: "payment-settings" };
  }
  return { provider: "stripe", deltaCents: 1200 + i * 15, payoutId: `po_demo_${String((i % 12) + 1).padStart(2, "0")}` };
}

export function buildDemoLogs(count = 50): PaymentLogRow[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const category = CATEGORIES[i % CATEGORIES.length];
    const level = LEVELS[i % LEVELS.length];
    const pool = MESSAGES[category];
    return {
      id: `log_demo_${String(i + 1).padStart(2, "0")}`,
      source: "demo",
      category,
      level: category === "security" && i % 3 === 0 ? "warn" : level,
      message: pool[i % pool.length],
      at: new Date(now - (i * 1.7 + 0.2) * 60 * 60 * 1000).toISOString(),
      meta: metaFor(category, i)
    };
  });
}

export function toLogRows(live: PaymentLogRow[]): PaymentLogRow[] {
  const demo = buildDemoLogs(50);
  const ids = new Set(live.map((row) => row.id));
  return [...live, ...demo.filter((row) => !ids.has(row.id))];
}

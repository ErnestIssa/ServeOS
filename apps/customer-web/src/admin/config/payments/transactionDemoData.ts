import type { PaymentTransactionDetail, PaymentTransactionRow, PaymentTxnStatus } from "../../../api";

const GUESTS = [
  "Anna Berg",
  "Oscar Lind",
  "Fatima Ali",
  "Hugo Ek",
  "Nora Holm",
  "Elias Nyberg",
  "Sara Idris",
  "Willem Vos",
  "Yara Haddad",
  "Maja Ström"
];

const METHODS = [
  "visa",
  "mastercard",
  "swish",
  "applePay",
  "googlePay",
  "klarnaPayNow",
  "cash",
  "cardTerminal",
  "amex",
  "swish"
] as const;

const STATUSES: PaymentTxnStatus[] = [
  "captured",
  "captured",
  "captured",
  "pending",
  "failed",
  "partially_refunded",
  "refunded",
  "disputed",
  "captured",
  "authorized"
];

function providerForMethod(method: string) {
  if (method === "swish" || method === "swishAtVenue") return "swish";
  if (method.startsWith("klarna")) return "klarna";
  if (method === "cash") return "manual";
  return "stripe";
}

export function demoTransactionTimeline(row: PaymentTransactionRow): PaymentTransactionDetail["timeline"] {
  const created = new Date(row.createdAt).getTime();
  const events: PaymentTransactionDetail["timeline"] = [
    { at: row.createdAt, type: "created", label: "Payment created" }
  ];
  if (row.status === "pending" || row.status === "authorized") {
    events.push({ at: new Date(created + 20_000).toISOString(), type: "authorized", label: "Authorized" });
    return events;
  }
  if (row.status === "failed" || row.status === "cancelled") {
    events.push({
      at: new Date(created + 12_000).toISOString(),
      type: "failed",
      label: row.status === "cancelled" ? "Cancelled" : "Capture failed"
    });
    return events;
  }
  events.push({ at: new Date(created + 25_000).toISOString(), type: "captured", label: "Captured" });
  if (row.status === "partially_refunded" || row.status === "refunded") {
    events.push({
      at: row.updatedAt,
      type: "refunded",
      label: row.status === "refunded" ? "Fully refunded" : "Partially refunded"
    });
  }
  if (row.status === "disputed" || row.status === "charged_back") {
    events.push({ at: row.updatedAt, type: "disputed", label: "Dispute opened" });
  }
  return events;
}

export function buildDemoTransactions(count = 50): PaymentTransactionRow[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const method = METHODS[i % METHODS.length];
    const status = STATUSES[i % STATUSES.length];
    const created = new Date(now - (i * 2.4 + 0.4) * 60 * 60 * 1000).toISOString();
    const updated = new Date(now - (i * 2.4) * 60 * 60 * 1000).toISOString();
    const amountCents = [4500, 8900, 12500, 18600, 24900, 32000, 47500, 68000, 92000, 15400][i % 10] + (i % 9) * 100;
    const tipCents = i % 4 === 0 ? 0 : Math.round(amountCents * 0.08);
    const feeCents = Math.round(amountCents * 0.015);
    const refundedCents =
      status === "refunded" ? amountCents : status === "partially_refunded" ? Math.round(amountCents * 0.35) : 0;
    const orderNum = 18420 + i;
    return {
      id: `txn_demo_${String(i + 1).padStart(2, "0")}`,
      source: "demo",
      orderId: `ord_demo_${orderNum}`,
      orderDisplay: `#${orderNum}`,
      customerLabel: GUESTS[i % GUESTS.length],
      amountCents,
      tipCents,
      feeCents,
      netCents: amountCents + tipCents - feeCents - refundedCents,
      currency: "SEK",
      method,
      provider: providerForMethod(method),
      status,
      refundedCents,
      createdAt: created,
      updatedAt: updated
    };
  });
}

export function toTransactionRows(live: PaymentTransactionRow[]): PaymentTransactionRow[] {
  const demo = buildDemoTransactions(50);
  const ids = new Set(live.map((t) => t.id));
  return [...live, ...demo.filter((d) => !ids.has(d.id))];
}

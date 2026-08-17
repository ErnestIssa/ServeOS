import { methodLabel } from "./paymentsUiHelpers";
import type { RefundListRow } from "./refundsListQuery";

const REASONS = [
  "Wrong item",
  "Duplicate charge",
  "Customer complaint",
  "Kitchen error",
  "Cancelled order",
  "Missing items",
  "Quality issue",
  "Wait time too long",
  "Tip adjustment",
  "Table closed early",
  "Allergy incident",
  "Overcharged"
];

const STAFF = ["Amina K.", "Erik L.", "Sofia N.", "Jonas P.", "Maja R.", "Noah T.", "Leila S.", "Viktor H."];
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
const STATUSES: RefundListRow["status"][] = [
  "completed",
  "completed",
  "completed",
  "pending_approval",
  "processing",
  "failed",
  "partially_refunded",
  "completed",
  "pending_approval",
  "processing"
];

function providerForMethod(methodKey: string) {
  if (methodKey === "swish" || methodKey === "swishAtVenue") return "swish";
  if (methodKey.startsWith("klarna")) return "klarna";
  if (methodKey === "cash") return "manual";
  if (methodKey === "cardTerminal") return "stripe";
  return "stripe";
}

export function buildDemoRefunds(count = 50): RefundListRow[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const methodKey = METHODS[i % METHODS.length];
    const status = STATUSES[i % STATUSES.length];
    const created = new Date(now - (i * 3.7 + 2) * 60 * 60 * 1000).toISOString();
    const completed =
      status === "completed" || status === "partially_refunded"
        ? new Date(now - (i * 3.7 + 0.6) * 60 * 60 * 1000).toISOString()
        : null;
    const amountCents = [4500, 8900, 12500, 18600, 24900, 32000, 47500, 68000, 92000, 12800][i % 10] + (i % 7) * 100;
    const staff = STAFF[i % STAFF.length];
    return {
      id: `rf_demo_${String(i + 1).padStart(2, "0")}`,
      source: "demo",
      paymentId: `pay_demo_${String(10420 + i)}`,
      orderId: `ORD-${10420 + i}`,
      amountCents,
      currency: "SEK",
      reason: REASONS[i % REASONS.length],
      requestedBy: staff,
      approvedBy: status === "pending_approval" ? null : STAFF[(i + 3) % STAFF.length],
      provider: providerForMethod(methodKey),
      status,
      createdAt: created,
      completedAt: completed,
      methodKey,
      methodLabel: methodLabel(methodKey),
      guestName: GUESTS[i % GUESTS.length]
    };
  });
}

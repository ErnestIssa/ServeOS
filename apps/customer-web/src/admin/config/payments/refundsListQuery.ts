import type { PaymentRefundRow } from "../../../api";
import type { MenuListQueryPreset } from "../menu/menuListQuery";

export type RefundStatusFilter =
  | "all"
  | "pending_approval"
  | "processing"
  | "completed"
  | "failed"
  | "partially_refunded";

export type RefundListRow = PaymentRefundRow & {
  methodKey: string;
  methodLabel: string;
  guestName: string;
};

export const REFUND_STATUS_ORDER: RefundStatusFilter[] = [
  "pending_approval",
  "processing",
  "completed",
  "failed",
  "partially_refunded"
];

export function refundStatusHeading(status: RefundStatusFilter) {
  if (status === "pending_approval") return "Pending approval";
  if (status === "processing") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "partially_refunded") return "Partial";
  return "All";
}

export function refundStatusBadge(status: PaymentRefundRow["status"]) {
  if (status === "pending_approval") return "Pending";
  if (status === "processing") return "Processing";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Partial";
}

export function refundStatusTone(
  status: PaymentRefundRow["status"]
): "active" | "pending" | "setup" | "issue" | "inactive" {
  if (status === "completed") return "active";
  if (status === "processing") return "pending";
  if (status === "pending_approval") return "setup";
  if (status === "failed") return "issue";
  return "pending";
}

export const REFUNDS_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "newest",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:pending_approval", label: "Pending approval", description: "Waiting for a manager" },
        { id: "status:processing", label: "Processing", description: "Sent to the provider" },
        { id: "status:completed", label: "Completed", description: "Returned to the guest" },
        { id: "status:failed", label: "Failed", description: "Provider or policy blocked it" },
        { id: "status:partially_refunded", label: "Partial", description: "Only part of the payment" }
      ]
    },
    {
      id: "method",
      label: "Method",
      options: [
        { id: "method:card", label: "Card / wallet", description: "Cards and wallets" },
        { id: "method:swish", label: "Swish", description: "Swish rails" },
        { id: "method:klarna", label: "Klarna", description: "Klarna refunds" },
        { id: "method:cash", label: "Cash", description: "Manual cash return" },
        { id: "method:terminal", label: "Terminal", description: "In-person card" }
      ]
    },
    {
      id: "provider",
      label: "Provider",
      options: [
        { id: "provider:stripe", label: "Stripe", description: "Stripe-processed" },
        { id: "provider:swish", label: "Swish", description: "Swish-processed" },
        { id: "provider:manual", label: "Manual", description: "Staff-recorded" }
      ]
    }
  ],
  sortOptions: [
    { id: "newest", label: "Newest first" },
    { id: "oldest", label: "Oldest first" },
    { id: "amount_desc", label: "Amount high–low" },
    { id: "amount_asc", label: "Amount low–high" },
    { id: "status_asc", label: "Status" }
  ]
};

export function matchesRefundSearch(row: RefundListRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.reason,
    row.guestName,
    row.methodLabel,
    row.methodKey,
    row.orderId,
    row.paymentId,
    row.requestedBy,
    row.approvedBy,
    row.provider,
    row.status,
    refundStatusBadge(row.status)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function refundFilterMatch(row: RefundListRow, id: string) {
  if (id.startsWith("status:")) return row.status === id.slice("status:".length);
  if (id === "method:card") return ["visa", "mastercard", "amex", "card", "applePay", "googlePay", "samsungPay"].includes(row.methodKey);
  if (id === "method:swish") return row.methodKey === "swish" || row.methodKey === "swishAtVenue";
  if (id === "method:klarna") return row.methodKey.startsWith("klarna");
  if (id === "method:cash") return row.methodKey === "cash";
  if (id === "method:terminal") return row.methodKey === "cardTerminal";
  if (id.startsWith("provider:")) return row.provider === id.slice("provider:".length);
  return false;
}

export function applyRefundFilters(rows: RefundListRow[], active: string[]) {
  if (!active.length) return rows;
  const groups = REFUNDS_LIST_QUERY.filterGroups;
  return rows.filter((row) => {
    for (const group of groups) {
      const selected = group.options.map((o) => o.id).filter((id) => active.includes(id));
      if (!selected.length) continue;
      if (!selected.some((id) => refundFilterMatch(row, id))) return false;
    }
    return true;
  });
}

export function applyRefundStatusFilter(rows: RefundListRow[], status: RefundStatusFilter) {
  if (status === "all") return rows;
  return rows.filter((row) => row.status === status);
}

export function applyRefundSort(rows: RefundListRow[], sortId: string | null) {
  const id = sortId || REFUNDS_LIST_QUERY.defaultSort;
  const next = [...rows];
  const rank = (status: PaymentRefundRow["status"]) => REFUND_STATUS_ORDER.indexOf(status);
  next.sort((a, b) => {
    if (id === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (id === "amount_desc") return b.amountCents - a.amountCents;
    if (id === "amount_asc") return a.amountCents - b.amountCents;
    if (id === "status_asc") return rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt);
    return b.createdAt.localeCompare(a.createdAt);
  });
  return next;
}

export function groupRefundsByStatus(rows: RefundListRow[]) {
  return REFUND_STATUS_ORDER.map((status) => ({
    status,
    label: refundStatusHeading(status),
    rows: rows.filter((row) => row.status === status)
  })).filter((section) => section.rows.length > 0);
}

export function methodKeyFromRefund(row: PaymentRefundRow): string {
  const provider = row.provider.toLowerCase();
  if (provider.includes("swish")) return "swish";
  if (provider.includes("klarna")) return "klarnaPayNow";
  if (provider.includes("cash") || provider.includes("manual")) return "cash";
  if (provider.includes("terminal")) return "cardTerminal";
  return "visa";
}

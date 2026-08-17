import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { MenuListQueryPreset } from "../menu/menuListQuery";
import type { PaymentReconciliation } from "../../../api";

export type MismatchStatus = "open" | "investigating" | "resolved";
export type MismatchStatusFilter = "all" | "open" | "investigating";

export const MISMATCH_STATUS_ORDER: Array<Exclude<MismatchStatusFilter, "all">> = ["open", "investigating"];

export const MISMATCHES_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "newest",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:open", label: "Open", description: "Still needs a decision" },
        { id: "status:investigating", label: "Investigating", description: "Staff is checking the ledger" }
      ]
    },
    {
      id: "type",
      label: "Type",
      options: [
        { id: "type:payment_without_order", label: "Orphan payment", description: "Provider payment with no order" },
        { id: "type:paid_order_missing_payment", label: "Missing payment", description: "Paid order with no provider event" },
        { id: "type:wrong_amount", label: "Amount mismatch", description: "Totals do not agree" },
        { id: "type:duplicate_capture", label: "Duplicate capture", description: "More than one capture" },
        { id: "type:refund_not_posted", label: "Refund not posted", description: "Refund missing at the provider" },
        { id: "type:tip_mismatch", label: "Tip mismatch", description: "Tip amounts differ" },
        { id: "type:currency_mismatch", label: "Currency mismatch", description: "Currency does not match" }
      ]
    },
    {
      id: "provider",
      label: "Provider",
      options: [
        { id: "provider:stripe", label: "Stripe", description: "Stripe-processed" },
        { id: "provider:swish", label: "Swish", description: "Swish-processed" },
        { id: "provider:klarna", label: "Klarna", description: "Klarna-processed" },
        { id: "provider:manual", label: "Manual", description: "Staff-recorded" }
      ]
    }
  ],
  sortOptions: [
    { id: "newest", label: "Newest first" },
    { id: "oldest", label: "Oldest first" },
    { id: "amount_desc", label: "Amount high–low" },
    { id: "amount_asc", label: "Amount low–high" },
    { id: "status_asc", label: "Status" },
    { id: "type_asc", label: "Type" }
  ]
};

export function mismatchStatusHeading(status: MismatchStatusFilter) {
  if (status === "open") return "Open";
  if (status === "investigating") return "Investigating";
  return "All";
}

export type ReconciliationMismatchRow = PaymentReconciliation["mismatches"][number] & {
  provider: string;
  status: MismatchStatus;
};

export type MismatchActionId =
  | "view"
  | "match_to_order"
  | "recalculate_amount"
  | "retry_provider"
  | "mark_investigating"
  | "mark_resolved"
  | "ignore"
  | "copy_id"
  | "copy_order_id"
  | "copy_payment_id";

export function mismatchTypeLabel(type: string) {
  if (type === "payment_without_order") return "Orphan payment";
  if (type === "paid_order_missing_payment") return "Missing payment";
  if (type === "wrong_amount") return "Amount mismatch";
  if (type === "duplicate_capture") return "Duplicate capture";
  if (type === "refund_not_posted") return "Refund not posted";
  if (type === "tip_mismatch") return "Tip mismatch";
  if (type === "currency_mismatch") return "Currency mismatch";
  return type.replace(/_/g, " ");
}

export function mismatchStatusBadge(status: MismatchStatus) {
  if (status === "investigating") return "Investigating";
  if (status === "resolved") return "Resolved";
  return "Open";
}

export function mismatchTone(row: ReconciliationMismatchRow) {
  if (row.status === "resolved") return "ready";
  if (row.status === "investigating") return "pending";
  if (row.type === "wrong_amount" || row.type === "duplicate_capture") return "issue";
  return "setup";
}

export function buildMismatchActions(
  row: ReconciliationMismatchRow,
  caps: { canEdit: boolean }
): EntityMenuAction[] {
  const actions: EntityMenuAction[] = [{ id: "view", label: "View details" }];
  const open = row.status !== "resolved";

  if (caps.canEdit && open && (row.type === "payment_without_order" || row.type === "paid_order_missing_payment")) {
    actions.push({ id: "match_to_order", label: "Match to order" });
  }
  if (caps.canEdit && open && row.type === "wrong_amount") {
    actions.push({ id: "recalculate_amount", label: "Recalculate amount" });
  }
  if (caps.canEdit && open) {
    actions.push({ id: "retry_provider", label: `Refresh from ${providerLabel(row.provider)}` });
    if (row.status === "open") {
      actions.push({ id: "mark_investigating", label: "Mark as investigating" });
    }
    actions.push({ id: "mark_resolved", label: "Mark as resolved" });
    actions.push({ id: "ignore", label: "Ignore mismatch", danger: true });
  }
  if (row.orderId) actions.push({ id: "copy_order_id", label: "Copy order ID" });
  if (row.paymentId) actions.push({ id: "copy_payment_id", label: "Copy payment ID" });
  actions.push({ id: "copy_id", label: "Copy mismatch ID" });
  return actions;
}

export function providerLabel(provider: string) {
  if (provider === "swish") return "Swish";
  if (provider === "klarna") return "Klarna";
  if (provider === "stripe") return "Stripe";
  if (provider === "manual") return "manual ledger";
  return provider;
}

export function buildDemoMismatches(count = 32, now = Date.now()): ReconciliationMismatchRow[] {
  const hours = (h: number) => new Date(now - h * 3600_000).toISOString();
  const seeds: ReconciliationMismatchRow[] = [
    {
      id: "mm_1",
      type: "payment_without_order",
      summary: "Provider payment with no ServeOS order",
      orderId: null,
      paymentId: "demo_orphan_01",
      amountCents: 18_500,
      createdAt: hours(3),
      provider: "stripe",
      status: "open"
    },
    {
      id: "mm_2",
      type: "wrong_amount",
      summary: "Order total does not match captured payment",
      orderId: "demo_ord_05",
      paymentId: "demo_txn_05",
      amountCents: 8_000,
      createdAt: hours(6),
      provider: "stripe",
      status: "open"
    },
    {
      id: "mm_3",
      type: "paid_order_missing_payment",
      summary: "Paid order is missing a provider reference",
      orderId: "demo_ord_18",
      paymentId: null,
      amountCents: 24_900,
      createdAt: hours(8),
      provider: "swish",
      status: "investigating"
    },
    {
      id: "mm_4",
      type: "duplicate_capture",
      summary: "Two captures posted for the same order",
      orderId: "demo_ord_22",
      paymentId: "demo_txn_22b",
      amountCents: 12_500,
      createdAt: hours(11),
      provider: "stripe",
      status: "open"
    },
    {
      id: "mm_5",
      type: "refund_not_posted",
      summary: "ServeOS refund is not on the provider ledger",
      orderId: "demo_ord_09",
      paymentId: "demo_txn_09",
      amountCents: 4_500,
      createdAt: hours(14),
      provider: "klarna",
      status: "open"
    },
    {
      id: "mm_6",
      type: "tip_mismatch",
      summary: "Tip captured by terminal differs from the order tip",
      orderId: "demo_ord_31",
      paymentId: "demo_txn_31",
      amountCents: 2_000,
      createdAt: hours(18),
      provider: "stripe",
      status: "investigating"
    },
    {
      id: "mm_7",
      type: "wrong_amount",
      summary: "Swish payout is 1 kr below the ServeOS total",
      orderId: "demo_ord_44",
      paymentId: "pay_swish_44",
      amountCents: 100,
      createdAt: hours(22),
      provider: "swish",
      status: "open"
    },
    {
      id: "mm_8",
      type: "payment_without_order",
      summary: "Klarna settlement arrived without a matching order",
      orderId: null,
      paymentId: "klarna_set_08",
      amountCents: 67_800,
      createdAt: hours(27),
      provider: "klarna",
      status: "open"
    },
    {
      id: "mm_9",
      type: "currency_mismatch",
      summary: "Provider posted EUR while the order was captured in SEK",
      orderId: "demo_ord_52",
      paymentId: "demo_txn_52",
      amountCents: 31_200,
      createdAt: hours(31),
      provider: "stripe",
      status: "open"
    },
    {
      id: "mm_10",
      type: "paid_order_missing_payment",
      summary: "Table 12 was marked paid with no matching provider event",
      orderId: "demo_ord_61",
      paymentId: null,
      amountCents: 15_800,
      createdAt: hours(36),
      provider: "manual",
      status: "investigating"
    }
  ];
  if (count <= seeds.length) return seeds.slice(0, count);

  const types = [
    "payment_without_order",
    "wrong_amount",
    "paid_order_missing_payment",
    "duplicate_capture",
    "refund_not_posted",
    "tip_mismatch",
    "currency_mismatch"
  ] as const;
  const providers = ["stripe", "swish", "klarna", "manual"] as const;
  const summaries = [
    "Captured amount is off the ServeOS ticket",
    "Provider event arrived after the table closed",
    "Refund is on ServeOS but missing at the provider",
    "Second capture posted for the same check",
    "Tip on the terminal does not match the order",
    "Paid in venue with no matching provider row",
    "Settlement currency does not match the order"
  ];
  const extra = Array.from({ length: count - seeds.length }, (_, i) => {
    const n = seeds.length + i + 1;
    const type = types[i % types.length];
    const provider = providers[i % providers.length];
    const hasOrder = type !== "payment_without_order";
    const hasPayment = type !== "paid_order_missing_payment";
    return {
      id: `mm_${n}`,
      type,
      summary: summaries[i % summaries.length],
      orderId: hasOrder ? `demo_ord_${80 + n}` : null,
      paymentId: hasPayment ? `demo_txn_${80 + n}` : null,
      amountCents: [3_200, 7_800, 11_400, 19_500, 26_000, 42_700, 9_900][i % 7] + (i % 5) * 100,
      createdAt: hours(40 + i * 3.1),
      provider,
      status: (i % 3 === 0 ? "investigating" : "open") as MismatchStatus
    };
  });
  return [...seeds, ...extra];
}

export function toMismatchRows(_recon: PaymentReconciliation): ReconciliationMismatchRow[] {
  return buildDemoMismatches(32);
}

export function matchesMismatchSearch(row: ReconciliationMismatchRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.summary,
    row.type,
    mismatchTypeLabel(row.type),
    row.orderId,
    row.paymentId,
    row.provider,
    providerLabel(row.provider),
    row.status,
    mismatchStatusBadge(row.status)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function mismatchFilterMatch(row: ReconciliationMismatchRow, id: string) {
  if (id.startsWith("status:")) return row.status === id.slice("status:".length);
  if (id.startsWith("type:")) return row.type === id.slice("type:".length);
  if (id.startsWith("provider:")) return row.provider === id.slice("provider:".length);
  return false;
}

export function applyMismatchFilters(rows: ReconciliationMismatchRow[], active: string[]) {
  if (!active.length) return rows;
  const groups = MISMATCHES_LIST_QUERY.filterGroups;
  return rows.filter((row) => {
    for (const group of groups) {
      const selected = group.options.map((o) => o.id).filter((id) => active.includes(id));
      if (!selected.length) continue;
      if (!selected.some((id) => mismatchFilterMatch(row, id))) return false;
    }
    return true;
  });
}

export function applyMismatchStatusFilter(rows: ReconciliationMismatchRow[], status: MismatchStatusFilter) {
  if (status === "all") return rows;
  return rows.filter((row) => row.status === status);
}

export function applyMismatchSort(rows: ReconciliationMismatchRow[], sortId: string | null) {
  const id = sortId || MISMATCHES_LIST_QUERY.defaultSort;
  const next = [...rows];
  const rank = (status: MismatchStatus) => (status === "open" ? 0 : status === "investigating" ? 1 : 2);
  next.sort((a, b) => {
    if (id === "oldest") return a.createdAt.localeCompare(b.createdAt);
    if (id === "amount_desc") return (b.amountCents ?? 0) - (a.amountCents ?? 0);
    if (id === "amount_asc") return (a.amountCents ?? 0) - (b.amountCents ?? 0);
    if (id === "status_asc") return rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt);
    if (id === "type_asc") return mismatchTypeLabel(a.type).localeCompare(mismatchTypeLabel(b.type));
    return b.createdAt.localeCompare(a.createdAt);
  });
  return next;
}

export function groupMismatchesByStatus(rows: ReconciliationMismatchRow[]) {
  return MISMATCH_STATUS_ORDER.map((status) => ({
    status,
    label: mismatchStatusHeading(status),
    rows: rows.filter((row) => row.status === status)
  })).filter((section) => section.rows.length > 0);
}

export function mismatchConfirmCopy(action: MismatchActionId, row: ReconciliationMismatchRow) {
  const target = row.orderId ?? row.paymentId ?? row.id;
  if (action === "match_to_order") {
    return {
      title: "Match this payment to an order?",
      description: `Link ${row.paymentId ?? "this payment"} to a ServeOS order so the ledger can close.`,
      label: "Match to order",
      danger: false
    };
  }
  if (action === "recalculate_amount") {
    return {
      title: "Recalculate this amount?",
      description: `Re-read the provider capture for ${target} and compare it with the ServeOS order total.`,
      label: "Recalculate",
      danger: false
    };
  }
  if (action === "retry_provider") {
    return {
      title: "Refresh from the provider?",
      description: `Fetch the latest ${providerLabel(row.provider)} events for ${target}.`,
      label: "Refresh",
      danger: false
    };
  }
  if (action === "mark_investigating") {
    return {
      title: "Mark as investigating?",
      description: `Keep ${target} in the mismatch list while staff checks the ledger.`,
      label: "Start investigation",
      danger: false
    };
  }
  if (action === "mark_resolved") {
    return {
      title: "Mark this mismatch as resolved?",
      description: `Remove ${target} from the open mismatch list. This does not move money.`,
      label: "Mark resolved",
      danger: false
    };
  }
  return {
    title: "Ignore this mismatch?",
    description: `Hide ${target} without matching it. Use this only when the difference is expected.`,
    label: "Ignore mismatch",
    danger: true
  };
}

import type { EntityMenuAction } from "../menu/MenuEntityActionsMenu";
import type { MenuListQueryPreset } from "../menu/menuListQuery";
import type { PaymentPayoutRow } from "../../../api";
import { providerLabel } from "./reconciliationMismatches";

export type PayoutStatus = PaymentPayoutRow["status"];
export type PayoutStatusFilter = "all" | "scheduled" | "in_transit" | "paid" | "failed";

export const PAYOUT_STATUS_ORDER: PayoutStatusFilter[] = ["scheduled", "in_transit", "paid", "failed"];

export type PayoutActionId =
  | "view"
  | "hold"
  | "release"
  | "retry"
  | "mark_paid"
  | "email_receipt"
  | "copy_id"
  | "refresh_status";

export const PAYOUTS_LIST_QUERY: MenuListQueryPreset = {
  defaultSort: "newest",
  filterGroups: [
    {
      id: "status",
      label: "Status",
      options: [
        { id: "status:scheduled", label: "Upcoming", description: "Scheduled for deposit" },
        { id: "status:in_transit", label: "In transit", description: "Sent to the bank" },
        { id: "status:paid", label: "Historical", description: "Already deposited" },
        { id: "status:failed", label: "Failed", description: "Bank or provider blocked it" }
      ]
    },
    {
      id: "provider",
      label: "Provider",
      options: [
        { id: "provider:stripe", label: "Stripe", description: "Stripe settlement" },
        { id: "provider:swish", label: "Swish", description: "Swish settlement" },
        { id: "provider:klarna", label: "Klarna", description: "Klarna settlement" }
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

export function payoutStatusHeading(status: PayoutStatusFilter) {
  if (status === "scheduled") return "Upcoming";
  if (status === "in_transit") return "In transit";
  if (status === "paid") return "Historical";
  if (status === "failed") return "Failed";
  return "All";
}

export function payoutStatusBadge(status: PayoutStatus) {
  if (status === "scheduled") return "Upcoming";
  if (status === "in_transit") return "In transit";
  if (status === "paid") return "Paid";
  return "Failed";
}

export function payoutStatusTone(status: PayoutStatus): "active" | "pending" | "setup" | "issue" | "inactive" {
  if (status === "paid") return "active";
  if (status === "in_transit") return "pending";
  if (status === "scheduled") return "setup";
  return "issue";
}

export function payoutWhen(row: PaymentPayoutRow) {
  return row.paidAt ?? row.expectedAt;
}

export function matchesPayoutSearch(row: PaymentPayoutRow, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.id,
    row.provider,
    providerLabel(row.provider),
    row.status,
    payoutStatusBadge(row.status),
    row.currency
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function payoutFilterMatch(row: PaymentPayoutRow, id: string) {
  if (id.startsWith("status:")) return row.status === id.slice("status:".length);
  if (id.startsWith("provider:")) return row.provider === id.slice("provider:".length);
  return false;
}

export function applyPayoutFilters(rows: PaymentPayoutRow[], active: string[]) {
  if (!active.length) return rows;
  const groups = PAYOUTS_LIST_QUERY.filterGroups;
  return rows.filter((row) => {
    for (const group of groups) {
      const selected = group.options.map((o) => o.id).filter((id) => active.includes(id));
      if (!selected.length) continue;
      if (!selected.some((id) => payoutFilterMatch(row, id))) return false;
    }
    return true;
  });
}

export function applyPayoutStatusFilter(rows: PaymentPayoutRow[], status: PayoutStatusFilter) {
  if (status === "all") return rows;
  return rows.filter((row) => row.status === status);
}

export function applyPayoutSort(rows: PaymentPayoutRow[], sortId: string | null) {
  const id = sortId || PAYOUTS_LIST_QUERY.defaultSort;
  const next = [...rows];
  const rank = (status: PayoutStatus) => PAYOUT_STATUS_ORDER.indexOf(status);
  next.sort((a, b) => {
    if (id === "oldest") return payoutWhen(a).localeCompare(payoutWhen(b));
    if (id === "amount_desc") return b.netCents - a.netCents;
    if (id === "amount_asc") return a.netCents - b.netCents;
    if (id === "status_asc") return rank(a.status) - rank(b.status) || payoutWhen(b).localeCompare(payoutWhen(a));
    return payoutWhen(b).localeCompare(payoutWhen(a));
  });
  return next;
}

export function groupPayoutsByStatus(rows: PaymentPayoutRow[]) {
  return PAYOUT_STATUS_ORDER.map((status) => ({
    status,
    label: payoutStatusHeading(status),
    rows: rows.filter((row) => row.status === status)
  })).filter((section) => section.rows.length > 0);
}

export function buildPayoutActions(row: PaymentPayoutRow, caps: { canEdit: boolean }): EntityMenuAction[] {
  const actions: EntityMenuAction[] = [{ id: "view", label: "View details" }];
  if (row.status === "scheduled" && caps.canEdit) {
    actions.push({ id: "hold", label: "Hold payout" });
    actions.push({ id: "mark_paid", label: "Mark as paid" });
  }
  if (row.status === "in_transit") {
    actions.push({ id: "refresh_status", label: "Refresh status" });
    if (caps.canEdit) actions.push({ id: "release", label: "Release to bank" });
  }
  if (row.status === "failed" && caps.canEdit) {
    actions.push({ id: "retry", label: "Retry payout" });
  }
  if (row.status === "paid") {
    actions.push({ id: "email_receipt", label: "Email settlement receipt" });
  }
  actions.push({ id: "copy_id", label: "Copy payout ID" });
  return actions;
}

export function payoutConfirmCopy(action: PayoutActionId, row: PaymentPayoutRow) {
  if (action === "hold") {
    return {
      title: "Hold this payout?",
      description: `Keep ${row.id} from depositing until you release it.`,
      label: "Hold payout",
      danger: false
    };
  }
  if (action === "release") {
    return {
      title: "Release this payout?",
      description: `Send the in-transit deposit for ${row.id} to the linked bank account.`,
      label: "Release payout",
      danger: false
    };
  }
  if (action === "retry") {
    return {
      title: "Retry this payout?",
      description: `Send ${row.id} to ${providerLabel(row.provider)} again.`,
      label: "Retry payout",
      danger: false
    };
  }
  if (action === "mark_paid") {
    return {
      title: "Mark this payout as paid?",
      description: `Record that ${row.id} has already landed in the bank.`,
      label: "Mark paid",
      danger: false
    };
  }
  return {
    title: "Email the settlement receipt?",
    description: `Send the ${row.id} breakdown to the venue payout contacts.`,
    label: "Email receipt",
    danger: false
  };
}

export function buildDemoPayouts(now = Date.now()): PaymentPayoutRow[] {
  const days = (d: number) => new Date(now + d * 86400_000).toISOString();
  const rows: Array<Partial<PaymentPayoutRow> & { id: string; status: PayoutStatus; net: number; at: number }> = [
    { id: "po_up_01", status: "scheduled", net: 12_480, at: 2, provider: "stripe" },
    { id: "po_up_02", status: "scheduled", net: 8_640, at: 4, provider: "swish" },
    { id: "po_tr_01", status: "in_transit", net: 15_200, at: -0.4, provider: "stripe" },
    { id: "po_paid_01", status: "paid", net: 18_920, at: -2, provider: "stripe" },
    { id: "po_paid_02", status: "paid", net: 11_350, at: -4, provider: "klarna" },
    { id: "po_paid_03", status: "paid", net: 22_410, at: -6, provider: "stripe" },
    { id: "po_paid_04", status: "paid", net: 9_780, at: -8, provider: "swish" },
    { id: "po_paid_05", status: "paid", net: 16_050, at: -11, provider: "stripe" },
    { id: "po_paid_06", status: "paid", net: 13_220, at: -14, provider: "klarna" },
    { id: "po_fail_01", status: "failed", net: 7_440, at: -3, provider: "stripe" },
    { id: "po_fail_02", status: "failed", net: 4_100, at: -9, provider: "swish" },
    { id: "po_up_03", status: "scheduled", net: 19_600, at: 6, provider: "klarna" }
  ];
  return rows.map((r, i) => {
    const netCents = r.net * 100;
    const feesCents = Math.round(netCents * 0.016);
    const refundsCents = i % 3 === 0 ? Math.round(netCents * 0.02) : 0;
    const tipsCents = Math.round(netCents * 0.055);
    const grossCents = netCents + feesCents + refundsCents;
    const at = days(r.at);
    return {
      id: r.id,
      source: "demo" as const,
      status: r.status,
      grossCents,
      feesCents,
      refundsCents,
      chargebacksCents: r.status === "failed" ? 8_000 : 0,
      tipsCents,
      netCents,
      currency: "SEK",
      expectedAt: at,
      paidAt: r.status === "paid" ? at : null,
      provider: r.provider ?? "stripe"
    };
  });
}

export function toPayoutRows(payouts: PaymentPayoutRow[]): PaymentPayoutRow[] {
  const demo = buildDemoPayouts();
  const ids = new Set(payouts.map((p) => p.id));
  return [...payouts, ...demo.filter((d) => !ids.has(d.id))];
}

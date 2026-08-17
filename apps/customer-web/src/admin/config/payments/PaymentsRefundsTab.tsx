import { useEffect, useMemo, useRef, useState } from "react";
import type { PaymentRefundRow, VenuePaymentSettings } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuListSearchField } from "../menu/MenuPageUi";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "../menu/useMenuListPagination";
import { PaymentMethodGlyph } from "./paymentsFormControls";
import { formatSekFromCents, formatWhen, methodLabel } from "./paymentsUiHelpers";
import { buildRefundCardActions, type RefundCardActionId } from "./refundCardActions";
import { buildDemoRefunds } from "./refundDemoData";
import { RefundPolicyDrawer } from "./RefundPolicyDrawer";
import { RefundReceiptModal } from "./RefundReceiptModal";
import {
  applyRefundFilters,
  applyRefundSort,
  applyRefundStatusFilter,
  groupRefundsByStatus,
  matchesRefundSearch,
  methodKeyFromRefund,
  REFUNDS_LIST_QUERY,
  refundStatusBadge,
  refundStatusHeading,
  refundStatusTone,
  REFUND_STATUS_ORDER,
  type RefundListRow,
  type RefundStatusFilter
} from "./refundsListQuery";

type Props = {
  refunds: PaymentRefundRow[];
  settings: VenuePaymentSettings;
  canEdit: boolean;
  source?: "live" | "demo";
  policyRequestId?: number;
  onOpen: (refund: PaymentRefundRow) => void;
  onPatchSettings: (patch: Partial<VenuePaymentSettings>) => void;
};

function liveToRow(row: PaymentRefundRow): RefundListRow {
  const methodKey = methodKeyFromRefund(row);
  return {
    ...row,
    methodKey,
    methodLabel: methodLabel(methodKey),
    guestName: row.requestedBy
  };
}

export function PaymentsRefundsTab({
  refunds,
  settings,
  canEdit,
  source,
  policyRequestId = 0,
  onOpen,
  onPatchSettings
}: Props) {
  const { pushToast } = useAdminToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(REFUNDS_LIST_QUERY.defaultSort);
  const [statusFilter, setStatusFilter] = useState<RefundStatusFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [receiptRow, setReceiptRow] = useState<RefundListRow | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<RefundListRow>>>({});
  const [confirm, setConfirm] = useState<{ action: RefundCardActionId; row: RefundListRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const lastPolicyRequestRef = useRef(policyRequestId);

  const rows = useMemo(() => {
    const liveRows = refunds.map(liveToRow);
    const fakes = buildDemoRefunds(50);
    return [...liveRows, ...fakes].map((row) => ({ ...row, ...overrides[row.id] }));
  }, [refunds, overrides]);

  const filtered = useMemo(() => {
    const searched = rows.filter((r) => matchesRefundSearch(r, searchQuery));
    const narrowed = applyRefundFilters(searched, activeFilters);
    const byStatus = applyRefundStatusFilter(narrowed, statusFilter);
    return applyRefundSort(byStatus, activeSort);
  }, [rows, searchQuery, activeFilters, activeSort, statusFilter]);

  const pager = useMenuListPagination(filtered, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${searchQuery}:${activeFilters.join(",")}:${activeSort}:${statusFilter}`
  });
  const paged = pager.pagedItems;
  const sections = useMemo(() => groupRefundsByStatus(paged), [paged]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPagedSelected = paged.length > 0 && paged.every((row) => selectedSet.has(row.id));
  const somePagedSelected = paged.some((row) => selectedSet.has(row.id));
  const statusChipOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.status));
    return REFUND_STATUS_ORDER.filter((s) => present.has(s));
  }, [rows]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = somePagedSelected && !allPagedSelected;
  }, [somePagedSelected, allPagedSelected]);

  useEffect(() => {
    if (!policyRequestId || policyRequestId === lastPolicyRequestRef.current) return;
    lastPolicyRequestRef.current = policyRequestId;
    setPolicyOpen(true);
  }, [policyRequestId]);

  const toggleSelection = (id: string, nextChecked?: boolean) => {
    const shouldCheck = nextChecked ?? !selectedSet.has(id);
    const next = new Set(selectedSet);
    if (shouldCheck) next.add(id);
    else next.delete(id);
    setSelectedIds([...next]);
  };

  const toggleSelectAllPaged = (checked: boolean) => {
    const next = new Set(selectedSet);
    for (const row of paged) {
      if (checked) next.add(row.id);
      else next.delete(row.id);
    }
    setSelectedIds([...next]);
  };

  const patchRow = (id: string, patch: Partial<RefundListRow>) => {
    setOverrides((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
  };

  const copyText = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(ok, "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  const runAction = async (action: RefundCardActionId, row: RefundListRow) => {
    if (action === "view") {
      onOpen(row);
      return;
    }
    if (action === "preview_receipt") {
      setReceiptRow(row);
      return;
    }
    if (action === "copy_id") {
      await copyText(row.id, "Refund ID copied.");
      return;
    }
    if (action === "copy_order_id") {
      await copyText(row.orderId ?? row.id, "Order ID copied.");
      return;
    }
    if (action === "copy_payment_id") {
      await copyText(row.paymentId, "Payment ID copied.");
      return;
    }
    if (action === "copy_swish_ref") {
      await copyText(row.paymentId, "Swish reference copied.");
      return;
    }
    if (action === "copy_klarna_ref") {
      await copyText(row.paymentId, "Klarna reference copied.");
      return;
    }
    if (action === "refresh_status") {
      pushToast("Status refreshed from the provider.", "success");
      return;
    }
    if (action === "email_receipt") {
      pushToast(`Receipt emailed to ${row.guestName}.`, "success");
      return;
    }
    if (action === "print_receipt") {
      pushToast("Receipt sent to the printer.", "success");
      return;
    }
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 280));
    if (action === "approve" || action === "mark_cash_returned") {
      patchRow(row.id, {
        status: "completed",
        approvedBy: row.approvedBy ?? row.requestedBy,
        completedAt: new Date().toISOString()
      });
      pushToast(
        action === "mark_cash_returned" ? "Cash return recorded." : "Refund approved and completed.",
        "success"
      );
    } else if (action === "decline") {
      patchRow(row.id, { status: "failed" });
      pushToast("Refund request declined.", "success");
    } else if (action === "retry") {
      patchRow(row.id, { status: "processing" });
      pushToast("Refund retry sent to the provider.", "success");
    } else if (action === "refund_remaining") {
      patchRow(row.id, { status: "completed", completedAt: new Date().toISOString() });
      pushToast("Remaining balance refunded.", "success");
    } else if (action === "cancel_processing") {
      patchRow(row.id, { status: "failed", completedAt: null });
      pushToast("In-progress refund cancelled.", "success");
    }
    setBusy(false);
    setConfirm(null);
  };

  const confirmCopy = (() => {
    if (!confirm) return { title: "", description: "", label: "Confirm", danger: false };
    const amount = formatSekFromCents(confirm.row.amountCents, confirm.row.currency);
    const method = confirm.row.methodLabel;
    if (confirm.action === "approve") {
      return {
        title: `Approve ${amount} refund?`,
        description: `Return ${amount} to ${confirm.row.guestName} via ${method}.`,
        label: "Approve refund",
        danger: false
      };
    }
    if (confirm.action === "decline") {
      return {
        title: "Decline this refund?",
        description: `The original ${method} payment stays captured. ${confirm.row.guestName} will not be refunded.`,
        label: "Decline refund",
        danger: true
      };
    }
    if (confirm.action === "retry") {
      return {
        title: "Retry this refund?",
        description: `Send ${amount} to ${confirm.row.provider} again for ${confirm.row.guestName}.`,
        label: "Retry refund",
        danger: false
      };
    }
    if (confirm.action === "refund_remaining") {
      return {
        title: "Refund the remaining balance?",
        description: `This completes the partial refund on ${confirm.row.orderId ?? "this payment"} via ${method}.`,
        label: "Refund remaining",
        danger: false
      };
    }
    if (confirm.action === "mark_cash_returned") {
      return {
        title: "Mark cash as returned?",
        description: `Record that ${amount} cash was handed back to ${confirm.row.guestName}.`,
        label: "Mark cash returned",
        danger: false
      };
    }
    if (confirm.action === "email_receipt") {
      return {
        title: "Email the receipt?",
        description: `Send the refund receipt for ${confirm.row.orderId ?? amount} to ${confirm.row.guestName}.`,
        label: "Email receipt",
        danger: false
      };
    }
    if (confirm.action === "cancel_processing") {
      return {
        title: "Cancel this in-progress refund?",
        description: `Stop the ${amount} ${method} refund for ${confirm.row.guestName}. The original payment stays captured.`,
        label: "Cancel refund",
        danger: true
      };
    }
    return {
      title: "Print this receipt?",
      description: `Send the ${amount} refund receipt to the receipt printer.`,
      label: "Print receipt",
      danger: false
    };
  })();

  const handleAction = (row: RefundListRow, actionId: string) => {
    setOpenMenuId(null);
    const action = actionId as RefundCardActionId;
    if (
      action === "approve" ||
      action === "decline" ||
      action === "retry" ||
      action === "refund_remaining" ||
      action === "mark_cash_returned" ||
      action === "cancel_processing" ||
      action === "email_receipt" ||
      action === "print_receipt"
    ) {
      setConfirm({ action, row });
      return;
    }
    void runAction(action, row);
  };

  const listedSections =
    statusFilter === "all" ? sections : [{ status: statusFilter, label: "", rows: paged }];

  return (
    <div className="admin-payments-methods-page admin-payments-methods-page--unified">
      <div className="admin-payments-methods-board-head">
        <p className="admin-payments-methods-board-desc">
          Review refunds for this venue, then open refund policies to set how staff can return payments.
          {source === "demo" || rows.some((r) => r.source === "demo")
            ? " Demo refunds are included so you can see the full list layout."
            : ""}
        </p>
      </div>

      <MenuListSearchField
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search refunds by guest, order, reason, or method…"
        aria-label="Search refunds"
        filterGroups={REFUNDS_LIST_QUERY.filterGroups}
        sortOptions={REFUNDS_LIST_QUERY.sortOptions}
        defaultSort={REFUNDS_LIST_QUERY.defaultSort}
        activeFilters={activeFilters}
        activeSort={activeSort}
        totalCount={rows.length}
        resultCount={filtered.length}
        onFiltersChange={setActiveFilters}
        onSortChange={setActiveSort}
        filterTitle="Filter refunds"
        filterSubtitle="Narrow by status, method, and provider."
        sortTitle="Sort refunds"
        sortSubtitle="Changes apply to the list instantly."
      />

      <div className="admin-payments-methods-list-toolbar">
        <div className="admin-payments-methods-family-chips" role="tablist" aria-label="Refund status groups">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "all"}
            className={`admin-payments-methods-family-chip${statusFilter === "all" ? " is-active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          {statusChipOptions.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={statusFilter === status}
              className={`admin-payments-methods-family-chip${statusFilter === status ? " is-active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {refundStatusHeading(status)}
            </button>
          ))}
        </div>

        {paged.length > 0 ? (
          <label className="admin-menu-surface-select-all admin-payments-methods-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="admin-menu-surface-checkbox"
              checked={allPagedSelected}
              aria-label="Select all refunds on this page"
              onChange={(e) => toggleSelectAllPaged(e.target.checked)}
            />
            <span className="admin-menu-surface-select-all-label">Select all</span>
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="admin-config-text-muted py-2 text-sm">No refunds match your search or filters.</p>
      ) : (
        <>
          <div className={`admin-payments-methods-grouped-list ${pager.pageClassName}`}>
            {listedSections.map((section) => (
              <section key={section.status} className="admin-payments-methods-family-section">
                {statusFilter === "all" && section.label ? (
                  <h3 className="admin-payments-methods-family-heading">{section.label}</h3>
                ) : null}
                <ul className="admin-menu-surface-list admin-payments-methods-surface-list">
                  {section.rows.map((row, index) => {
                    const isChecked = selectedSet.has(row.id);
                    const tone = refundStatusTone(row.status);
                    return (
                      <li
                        key={row.id}
                        className="admin-menu-surface-list-item"
                        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                      >
                        <div
                          className={`admin-menu-surface-card admin-payments-method-card-row is-${tone}${isChecked ? " is-checked" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpen(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onOpen(row);
                            }
                          }}
                        >
                          <label
                            className="admin-menu-surface-checkbox-wrap"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="admin-menu-surface-checkbox"
                              checked={isChecked}
                              aria-label={`Select refund ${row.orderId ?? row.id}`}
                              onChange={(e) => toggleSelection(row.id, e.target.checked)}
                            />
                          </label>

                          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
                            {refundStatusBadge(row.status)}
                          </span>

                          <PaymentMethodGlyph methodKey={row.methodKey} />

                          <div className="admin-menu-surface-main">
                            <span className={`admin-menu-surface-name admin-payments-method-tone is-${tone}`}>
                              {formatSekFromCents(row.amountCents, row.currency)}
                            </span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-desc">{row.reason}</span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-meta">{row.guestName}</span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-meta">
                              {row.orderId ?? "No order"} · {formatWhen(row.createdAt)}
                            </span>
                          </div>

                          <div
                            className="admin-menu-surface-actions"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <MenuEntityActionsMenu
                              entityName={formatSekFromCents(row.amountCents, row.currency)}
                              subtitle={row.reason}
                              hideHeader
                              open={openMenuId === row.id}
                              actions={buildRefundCardActions(row, { canEdit })}
                              onToggle={() => setOpenMenuId((cur) => (cur === row.id ? null : row.id))}
                              onAction={(id) => handleAction(row, id)}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {pager.showPagination ? (
            <MenuSurfacePagination
              page={pager.page}
              totalPages={pager.totalPages}
              totalItems={pager.totalItems}
              pageSize={pager.pageSize}
              onPageChange={pager.goToPage}
              label="Refunds pagination"
            />
          ) : null}
        </>
      )}

      <RefundPolicyDrawer
        open={policyOpen}
        settings={settings}
        canEdit={canEdit}
        onClose={() => setPolicyOpen(false)}
        onSave={(next) => onPatchSettings({ refunds: next })}
      />

      <RefundReceiptModal open={Boolean(receiptRow)} refund={receiptRow} onClose={() => setReceiptRow(null)} />

      <MenuActionConfirmModal
        open={Boolean(confirm)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        danger={confirmCopy.danger}
        busy={busy}
        onClose={() => (busy ? undefined : setConfirm(null))}
        onConfirm={() => {
          if (!confirm) return;
          void runAction(confirm.action, confirm.row);
        }}
      />
    </div>
  );
}

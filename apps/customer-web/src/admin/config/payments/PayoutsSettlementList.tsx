import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PaymentPayoutRow } from "../../../api";
import { useAdminToast } from "../../AdminToast";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuListSearchField, usePinnedViewportNode } from "../menu/MenuPageUi";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "../menu/useMenuListPagination";
import { PayoutDetailDrawer } from "./PayoutDetailDrawer";
import {
  applyPayoutFilters,
  applyPayoutSort,
  applyPayoutStatusFilter,
  buildPayoutActions,
  groupPayoutsByStatus,
  matchesPayoutSearch,
  PAYOUT_STATUS_ORDER,
  PAYOUTS_LIST_QUERY,
  payoutConfirmCopy,
  payoutStatusBadge,
  payoutStatusHeading,
  payoutStatusTone,
  toPayoutRows,
  type PayoutActionId,
  type PayoutStatusFilter
} from "./payoutsListQuery";
import { formatSekFromCents, formatWhen } from "./paymentsUiHelpers";
import { providerLabel } from "./reconciliationMismatches";

type Props = {
  payouts: PaymentPayoutRow[];
  canEdit: boolean;
};

export function PayoutsSettlementList({ payouts, canEdit }: Props) {
  const { pushToast } = useAdminToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(PAYOUTS_LIST_QUERY.defaultSort);
  const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<PaymentPayoutRow | null>(null);
  const [confirm, setConfirm] = useState<{ action: PayoutActionId; row: PaymentPayoutRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Partial<PaymentPayoutRow>>>({});
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const { nodeRef, pin } = usePinnedViewportNode();
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultsMinHeightRef = useRef(0);

  const rows = useMemo(() => {
    const hidden = new Set(hiddenIds);
    return toPayoutRows(payouts)
      .map((row) => ({ ...row, ...overrides[row.id] }))
      .filter((row) => !hidden.has(row.id));
  }, [payouts, overrides, hiddenIds]);

  const filtered = useMemo(() => {
    const searched = rows.filter((r) => matchesPayoutSearch(r, searchQuery));
    const narrowed = applyPayoutFilters(searched, activeFilters);
    const byStatus = applyPayoutStatusFilter(narrowed, statusFilter);
    return applyPayoutSort(byStatus, activeSort);
  }, [rows, searchQuery, activeFilters, activeSort, statusFilter]);

  const pager = useMenuListPagination(filtered, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${searchQuery}:${activeFilters.join(",")}:${activeSort}:${statusFilter}`
  });
  const paged = pager.pagedItems;
  const sections = useMemo(() => groupPayoutsByStatus(paged), [paged]);
  const listedSections =
    statusFilter === "all" ? sections : [{ status: statusFilter, label: "", rows: paged }];
  const statusChipOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.status));
    return PAYOUT_STATUS_ORDER.filter((s) => present.has(s));
  }, [rows]);

  useLayoutEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    resultsMinHeightRef.current = Math.max(resultsMinHeightRef.current, el.getBoundingClientRect().height);
    el.style.minHeight = `${resultsMinHeightRef.current}px`;
  }, [filtered, paged, statusFilter]);

  const copyText = async (value: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(ok, "success");
    } catch {
      pushToast("Could not copy to clipboard.", "error");
    }
  };

  const runAction = async (action: PayoutActionId, row: PaymentPayoutRow) => {
    if (action === "view") {
      setDetailRow(row);
      return;
    }
    if (action === "copy_id") {
      await copyText(row.id, "Payout ID copied.");
      return;
    }
    if (action === "refresh_status") {
      pushToast("Payout status refreshed from the provider.", "success");
      return;
    }
    if (action === "email_receipt") {
      pushToast("Settlement receipt emailed.", "success");
      setConfirm(null);
      return;
    }
    setBusy(true);
    await new Promise((r) => window.setTimeout(r, 260));
    if (action === "hold") {
      setHiddenIds((cur) => [...cur, row.id]);
      pushToast("Payout held.", "success");
    } else if (action === "release" || action === "mark_paid") {
      setOverrides((cur) => ({
        ...cur,
        [row.id]: { ...cur[row.id], status: "paid", paidAt: new Date().toISOString() }
      }));
      pushToast(action === "release" ? "Payout released to the bank." : "Payout marked as paid.", "success");
    } else if (action === "retry") {
      setOverrides((cur) => ({ ...cur, [row.id]: { ...cur[row.id], status: "in_transit" } }));
      pushToast("Payout retry sent to the provider.", "success");
    }
    setBusy(false);
    setConfirm(null);
  };

  const handleAction = (row: PaymentPayoutRow, actionId: string) => {
    setOpenMenuId(null);
    const action = actionId as PayoutActionId;
    if (action === "hold" || action === "release" || action === "retry" || action === "mark_paid" || action === "email_receipt") {
      setConfirm({ action, row });
      return;
    }
    void runAction(action, row);
  };

  const confirmCopy = confirm
    ? payoutConfirmCopy(confirm.action, confirm.row)
    : { title: "", description: "", label: "Confirm", danger: false };

  return (
    <div ref={nodeRef} className="admin-payments-methods-page admin-payments-methods-page--unified">
      <MenuListSearchField
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search payouts by provider, status, or ID…"
        aria-label="Search payouts"
        filterGroups={PAYOUTS_LIST_QUERY.filterGroups}
        sortOptions={PAYOUTS_LIST_QUERY.sortOptions}
        defaultSort={PAYOUTS_LIST_QUERY.defaultSort}
        activeFilters={activeFilters}
        activeSort={activeSort}
        totalCount={rows.length}
        resultCount={filtered.length}
        onFiltersChange={setActiveFilters}
        onSortChange={setActiveSort}
        filterTitle="Filter payouts"
        filterSubtitle="Narrow by status and provider."
        sortTitle="Sort payouts"
        sortSubtitle="Changes apply to the list instantly."
      />

      <div className="admin-payments-methods-list-toolbar">
        <div className="admin-payments-methods-family-chips" role="tablist" aria-label="Payout status groups">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "all"}
            className={`admin-payments-methods-family-chip${statusFilter === "all" ? " is-active" : ""}`}
            onClick={() => {
              pin();
              setStatusFilter("all");
            }}
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
              onClick={() => {
                pin();
                setStatusFilter(status);
              }}
            >
              {payoutStatusHeading(status)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div ref={resultsRef} className="admin-payments-list-results">
          <p className="admin-config-text-muted py-2 text-sm">No payouts match your search or filters.</p>
        </div>
      ) : (
        <div ref={resultsRef} className="admin-payments-list-results">
          <div className={`admin-payments-methods-grouped-list ${pager.pageClassName}`}>
            {listedSections.map((section) => (
              <section key={section.status} className="admin-payments-methods-family-section">
                {statusFilter === "all" && section.label ? (
                  <h3 className="admin-payments-methods-family-heading">{section.label}</h3>
                ) : null}
                <ul className="admin-menu-surface-list admin-payments-methods-surface-list">
                  {section.rows.map((row, index) => {
                    const tone = payoutStatusTone(row.status);
                    return (
                      <li
                        key={row.id}
                        className="admin-menu-surface-list-item"
                        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                      >
                        <div
                          className={`admin-menu-surface-card admin-payments-method-card-row is-${tone}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailRow(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDetailRow(row);
                            }
                          }}
                        >
                          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
                            {payoutStatusBadge(row.status)}
                          </span>
                          <div className="admin-menu-surface-main">
                            <span className={`admin-menu-surface-name admin-payments-method-tone is-${tone}`}>
                              {formatSekFromCents(row.netCents, row.currency)} net
                            </span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-desc">
                              Gross {formatSekFromCents(row.grossCents, row.currency)} · Fees{" "}
                              {formatSekFromCents(row.feesCents, row.currency)} · Refunds{" "}
                              {formatSekFromCents(row.refundsCents, row.currency)} · Tips{" "}
                              {formatSekFromCents(row.tipsCents, row.currency)}
                            </span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-meta">
                              {providerLabel(row.provider)}
                              {" · "}
                              {row.paidAt ? `Paid ${formatWhen(row.paidAt)}` : `Expected ${formatWhen(row.expectedAt)}`}
                            </span>
                          </div>
                          <div
                            className="admin-menu-surface-actions"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <MenuEntityActionsMenu
                              entityName={formatSekFromCents(row.netCents, row.currency)}
                              subtitle={payoutStatusBadge(row.status)}
                              hideHeader
                              open={openMenuId === row.id}
                              actions={buildPayoutActions(row, { canEdit })}
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
              label="Payouts pagination"
            />
          ) : null}
        </div>
      )}

      <PayoutDetailDrawer open={Boolean(detailRow)} payout={detailRow} onClose={() => setDetailRow(null)} />

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

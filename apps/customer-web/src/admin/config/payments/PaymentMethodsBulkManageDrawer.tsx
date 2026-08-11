import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PaymentMethodConfig, VenuePaymentSettings } from "../../../api";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "../menu/menuPageModalShell";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { useMenuListPagination } from "../menu/useMenuListPagination";
import type { PaymentMethodListRow } from "./paymentMethodsListQuery";
import { getMethodConfig } from "./paymentsUiHelpers";
import { PaymentsDetailsReveal, PaymentsDrawerSpinner } from "./paymentsLoadingUi";

const SCOPE_PAGE_SIZE = 8;

type BulkActionId =
  | "enable"
  | "disable"
  | "set_default"
  | "require_staff"
  | "require_reference"
  | "duplicate"
  | "view_activity"
  | "view_reconciliation";

type Props = {
  open: boolean;
  settings: VenuePaymentSettings;
  targets: PaymentMethodListRow[];
  canEdit: boolean;
  onClose: () => void;
  onClearSelection: () => void;
  onSaveBulk: (
    updates: Array<{ key: string; config: PaymentMethodConfig }>,
    extras?: { setDefaultKey?: string | null }
  ) => Promise<boolean>;
  onViewActivity: () => void;
  onViewReconciliation: () => void;
  onToast: (message: string, tone?: "success" | "error") => void;
};

function ScopeChip({ row }: { row: PaymentMethodListRow }) {
  const tone =
    row.health === "active"
      ? "live"
      : row.health === "pending"
        ? "scheduled"
        : row.health === "issue"
          ? "retired"
          : "draft";
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${tone}`}
        title={`${row.config.displayName || row.label} — ${row.statusLabel} · ${row.channelLabel}`}
      >
        {row.config.displayName || row.label}
      </span>
    </li>
  );
}

export function PaymentMethodsBulkManageDrawer({
  open,
  settings,
  targets,
  canEdit,
  onClose,
  onClearSelection,
  onSaveBulk,
  onViewActivity,
  onViewReconciliation,
  onToast
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<BulkActionId | null>(null);
  const [busy, setBusy] = useState(false);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: targets.map((t) => t.key).join("|")
  });

  useModalScrollLock(mounted && open);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) {
      setMounted(true);
      setLoading(true);
      setContentReady(false);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      const load = window.setTimeout(() => {
        setLoading(false);
        setContentReady(true);
      }, 220);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(load);
      };
    }
    setVisible(false);
    setContentReady(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setLoading(false);
      closeTimerRef.current = null;
    }, 520);
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, [open]);

  const selectionLabel = useMemo(() => {
    if (targets.length === 0) return "Nothing selected";
    if (targets.length === 1) return targets[0]?.config.displayName || targets[0]?.label || "1 method";
    return `${targets.length} payment methods`;
  }, [targets]);

  const explainBlocker = (action: BulkActionId): string | null => {
    if (targets.length === 0) return "Select payment methods from the list first.";

    if (action === "set_default") {
      if (targets.length !== 1) {
        return "Set as default works on one method at a time. Unselect the extras, then try again.";
      }
      const row = targets[0]!;
      if (!row.enabled && !canEdit) return "You don’t have permission to change the default method.";
      return null;
    }

    if (action === "enable") {
      if (!canEdit) return "Your role can’t turn payment methods on.";
      if (targets.every((t) => t.enabled)) {
        return "Every selected method is already on.";
      }
      return null;
    }

    if (action === "disable") {
      if (!canEdit) return "Your role can’t turn payment methods off.";
      if (targets.every((t) => !t.enabled)) {
        return "Every selected method is already off.";
      }
      const defaults = targets.filter((t) => t.isDefault && t.enabled);
      if (defaults.length > 0 && defaults.length === targets.filter((t) => t.enabled).length) {
        return `“${defaults[0]!.config.displayName || defaults[0]!.label}” is your default. Choose another default before turning all of these off.`;
      }
      return null;
    }

    if (action === "require_staff" || action === "require_reference" || action === "duplicate") {
      if (!canEdit) return "Your role can’t change payment method settings.";
      return null;
    }

    return null;
  };

  const runAction = async (action: BulkActionId) => {
    const blocker = explainBlocker(action);
    if (blocker) {
      onToast(blocker, "error");
      setConfirmAction(null);
      return;
    }

    if (action === "view_activity") {
      onClose();
      onViewActivity();
      return;
    }
    if (action === "view_reconciliation") {
      onClose();
      onViewReconciliation();
      return;
    }

    if (action === "set_default") {
      const row = targets[0]!;
      const config = { ...getMethodConfig(settings, row.key), enabled: true, isDefault: true };
      setBusy(true);
      const ok = await onSaveBulk([{ key: row.key, config }], { setDefaultKey: row.key });
      setBusy(false);
      setConfirmAction(null);
      if (ok) {
        onToast(`“${config.displayName || row.label}” is now the default.`, "success");
        onClearSelection();
        onClose();
      }
      return;
    }

    setBusy(true);
    const updates: Array<{ key: string; config: PaymentMethodConfig }> = [];
    const skipped: string[] = [];

    for (const row of targets) {
      const base = getMethodConfig(settings, row.key);
      if (action === "enable") {
        if (row.enabled) {
          skipped.push(row.config.displayName || row.label);
          continue;
        }
        updates.push({ key: row.key, config: { ...base, enabled: true } });
      } else if (action === "disable") {
        if (!row.enabled) {
          skipped.push(row.config.displayName || row.label);
          continue;
        }
        if (row.isDefault) {
          skipped.push(`${row.config.displayName || row.label} (default)`);
          continue;
        }
        updates.push({ key: row.key, config: { ...base, enabled: false, isDefault: false } });
      } else if (action === "require_staff") {
        updates.push({ key: row.key, config: { ...base, requiresStaffConfirmation: true } });
      } else if (action === "require_reference") {
        updates.push({
          key: row.key,
          config: {
            ...base,
            requiresReference: true,
            instructionsStaff:
              (base.instructionsStaff ?? "").trim() ||
              "Verify the payment reference in ServeOS before marking the order paid."
          }
        });
      } else if (action === "duplicate") {
        updates.push({
          key: row.key,
          config: {
            ...base,
            displayName: `${base.displayName || row.label} (copy)`,
            isDefault: false
          }
        });
      }
    }

    if (updates.length === 0) {
      setBusy(false);
      setConfirmAction(null);
      if (action === "disable" && skipped.some((s) => s.includes("(default)"))) {
        onToast(
          "None of the selected methods could be turned off. Set a different default first, then try again.",
          "error"
        );
      } else {
        onToast("Nothing needed changing for the selected methods.", "error");
      }
      return;
    }

    const ok = await onSaveBulk(updates);
    setBusy(false);
    setConfirmAction(null);
    if (!ok) return;

    const verb =
      action === "enable"
        ? "turned on"
        : action === "disable"
          ? "turned off"
          : action === "require_staff"
            ? "set to require staff confirmation"
            : action === "require_reference"
              ? "set to require a payment reference"
              : "updated";

    onToast(
      updates.length === 1
        ? `1 method ${verb}.`
        : `${updates.length} methods ${verb}.`,
      "success"
    );
    if (skipped.length > 0) {
      onToast(
        skipped.length === 1
          ? `Skipped ${skipped[0]}.`
          : `Skipped ${skipped.length} methods that weren’t eligible.`,
        "error"
      );
    }
    onClearSelection();
    onClose();
  };

  const confirmCopy = (() => {
    if (!confirmAction) return { title: "", description: "", label: "Confirm", danger: false };
    if (confirmAction === "enable") {
      return {
        title: "Turn on selected methods?",
        description: "Guests and staff will be able to use these methods where their settings allow.",
        label: "Turn on",
        danger: false
      };
    }
    if (confirmAction === "disable") {
      return {
        title: "Turn off selected methods?",
        description: "They won’t be offered until you turn them on again. Your default method is left alone if it’s in this list.",
        label: "Turn off",
        danger: true
      };
    }
    if (confirmAction === "set_default") {
      const name = targets[0]?.config.displayName || targets[0]?.label || "this method";
      return {
        title: `Make ${name} the default?`,
        description: "New payments will prefer this method. Choosing pay-at-venue still doesn’t mark an order paid by itself.",
        label: "Set default",
        danger: false
      };
    }
    if (confirmAction === "require_staff") {
      return {
        title: "Require staff confirmation?",
        description: "Staff must confirm payment for every selected method before an order can be marked paid.",
        label: "Require confirmation",
        danger: false
      };
    }
    if (confirmAction === "require_reference") {
      return {
        title: "Require a payment reference?",
        description: "Selected methods will need a verified reference — customer claims alone won’t count as paid.",
        label: "Require reference",
        danger: false
      };
    }
    return {
      title: "Duplicate configurations?",
      description: "ServeOS will save a new versioned snapshot for each selected method.",
      label: "Duplicate",
      danger: false
    };
  })();

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
        role="presentation"
        aria-hidden={!visible}
      >
        <button
          type="button"
          className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
          aria-label="Close bulk payment method manager"
          tabIndex={visible ? 0 : -1}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          tabIndex={visible ? 0 : -1}
          aria-label="Manage selected payment methods"
          className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
        >
          <header className="admin-staff-profile-header">
            <div className="min-w-0 flex-1">
              <h3 className="admin-staff-profile-title">Manage payment methods</h3>
              <p className="admin-staff-profile-sub">{selectionLabel}</p>
            </div>
            <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
            {loading && !contentReady ? <PaymentsDrawerSpinner label="Loading selected methods" /> : null}

            <PaymentsDetailsReveal ready={contentReady && !loading}>
              {targets.length === 0 ? (
                <p className="admin-staff-drawer-hint">Select payment methods from the list to manage them together.</p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul
                      className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`}
                      key={scopePager.pageKey}
                      aria-label="Selected payment methods"
                    >
                      {scopePager.pagedItems.map((row) => (
                        <ScopeChip key={row.key} row={row} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope payment methods pagination"
                        size="compact"
                      />
                    ) : null}
                    <p className="admin-staff-drawer-hint mt-3">
                      Actions below apply to every method in scope when possible. If something can’t be done for all of
                      them, you’ll see a clear message instead of a partial surprise.
                    </p>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Bulk actions</h4>
                    <div className="admin-menu-manage-actions">
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => setConfirmAction("enable")}
                      >
                        <span className="admin-menu-manage-action-label">Turn on</span>
                        <span className="admin-menu-manage-action-desc">
                          Enable every selected method that is currently off.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => setConfirmAction("disable")}
                      >
                        <span className="admin-menu-manage-action-label">Turn off</span>
                        <span className="admin-menu-manage-action-desc">
                          Disable selected methods. Your default method stays on until you pick another.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => {
                          const blocker = explainBlocker("set_default");
                          if (blocker) {
                            onToast(blocker, "error");
                            return;
                          }
                          setConfirmAction("set_default");
                        }}
                      >
                        <span className="admin-menu-manage-action-label">Set as default</span>
                        <span className="admin-menu-manage-action-desc">
                          Works only when exactly one method is selected.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => setConfirmAction("require_staff")}
                      >
                        <span className="admin-menu-manage-action-label">Require staff confirmation</span>
                        <span className="admin-menu-manage-action-desc">
                          Staff must confirm before these methods can mark an order paid.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => setConfirmAction("require_reference")}
                      >
                        <span className="admin-menu-manage-action-label">Require payment reference</span>
                        <span className="admin-menu-manage-action-desc">
                          Ask for a verified reference — not just a guest saying they paid.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => setConfirmAction("duplicate")}
                      >
                        <span className="admin-menu-manage-action-label">Duplicate configurations</span>
                        <span className="admin-menu-manage-action-desc">
                          Save a new versioned snapshot for each method in scope.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => void runAction("view_activity")}
                      >
                        <span className="admin-menu-manage-action-label">View activity</span>
                        <span className="admin-menu-manage-action-desc">
                          Open today’s transactions list for follow-up.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={busy}
                        onClick={() => void runAction("view_reconciliation")}
                      >
                        <span className="admin-menu-manage-action-label">View reconciliation</span>
                        <span className="admin-menu-manage-action-desc">
                          Jump to reconciliation for venue payment checks.
                        </span>
                      </button>
                    </div>
                  </section>
                </>
              )}
            </PaymentsDetailsReveal>
          </div>
        </div>
      </div>

      <MenuActionConfirmModal
        open={Boolean(confirmAction)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        danger={confirmCopy.danger}
        busy={busy}
        onClose={() => (busy ? undefined : setConfirmAction(null))}
        onConfirm={() => {
          if (confirmAction) void runAction(confirmAction);
        }}
      />
    </>,
    document.body
  );
}

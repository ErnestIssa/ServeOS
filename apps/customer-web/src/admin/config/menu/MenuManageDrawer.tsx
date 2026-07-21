import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MenuManageActionDescriptor, MenuManageContextPayload, MenuSurfaceRow } from "../../../api";
import { getMenuManageContext, publishRestaurantMenu } from "../../../api";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "./menuPageModalShell";
import { buildNavHref, syncAdminNavHash } from "../../adminWorkspaceRouting";
import { useAdminToast } from "../../AdminToast";
import { MenuQrGeneratorModal } from "./AdminMenuActionModals";
import {
  BulkArchiveConfirmModal,
  BulkDeleteDraftConfirmModal,
  BulkDeleteMenuConfirmModal,
  MenuInsightsPickerModal,
  MenuSinglePickerModal,
  MoveMenusLocationModal
} from "./MenuManageModals";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import { useMenuListPagination } from "./useMenuListPagination";
import type { MenuPanelVariant } from "./menuManageHelpers";

const SCOPE_PAGE_SIZE = 8;

type Props = {
  open: boolean;
  menus: MenuSurfaceRow[];
  selectedMenuIds: Set<string>;
  variant: MenuPanelVariant;
  token: string;
  restaurantId: string;
  venueName: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onEditMenu: (menu: MenuSurfaceRow) => void;
  onOpenVersionHistory?: (menu: MenuSurfaceRow) => void;
  onOpenPublishReview?: (menu: MenuSurfaceRow) => void;
};

function ScopeChip({ menu }: { menu: MenuSurfaceRow }) {
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${menu.scopeTone}`}
        title={`${menu.name} — ${menu.scopeLabel}`}
      >
        {menu.name}
      </span>
    </li>
  );
}

export function MenuManageDrawer({
  open,
  menus,
  selectedMenuIds,
  variant,
  token,
  restaurantId,
  venueName,
  onClose,
  onRefresh,
  onClearSelection,
  onEditMenu,
  onOpenVersionHistory,
  onOpenPublishReview
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [context, setContext] = useState<MenuManageContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteDraftOpen, setDeleteDraftOpen] = useState(false);
  const [deleteMenuOpen, setDeleteMenuOpen] = useState(false);
  const [dangerConfirmMenus, setDangerConfirmMenus] = useState<MenuSurfaceRow[]>([]);
  const [qrPickerOpen, setQrPickerOpen] = useState(false);
  const [editPickerOpen, setEditPickerOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);

  const targets = context?.targets ?? [];
  const actions: MenuManageActionDescriptor[] = context?.actions ?? [];
  const safeActions = useMemo(() => actions.filter((a) => !a.danger), [actions]);
  const dangerActions = useMemo(() => actions.filter((a) => a.danger), [actions]);
  const dangerConfirmOpen = archiveOpen || deleteDraftOpen || deleteMenuOpen;
  const showManageShell = mounted && !dangerConfirmOpen;
  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((m) => m.id).join(",")}`
  });

  const selectionLabel =
    selectedMenuIds.size > 0
      ? `${selectedMenuIds.size} selected`
      : `${menus.length} in list`;

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setContext(null);
      closeTimerRef.current = null;
    }, 520);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setContextLoading(true);
    void getMenuManageContext(token, restaurantId, {
      variant,
      menuIds: selectedMenuIds.size > 0 ? [...selectedMenuIds] : undefined
    }).then((res) => {
      setContextLoading(false);
      if (!res.ok || !res.context) {
        pushToast(res.message ?? res.error ?? "Could not load manage options.", "error");
        return;
      }
      setContext(res.context);
    });
  }, [open, token, restaurantId, variant, selectedMenuIds]);

  useModalScrollLock(mounted || dangerConfirmOpen);

  useEffect(() => {
    if (!visible || dangerConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dangerConfirmOpen, onClose]);

  const shareMenus = async () => {
    if (targets.length === 0) return;
    const lines = targets.map((m) => `• ${m.name} (${m.scopeLabel})`).join("\n");
    const text = `Menus at ${venueName}:\n${lines}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `Menus — ${venueName}`, text });
        pushToast("Shared menu list.", "success");
      } else {
        await navigator.clipboard.writeText(text);
        pushToast("Menu list copied to clipboard.", "success");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        pushToast("Menu list copied to clipboard.", "success");
      } catch {
        pushToast("Could not share menus.", "error");
      }
    }
  };

  const publishDrafts = async () => {
    const pending = targets.filter(
      (m) => m.status === "DRAFT" || m.hasUnpublishedChanges || (m.draftChangeCount ?? 0) > 0
    );
    if (pending.length === 0 || publishBusy) return;
    setPublishBusy(true);
    let ok = 0;
    let failed = 0;
    for (const menu of pending) {
      const res = await publishRestaurantMenu(token, restaurantId, menu.id, { requireChanges: false });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setPublishBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Menu published." : `${ok} menus published.`, "success");
      onRefresh();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One menu could not be published." : `${failed} menus could not be published.`, "error");
    }
  };

  const openInsights = (menuId: string, presetId: string) => {
    syncAdminNavHash(`${buildNavHref("analytics", presetId)}?menuId=${encodeURIComponent(menuId)}`);
    onClose();
  };

  const editableTargets = useMemo(
    () => targets.filter((m) => m.status !== "ARCHIVED"),
    [targets]
  );

  const openEditForMenu = (menu: MenuSurfaceRow) => {
    setEditPickerOpen(false);
    onClose();
    onEditMenu(menu);
  };

  const openDangerConfirm = (
    kind: "archive" | "delete-draft" | "delete-menu",
    menusForConfirm: MenuSurfaceRow[]
  ) => {
    setDangerConfirmMenus(menusForConfirm);
    if (kind === "archive") setArchiveOpen(true);
    else if (kind === "delete-draft") setDeleteDraftOpen(true);
    else setDeleteMenuOpen(true);
  };

  const dismissDangerConfirm = () => {
    setArchiveOpen(false);
    setDeleteDraftOpen(false);
    setDeleteMenuOpen(false);
    setDangerConfirmMenus([]);
    onClose();
  };

  const handleAction = (actionId: string) => {
    if (actionId === "edit") {
      if (editableTargets.length === 1) {
        openEditForMenu(editableTargets[0]!);
      } else if (editableTargets.length > 1) {
        setEditPickerOpen(true);
      }
      return;
    }
    if (actionId === "delete-draft") {
      openDangerConfirm(
        "delete-draft",
        targets.filter((m) => m.status === "DRAFT")
      );
      return;
    }
    if (actionId === "delete-menu") {
      openDangerConfirm(
        "delete-menu",
        targets.filter((m) => m.status !== "ARCHIVED")
      );
      return;
    }
    if (actionId === "share") {
      void shareMenus();
      return;
    }
    if (actionId === "archive") {
      openDangerConfirm(
        "archive",
        targets.filter((m) => m.status !== "ARCHIVED")
      );
      return;
    }
    if (actionId === "publish-drafts" || actionId === "publish-changes") {
      if (targets.length === 1 && onOpenPublishReview) {
        onClose();
        onOpenPublishReview(targets[0]!);
        return;
      }
      void publishDrafts();
      return;
    }
    if (actionId === "version-history") {
      if (targets[0] && onOpenVersionHistory) {
        onClose();
        onOpenVersionHistory(targets[0]);
      }
      return;
    }
    if (actionId === "qr") {
      if (targets.length === 1) {
        setQrOpen(true);
      } else {
        setQrPickerOpen(true);
      }
      return;
    }
    if (actionId === "insights") {
      setInsightsOpen(true);
      return;
    }
    if (actionId === "move") {
      setMoveOpen(true);
    }
  };

  const bulkDone = (label: string, summary: { ok: number; failed: number }) => {
    if (summary.ok > 0) {
      pushToast(summary.ok === 1 ? `${label} completed.` : `${summary.ok} menus updated.`, "success");
      onRefresh();
      onClearSelection();
    }
    if (summary.failed > 0) {
      pushToast(`${summary.failed} could not be updated.`, "error");
    }
    dismissDangerConfirm();
  };

  if (!mounted && !dangerConfirmOpen) return null;

  return createPortal(
    <>
      {showManageShell ? (
      <div
        className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
        role="presentation"
        aria-hidden={!visible}
      >
        <button
          type="button"
          className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
          aria-label="Close manage menus"
          tabIndex={visible ? 0 : -1}
          onClick={onClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Manage menus"
          className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
        >
          <header className="admin-staff-profile-header">
            <div className="min-w-0 flex-1">
              <h3 className="admin-staff-profile-title">Manage menus</h3>
              <p className="admin-staff-profile-sub">
                {selectionLabel} at {venueName}
              </p>
            </div>
            <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
            {contextLoading ? (
              <p className="admin-staff-drawer-hint">Loading manage options…</p>
            ) : targets.length === 0 ? (
              <p className="admin-staff-drawer-hint">Select menus from the list or use actions for the full list.</p>
            ) : (
              <>
                <section className="admin-staff-drawer-section">
                  <h4 className="admin-staff-drawer-section-title">In scope</h4>
                  <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                    {scopePager.pagedItems.map((m) => (
                      <ScopeChip key={m.id} menu={m} />
                    ))}
                  </ul>
                  {scopePager.showPagination ? (
                    <MenuSurfacePagination
                      page={scopePager.page}
                      totalPages={scopePager.totalPages}
                      totalItems={scopePager.totalItems}
                      pageSize={scopePager.pageSize}
                      onPageChange={scopePager.goToPage}
                      label="In-scope menus pagination"
                      size="compact"
                    />
                  ) : null}
                </section>

                <section className="admin-staff-drawer-section">
                  <h4 className="admin-staff-drawer-section-title">Actions</h4>
                  <div className="admin-menu-manage-actions">
                    {safeActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={(action.id === "publish-drafts" || action.id === "publish-changes") && publishBusy}
                        onClick={() => handleAction(action.id)}
                      >
                        <span className="admin-menu-manage-action-label">
                          {(action.id === "publish-drafts" || action.id === "publish-changes") && publishBusy
                            ? "Publishing…"
                            : action.label}
                        </span>
                        {action.description ? (
                          <span className="admin-menu-manage-action-desc">{action.description}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>

                {dangerActions.length > 0 ? (
                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">
                      Danger Zone
                    </h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous menu actions">
                      {dangerActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          onClick={() => handleAction(action.id)}
                        >
                          <span className="admin-menu-manage-danger-btn-label">{action.label}</span>
                          {action.description ? (
                            <span className="admin-menu-manage-danger-btn-desc">{action.description}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
      ) : null}

      <BulkArchiveConfirmModal
        open={archiveOpen}
        menus={dangerConfirmMenus}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        onClose={dismissDangerConfirm}
        onDone={(summary) => bulkDone("Archive", summary)}
      />

      <BulkDeleteDraftConfirmModal
        open={deleteDraftOpen}
        menus={dangerConfirmMenus}
        token={token}
        restaurantId={restaurantId}
        onClose={dismissDangerConfirm}
        onDone={(summary) => bulkDone("Delete draft", summary)}
      />

      <BulkDeleteMenuConfirmModal
        open={deleteMenuOpen}
        menus={dangerConfirmMenus}
        token={token}
        restaurantId={restaurantId}
        onClose={dismissDangerConfirm}
        onDone={(summary) => bulkDone("Delete menu", summary)}
      />

      {showManageShell ? (
        <>
      <MenuSinglePickerModal
        open={editPickerOpen}
        title="Choose menu to edit"
        description="Pick one menu from your selection to edit its details."
        menus={editableTargets}
        confirmLabel="Edit menu"
        onClose={() => setEditPickerOpen(false)}
        onPick={(menu) => openEditForMenu(menu)}
      />

      <MenuSinglePickerModal
        open={qrPickerOpen}
        title="Choose menu for QR"
        description="Pick one menu to generate a guest ordering QR code."
        menus={targets}
        confirmLabel="Continue"
        onClose={() => setQrPickerOpen(false)}
        onPick={() => {
          setQrPickerOpen(false);
          setQrOpen(true);
        }}
      />

      <MenuInsightsPickerModal
        open={insightsOpen}
        menus={targets.length > 0 ? targets : menus}
        onClose={() => setInsightsOpen(false)}
        onContinue={(menuId, presetId) => {
          setInsightsOpen(false);
          openInsights(menuId, presetId);
        }}
      />

      <MoveMenusLocationModal
        open={moveOpen}
        menus={targets.filter((m) => m.status !== "ARCHIVED")}
        token={token}
        restaurantId={restaurantId}
        restaurants={context?.moveDestinations ?? []}
        onClose={() => setMoveOpen(false)}
        onMoved={(summary) => {
          if (summary.ok > 0) {
            pushToast(summary.ok === 1 ? "Move completed." : `${summary.ok} menus updated.`, "success");
            onRefresh();
            onClearSelection();
          }
          if (summary.failed > 0) {
            pushToast(`${summary.failed} could not be updated.`, "error");
          }
          setMoveOpen(false);
        }}
      />

      <MenuQrGeneratorModal
        open={qrOpen}
        token={token}
        restaurantId={restaurantId}
        onClose={() => setQrOpen(false)}
      />
        </>
      ) : null}
    </>,
    document.body
  );
}

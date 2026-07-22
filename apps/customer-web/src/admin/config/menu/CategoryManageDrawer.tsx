import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  deleteCategory,
  duplicateCategory,
  updateCategory,
  type MenuSurfaceRow
} from "../../../api";
import { AdminInput, AdminLabel, inputBase } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS,
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter
} from "./menuPageModalShell";
import { DuplicateEntityModal } from "./DuplicateEntityModal";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import { useMenuListPagination } from "./useMenuListPagination";
import { isUiOnlyListId } from "./menuListUiMocks";
import type { CategoryListRow } from "./categoryListHelpers";

const SCOPE_PAGE_SIZE = 8;

type Props = {
  open: boolean;
  categories: CategoryListRow[];
  selectedIds: Set<string>;
  menus: MenuSurfaceRow[];
  token: string;
  restaurantId: string;
  venueName: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onEditCategory: (category: CategoryListRow) => void;
};

type DangerKind = "archive" | "unpublish" | "delete" | null;

function ScopeChip({ category }: { category: CategoryListRow }) {
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${category.isActive ? "live" : "draft"}`}
        title={`${category.name} — ${category.menuName}`}
      >
        {category.name}
      </span>
    </li>
  );
}

export function CategoryManageDrawer({
  open,
  categories,
  selectedIds,
  menus,
  token,
  restaurantId,
  venueName,
  onClose,
  onRefresh,
  onClearSelection,
  onEditCategory
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveMenuId, setMoveMenuId] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);
  const [dangerKind, setDangerKind] = useState<DangerKind>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateToMode, setDuplicateToMode] = useState(false);

  const targets = useMemo(() => {
    const real = categories.filter((c) => !isUiOnlyListId(c.id));
    if (selectedIds.size === 0) return real;
    return real.filter((c) => selectedIds.has(c.id));
  }, [categories, selectedIds]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((c) => c.id).join(",")}`
  });

  const editableTargets = targets;
  const visibleTargets = targets.filter((c) => c.isActive);
  const moveMenus = menus.filter((m) => m.status !== "ARCHIVED");

  const selectionLabel =
    selectedIds.size > 0 ? `${selectedIds.size} selected` : `${targets.length} in list`;

  const dangerOpen = dangerKind != null;
  const showManageShell = mounted && !dangerOpen && !moveOpen && !duplicateOpen;
  const overlayOpen = dangerOpen || moveOpen || duplicateOpen;
  useModalScrollLock(mounted || overlayOpen);

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
    if (!visible || dangerOpen || moveOpen || duplicateOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dangerOpen, moveOpen, duplicateOpen, onClose]);

  useEffect(() => {
    if (!dangerOpen) {
      setConfirmName("");
      setDangerError(null);
    }
  }, [dangerOpen]);

  const expectedConfirm =
    targets.length === 1 ? targets[0]!.name : targets.map((c) => c.name).join(", ");

  const runBulkVisibility = async (isActive: boolean, label: string) => {
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const cat of targets) {
      const res = await updateCategory(token, restaurantId, cat.id, { isActive });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} categories updated.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError(`Could not ${label.toLowerCase()} the selected categories.`);
    } else if (failed > 0) {
      pushToast(`${failed} could not be updated.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const runDelete = async () => {
    if (confirmName.trim() !== expectedConfirm) return;
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const cat of targets) {
      const res = await deleteCategory(token, restaurantId, cat.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Category deleted." : `${ok} categories deleted.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError("Could not delete the selected categories.");
    } else if (failed > 0) {
      pushToast(`${failed} could not be deleted.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const runMove = async () => {
    if (!moveMenuId) return;
    setMoveBusy(true);
    let ok = 0;
    let failed = 0;
    for (const cat of targets) {
      const res = await updateCategory(token, restaurantId, cat.id, { menuId: moveMenuId });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setMoveBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Category moved." : `${ok} categories moved.`, "success");
      onRefresh();
      onClearSelection();
      setMoveOpen(false);
      onClose();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One category could not be moved." : `${failed} could not be moved.`, "error");
    }
  };

  const runDuplicate = async (toOtherMenu: boolean) => {
    if (targets.length === 1) {
      setDuplicateToMode(toOtherMenu);
      setDuplicateOpen(true);
      return;
    }
    let ok = 0;
    let failed = 0;
    for (const cat of targets) {
      const res = await duplicateCategory(token, restaurantId, cat.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    if (ok > 0) {
      pushToast(ok === 1 ? "Category duplicated." : `${ok} categories duplicated.`, "success");
      onRefresh();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One category could not be duplicated." : `${failed} could not be duplicated.`, "error");
    }
  };

  const handleEdit = () => {
    if (editableTargets.length >= 1) {
      onEditCategory(editableTargets[0]!);
      if (editableTargets.length > 1) {
        pushToast("Opening the first selected category for edit.", "success");
      }
      onClose();
    }
  };

  if (!mounted && !dangerOpen && !moveOpen && !duplicateOpen) return null;

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
            aria-label="Close manage categories"
            tabIndex={visible ? 0 : -1}
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={visible ? 0 : -1}
            aria-label="Manage categories"
            className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
          >
            <header className="admin-staff-profile-header">
              <div className="min-w-0 flex-1">
                <h3 className="admin-staff-profile-title">Manage categories</h3>
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
              {targets.length === 0 ? (
                <p className="admin-staff-drawer-hint">Select categories from the list to manage them.</p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                      {scopePager.pagedItems.map((c) => (
                        <ScopeChip key={c.id} category={c} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope categories pagination"
                        size="compact"
                      />
                    ) : null}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Actions</h4>
                    <div className="admin-menu-manage-actions">
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={moveMenus.length === 0}
                        onClick={() => {
                          setMoveMenuId(moveMenus[0]?.id ?? "");
                          setMoveOpen(true);
                        }}
                      >
                        <span className="admin-menu-manage-action-label">Move to another menu</span>
                        <span className="admin-menu-manage-action-desc">Attach selected categories to a different menu surface.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-action" onClick={handleEdit}>
                        <span className="admin-menu-manage-action-label">
                          {editableTargets.length === 1 ? "Edit category" : "Edit a category"}
                        </span>
                        <span className="admin-menu-manage-action-desc">Update name, description, and parent menu.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-action" onClick={() => void runDuplicate(false)}>
                        <span className="admin-menu-manage-action-label">
                          {targets.length === 1 ? "Duplicate" : `Duplicate ${targets.length}`}
                        </span>
                        <span className="admin-menu-manage-action-desc">Create draft copies with the same items.</span>
                      </button>
                      {targets.length === 1 ? (
                        <button type="button" className="admin-menu-manage-action" onClick={() => void runDuplicate(true)}>
                          <span className="admin-menu-manage-action-label">Duplicate to…</span>
                          <span className="admin-menu-manage-action-desc">Copy this category into another menu.</span>
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous category actions">
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setDangerKind("archive")}>
                        <span className="admin-menu-manage-danger-btn-label">Archive</span>
                        <span className="admin-menu-manage-danger-btn-desc">Hide categories from guest menus.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setDangerKind("delete")}>
                        <span className="admin-menu-manage-danger-btn-label">Delete category</span>
                        <span className="admin-menu-manage-danger-btn-desc">Permanently remove categories and their items.</span>
                      </button>
                      {visibleTargets.length > 0 ? (
                        <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setDangerKind("unpublish")}>
                          <span className="admin-menu-manage-danger-btn-label">Hide</span>
                          <span className="admin-menu-manage-danger-btn-desc">Hide visible categories in the draft workspace.</span>
                        </button>
                      ) : null}
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <MenuPageModalShell
        open={moveOpen}
        onClose={moveBusy ? () => undefined : () => setMoveOpen(false)}
        title="Move to another menu"
        description="Choose the menu surface these categories should belong to."
        titleId="move-category-menu-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Destination menu</span>
          <select className={`${inputBase} mt-1 w-full`} value={moveMenuId} onChange={(e) => setMoveMenuId(e.target.value)}>
            {moveMenus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </AdminLabel>
        <ProfileModalFooter
          onCancel={() => setMoveOpen(false)}
          onConfirm={() => void runMove()}
          confirmLabel={moveBusy ? "Moving…" : "Move"}
          busy={moveBusy}
          confirmDisabled={!moveMenuId || targets.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "archive"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Archive categories?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} categories`} will be hidden from guests.`}
        titleId="archive-category-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runBulkVisibility(false, "Archive")}
          confirmLabel={dangerBusy ? "Archiving…" : "Archive"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "unpublish"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Hide categories?"
        description="Visible categories will be hidden in the draft workspace until you show them again. Guests still see the last published menu version."
        titleId="hide-category-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runBulkVisibility(false, "Hide")}
          confirmLabel={dangerBusy ? "Hiding…" : "Hide"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "delete"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Delete categories?"
        description="This permanently removes categories and their items. Type the exact name(s) to confirm."
        titleId="delete-category-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Type {expectedConfirm}</span>
          <AdminInput
            className="mt-1 admin-menu-danger-confirm-input"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            autoComplete="off"
            disabled={dangerBusy}
          />
        </AdminLabel>
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runDelete()}
          confirmLabel={dangerBusy ? "Deleting…" : "Delete"}
          busy={dangerBusy}
          confirmDisabled={confirmName.trim() !== expectedConfirm}
          danger
        />
      </MenuPageModalShell>

      <DuplicateEntityModal
        open={duplicateOpen && targets.length === 1}
        kind="category"
        sourceId={targets[0]?.id ?? ""}
        sourceName={targets[0]?.name ?? "Category"}
        token={token}
        restaurantId={restaurantId}
        destinations={menus
          .filter((m) => m.status !== "ARCHIVED")
          .map((m) => ({
            id: m.id,
            label: m.name,
            hint: m.status === "PUBLISHED" ? "Live" : m.status === "RETIRED" ? "Retired" : "Draft"
          }))}
        defaultDestinationId={targets[0]?.menuId ?? null}
        allowChangeDestination={duplicateToMode}
        onClose={() => {
          setDuplicateOpen(false);
          setDuplicateToMode(false);
        }}
        onDuplicated={(result) => {
          pushToast(`“${result.name}” created as a draft copy.`, "success");
          onRefresh();
          setDuplicateOpen(false);
          setDuplicateToMode(false);
        }}
      />
    </>,
    document.body
  );
}

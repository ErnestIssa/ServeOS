import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  copyMenuItem,
  deleteMenuItem,
  duplicateMenuItem,
  updateMenuItem,
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
import type { ItemListRow } from "./itemListHelpers";

const SCOPE_PAGE_SIZE = 8;

type Props = {
  open: boolean;
  items: ItemListRow[];
  selectedIds: Set<string>;
  menus: MenuSurfaceRow[];
  categories: Array<{ id: string; name: string; menuId: string | null }>;
  token: string;
  restaurantId: string;
  venueName: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onEditItem: (item: ItemListRow) => void;
  onAddModifiers: (item: ItemListRow) => void;
  onPreview: (item: ItemListRow) => void;
  onViewOrderHistory: (item: ItemListRow) => void;
};

type DangerKind = "archive" | "delete" | "draft" | null;
type TransferMode = "move" | "copy" | null;
type TransferKind = "category" | "menu";
type TransferStep = "kind" | "dest";
type SingleItemAction = "edit" | "modifiers" | "preview" | "history";

function singleItemActionCopy(action: SingleItemAction) {
  switch (action) {
    case "edit":
      return {
        title: "Edit which item?",
        description: "Choose one item from the list to edit.",
        confirmLabel: "Edit item"
      };
    case "modifiers":
      return {
        title: "Add modifiers to which item?",
        description: "Choose one item to attach modifier groups to.",
        confirmLabel: "Continue"
      };
    case "preview":
      return {
        title: "Preview which item?",
        description: "Choose one item to open in the guest ordering preview.",
        confirmLabel: "Open preview"
      };
    case "history":
      return {
        title: "View order history for which item?",
        description: "Choose one item to open its order history.",
        confirmLabel: "View history"
      };
  }
}

function ScopeChip({ item }: { item: ItemListRow }) {
  const live = item.lifecycle === "ACTIVE" && item.isActive && !item.isSoldOut;
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${live ? "live" : "draft"}`}
        title={`${item.name} — ${item.categoryName} · ${item.menuName}`}
      >
        {item.name}
      </span>
    </li>
  );
}

export function ItemManageDrawer({
  open,
  items,
  selectedIds,
  menus,
  categories,
  token,
  restaurantId,
  venueName,
  onClose,
  onRefresh,
  onClearSelection,
  onEditItem,
  onAddModifiers,
  onPreview,
  onViewOrderHistory
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [transferMode, setTransferMode] = useState<TransferMode>(null);
  const [transferStep, setTransferStep] = useState<TransferStep>("kind");
  const [transferKind, setTransferKind] = useState<TransferKind>("category");
  const [destMenuId, setDestMenuId] = useState("");
  const [destCategoryId, setDestCategoryId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const [pickAction, setPickAction] = useState<SingleItemAction | null>(null);
  const [pickedItemId, setPickedItemId] = useState("");

  const [dangerKind, setDangerKind] = useState<DangerKind>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateToMode, setDuplicateToMode] = useState(false);

  const targets = useMemo(() => {
    const real = items.filter((item) => !isUiOnlyListId(item.id));
    if (selectedIds.size === 0) return real;
    return real.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((item) => item.id).join(",")}`
  });

  const moveMenus = menus.filter((m) => m.status !== "ARCHIVED");
  const categoriesForMenu = useMemo(
    () => categories.filter((c) => c.menuId === destMenuId),
    [categories, destMenuId]
  );

  const anyAvailable = targets.some((item) => !item.isSoldOut);
  const anyUnavailable = targets.some((item) => item.isSoldOut);

  const selectionLabel =
    selectedIds.size > 0 ? `${selectedIds.size} selected` : `${targets.length} in list`;

  const transferOpen = transferMode != null;
  const pickOpen = pickAction != null;
  const dangerOpen = dangerKind != null;
  const showManageShell = mounted && !dangerOpen && !transferOpen && !pickOpen && !duplicateOpen;

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

  useModalScrollLock(mounted || dangerOpen || transferOpen || pickOpen || duplicateOpen);

  useEffect(() => {
    if (!visible || dangerOpen || transferOpen || pickOpen || duplicateOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dangerOpen, transferOpen, pickOpen, duplicateOpen, onClose]);

  useEffect(() => {
    if (!dangerOpen) {
      setConfirmName("");
      setDangerError(null);
    }
  }, [dangerOpen]);

  useEffect(() => {
    if (!transferOpen) {
      setTransferStep("kind");
      setTransferKind("category");
      setDestMenuId("");
      setDestCategoryId("");
      setTransferBusy(false);
    }
  }, [transferOpen]);

  useEffect(() => {
    if (open) return;
    setPickAction(null);
    setPickedItemId("");
    setTransferMode(null);
    setDangerKind(null);
  }, [open]);

  useEffect(() => {
    if (!pickOpen) {
      setPickedItemId("");
      return;
    }
    if (!pickedItemId || !targets.some((item) => item.id === pickedItemId)) {
      setPickedItemId(targets[0]?.id ?? "");
    }
  }, [pickOpen, targets, pickedItemId]);

  useEffect(() => {
    if (transferKind !== "menu") return;
    if (!destMenuId && moveMenus.length > 0) {
      setDestMenuId(moveMenus[0]!.id);
    }
  }, [transferKind, destMenuId, moveMenus]);

  useEffect(() => {
    if (transferKind !== "menu") return;
    if (categoriesForMenu.length === 0) {
      setDestCategoryId("");
      return;
    }
    if (!categoriesForMenu.some((c) => c.id === destCategoryId)) {
      setDestCategoryId(categoriesForMenu[0]!.id);
    }
  }, [transferKind, categoriesForMenu, destCategoryId]);

  const expectedConfirm =
    targets.length === 1 ? targets[0]!.name : targets.map((item) => item.name).join(", ");

  const openTransfer = (mode: "move" | "copy") => {
    setTransferMode(mode);
    setTransferStep("kind");
    setTransferKind("category");
    setDestMenuId(moveMenus[0]?.id ?? "");
    setDestCategoryId(categories[0]?.id ?? "");
  };

  const runSoldOut = async (isSoldOut: boolean, label: string) => {
    let ok = 0;
    let failed = 0;
    for (const item of targets) {
      if (item.isSoldOut === isSoldOut) continue;
      const res = await updateMenuItem(token, restaurantId, item.id, { isSoldOut });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} items updated.`, "success");
      onRefresh();
      onClearSelection();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? `One item could not be updated.` : `${failed} could not be updated.`, "error");
    }
  };

  const runLifecycle = async (lifecycle: "ARCHIVED" | "DRAFT", label: string) => {
    setDangerBusy(true);
    setDangerError(null);
    let ok = 0;
    let failed = 0;
    for (const item of targets) {
      const res = await updateMenuItem(token, restaurantId, item.id, { lifecycle });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? `${label} completed.` : `${ok} items updated.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError(`Could not ${label.toLowerCase()} the selected items.`);
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
    for (const item of targets) {
      const res = await deleteMenuItem(token, restaurantId, item.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setDangerBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? "Item deleted." : `${ok} items deleted.`, "success");
      onRefresh();
      onClearSelection();
      setDangerKind(null);
      onClose();
    }
    if (failed > 0 && ok === 0) {
      setDangerError("Could not delete the selected items.");
    } else if (failed > 0) {
      pushToast(`${failed} could not be deleted.`, "error");
      setDangerKind(null);
      onClose();
    }
  };

  const runTransfer = async () => {
    if (!destCategoryId || !transferMode) return;
    setTransferBusy(true);
    let ok = 0;
    let failed = 0;
    for (const item of targets) {
      const res =
        transferMode === "move"
          ? await updateMenuItem(token, restaurantId, item.id, { categoryId: destCategoryId })
          : await copyMenuItem(token, restaurantId, item.id, { categoryId: destCategoryId });
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setTransferBusy(false);
    const verb = transferMode === "move" ? "moved" : "copied";
    if (ok > 0) {
      pushToast(ok === 1 ? `Item ${verb}.` : `${ok} items ${verb}.`, "success");
      onRefresh();
      onClearSelection();
      setTransferMode(null);
      onClose();
    }
    if (failed > 0) {
      pushToast(
        failed === 1 ? `One item could not be ${verb}.` : `${failed} could not be ${verb}.`,
        "error"
      );
    }
  };

  const runDuplicate = async (toOtherCategory: boolean) => {
    if (targets.length === 1) {
      setDuplicateToMode(toOtherCategory);
      setDuplicateOpen(true);
      return;
    }
    let ok = 0;
    let failed = 0;
    for (const item of targets) {
      const res = await duplicateMenuItem(token, restaurantId, item.id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    if (ok > 0) {
      pushToast(ok === 1 ? "Item duplicated." : `${ok} items duplicated.`, "success");
      onRefresh();
    }
    if (failed > 0) {
      pushToast(failed === 1 ? "One item could not be duplicated." : `${failed} could not be duplicated.`, "error");
    }
  };

  const handleEdit = () => {
    if (targets.length < 1) return;
    setPickAction("edit");
  };

  const handleSpecial = (action: "modifiers" | "preview" | "history") => {
    if (targets.length < 1) return;
    setPickAction(action);
  };

  const confirmPickedItem = () => {
    if (!pickAction) return;
    const item = targets.find((t) => t.id === pickedItemId);
    if (!item) {
      pushToast("Choose an item to continue.", "error");
      return;
    }
    const action = pickAction;
    setPickAction(null);
    if (action === "edit") onEditItem(item);
    else if (action === "modifiers") onAddModifiers(item);
    else if (action === "preview") onPreview(item);
    else onViewOrderHistory(item);
    onClose();
  };

  const transferTitle = transferMode === "copy" ? "Copy items" : "Move items";
  const transferDescription =
    transferStep === "kind"
      ? "Choose whether to place items in another category or under another menu."
      : transferKind === "menu"
        ? "Select the destination menu, then a category on that menu."
        : "Select the destination category.";

  const canConfirmTransfer =
    Boolean(destCategoryId) &&
    targets.length > 0 &&
    (transferKind === "category" || (Boolean(destMenuId) && categoriesForMenu.length > 0));

  const pickCopy = pickAction ? singleItemActionCopy(pickAction) : null;

  if (!mounted && !dangerOpen && !transferOpen && !pickOpen && !duplicateOpen) return null;

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
            aria-label="Close manage items"
            tabIndex={visible ? 0 : -1}
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={visible ? 0 : -1}
            aria-label="Manage items"
            className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
          >
            <header className="admin-staff-profile-header">
              <div className="min-w-0 flex-1">
                <h3 className="admin-staff-profile-title">Manage items</h3>
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
                <p className="admin-staff-drawer-hint">Select items from the list to manage them.</p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                      {scopePager.pagedItems.map((item) => (
                        <ScopeChip key={item.id} item={item} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope items pagination"
                        size="compact"
                      />
                    ) : null}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Actions</h4>
                    <div className="admin-menu-manage-actions">
                      <button type="button" className="admin-menu-manage-action" onClick={handleEdit}>
                        <span className="admin-menu-manage-action-label">Edit item</span>
                        <span className="admin-menu-manage-action-desc">
                          Update name, price, category, and details for one item.
                        </span>
                      </button>
                      <button type="button" className="admin-menu-manage-action" onClick={() => void runDuplicate(false)}>
                        <span className="admin-menu-manage-action-label">
                          {targets.length === 1 ? "Duplicate" : `Duplicate ${targets.length}`}
                        </span>
                        <span className="admin-menu-manage-action-desc">Create draft copies of the selected items.</span>
                      </button>
                      {targets.length === 1 ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          disabled={categories.length === 0}
                          onClick={() => void runDuplicate(true)}
                        >
                          <span className="admin-menu-manage-action-label">Duplicate to…</span>
                          <span className="admin-menu-manage-action-desc">Copy this item into another category.</span>
                        </button>
                      ) : null}
                      {anyAvailable ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          onClick={() => void runSoldOut(true, "Mark unavailable")}
                        >
                          <span className="admin-menu-manage-action-label">Mark unavailable</span>
                          <span className="admin-menu-manage-action-desc">Show items as sold out to guests.</span>
                        </button>
                      ) : null}
                      {anyUnavailable ? (
                        <button
                          type="button"
                          className="admin-menu-manage-action"
                          onClick={() => void runSoldOut(false, "Mark available")}
                        >
                          <span className="admin-menu-manage-action-label">Mark available</span>
                          <span className="admin-menu-manage-action-desc">Clear sold-out status so guests can order.</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={categories.length === 0}
                        onClick={() => openTransfer("move")}
                      >
                        <span className="admin-menu-manage-action-label">Move</span>
                        <span className="admin-menu-manage-action-desc">Relocate items to another category or menu.</span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={categories.length === 0}
                        onClick={() => openTransfer("copy")}
                      >
                        <span className="admin-menu-manage-action-label">Copy</span>
                        <span className="admin-menu-manage-action-desc">Place copies into another category or menu (same name).</span>
                      </button>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">More</h4>
                    <div className="admin-menu-manage-actions">
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={targets.length === 0}
                        onClick={() => handleSpecial("modifiers")}
                      >
                        <span className="admin-menu-manage-action-label">Add modifiers</span>
                        <span className="admin-menu-manage-action-desc">
                          Attach modifier groups to one item from the list.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={targets.length === 0}
                        onClick={() => handleSpecial("preview")}
                      >
                        <span className="admin-menu-manage-action-label">Preview</span>
                        <span className="admin-menu-manage-action-desc">
                          Open a guest-facing preview for one item.
                        </span>
                      </button>
                      <button
                        type="button"
                        className="admin-menu-manage-action"
                        disabled={targets.length === 0}
                        onClick={() => handleSpecial("history")}
                      >
                        <span className="admin-menu-manage-action-label">View order history</span>
                        <span className="admin-menu-manage-action-desc">
                          See recent orders that included one item.
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous item actions">
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setDangerKind("archive")}>
                        <span className="admin-menu-manage-danger-btn-label">
                          {targets.length > 1 ? "Archive items" : "Archive item"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">Hide items from guest menus.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setDangerKind("delete")}>
                        <span className="admin-menu-manage-danger-btn-label">
                          {targets.length > 1 ? "Delete items" : "Delete item"}
                        </span>
                        <span className="admin-menu-manage-danger-btn-desc">Permanently remove items from the menu.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setDangerKind("draft")}>
                        <span className="admin-menu-manage-danger-btn-label">Mark as draft</span>
                        <span className="admin-menu-manage-danger-btn-desc">Return items to draft in the workspace. Guests keep the last published version until you publish menu changes.</span>
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <MenuPageModalShell
        open={pickOpen}
        onClose={() => setPickAction(null)}
        title={pickCopy?.title ?? "Choose an item"}
        description={pickCopy?.description ?? "Select one item from the list to continue."}
        titleId="item-pick-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">Item</span>
          <select
            className={`${inputBase} mt-1 w-full`}
            value={pickedItemId}
            onChange={(e) => setPickedItemId(e.target.value)}
            aria-label="Choose item"
          >
            {targets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} — {item.categoryName}
              </option>
            ))}
          </select>
        </AdminLabel>
        <ProfileModalFooter
          onCancel={() => setPickAction(null)}
          onConfirm={confirmPickedItem}
          confirmLabel={pickCopy?.confirmLabel ?? "Continue"}
          confirmDisabled={!pickedItemId || targets.length === 0}
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={transferOpen}
        onClose={transferBusy ? () => undefined : () => setTransferMode(null)}
        title={transferTitle}
        description={transferDescription}
        titleId="item-transfer-title"
        stackLevel="overlay"
      >
        {transferStep === "kind" ? (
          <>
            <div className="admin-menu-manage-actions" role="group" aria-label="Destination kind">
              <button
                type="button"
                className="admin-menu-manage-action"
                onClick={() => {
                  setTransferKind("category");
                  setDestCategoryId(categories[0]?.id ?? "");
                  setTransferStep("dest");
                }}
              >
                <span className="admin-menu-manage-action-label">Another category</span>
                <span className="admin-menu-manage-action-desc">Pick any category as the destination.</span>
              </button>
              <button
                type="button"
                className="admin-menu-manage-action"
                disabled={moveMenus.length === 0}
                onClick={() => {
                  setTransferKind("menu");
                  const firstMenuId = moveMenus[0]?.id ?? "";
                  setDestMenuId(firstMenuId);
                  const firstCat = categories.find((c) => c.menuId === firstMenuId);
                  setDestCategoryId(firstCat?.id ?? "");
                  setTransferStep("dest");
                }}
              >
                <span className="admin-menu-manage-action-label">Another menu</span>
                <span className="admin-menu-manage-action-desc">Choose a menu surface, then a category on it.</span>
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setTransferMode(null)}
                className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {transferKind === "menu" ? (
              <>
                <AdminLabel>
                  <span className="text-xs admin-config-text-muted">Destination menu</span>
                  <select
                    className={`${inputBase} mt-1 w-full`}
                    value={destMenuId}
                    onChange={(e) => setDestMenuId(e.target.value)}
                    disabled={transferBusy}
                  >
                    {moveMenus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </AdminLabel>
                <AdminLabel>
                  <span className="text-xs admin-config-text-muted">Destination category</span>
                  <select
                    className={`${inputBase} mt-1 w-full`}
                    value={destCategoryId}
                    onChange={(e) => setDestCategoryId(e.target.value)}
                    disabled={transferBusy || categoriesForMenu.length === 0}
                  >
                    {categoriesForMenu.length === 0 ? (
                      <option value="">No categories on this menu</option>
                    ) : (
                      categoriesForMenu.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </AdminLabel>
              </>
            ) : (
              <AdminLabel>
                <span className="text-xs admin-config-text-muted">Destination category</span>
                <select
                  className={`${inputBase} mt-1 w-full`}
                  value={destCategoryId}
                  onChange={(e) => setDestCategoryId(e.target.value)}
                  disabled={transferBusy}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </AdminLabel>
            )}
            <ProfileModalFooter
              onCancel={() => setTransferStep("kind")}
              onConfirm={() => void runTransfer()}
              confirmLabel={
                transferBusy
                  ? transferMode === "copy"
                    ? "Copying…"
                    : "Moving…"
                  : transferMode === "copy"
                    ? "Copy"
                    : "Move"
              }
              busy={transferBusy}
              confirmDisabled={!canConfirmTransfer}
            />
          </>
        )}
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "archive"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Archive items?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} items`} will be archived and hidden from guests.`}
        titleId="archive-item-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runLifecycle("ARCHIVED", "Archive")}
          confirmLabel={dangerBusy ? "Archiving…" : "Archive"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "draft"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Mark items as draft?"
        description={`${targets.length === 1 ? `“${targets[0]?.name}”` : `${targets.length} items`} will return to draft.`}
        titleId="draft-item-title"
        stackLevel="overlay"
      >
        {dangerError ? <ProfileModalAlert tone="error">{dangerError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setDangerKind(null)}
          onConfirm={() => void runLifecycle("DRAFT", "Mark as draft")}
          confirmLabel={dangerBusy ? "Updating…" : "Mark as draft"}
          busy={dangerBusy}
          danger
        />
      </MenuPageModalShell>

      <MenuPageModalShell
        open={dangerKind === "delete"}
        onClose={dangerBusy ? () => undefined : () => setDangerKind(null)}
        title="Delete items?"
        description="This permanently removes items from the menu. Type the exact name(s) to confirm."
        titleId="delete-item-title"
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
        kind="item"
        sourceId={targets[0]?.id ?? ""}
        sourceName={targets[0]?.name ?? "Item"}
        token={token}
        restaurantId={restaurantId}
        destinations={categories
          .filter((c) => {
            if (!c.menuId) return true;
            const menu = menus.find((m) => m.id === c.menuId);
            return !menu || menu.status !== "ARCHIVED";
          })
          .map((c) => ({
            id: c.id,
            label: c.name,
            hint: c.menuId ? menus.find((m) => m.id === c.menuId)?.name : undefined
          }))}
        defaultDestinationId={targets[0]?.categoryId ?? null}
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

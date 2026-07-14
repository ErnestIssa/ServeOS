import { useEffect, useMemo, useRef, useState } from "react";
import { SignupModalShell } from "../../../signup/SignupModalShell";
import type { MenuCapabilitiesPayload, MenuSurfaceRow } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import type { MenuSectionTab } from "../configRouting";
import {
  attachUploadedMediaToItem,
  attachUploadedMediaToMenuCover,
  readVideoDurationMs,
  uploadMenuMediaFile
} from "./menuMediaUpload";
import { MenuItemMediaGallery } from "./MenuItemMediaGallery";

type CategoryRow = {
  id: string;
  name: string;
  menuId: string | null;
  itemCount: number;
};

type ItemRow = {
  id: string;
  name: string;
  categoryName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  kind: "image" | "video";
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  categories: CategoryRow[];
  items: ItemRow[];
  canUpload: boolean;
  canRemove: boolean;
  limits: MenuCapabilitiesPayload["limits"] | null;
  onNavigateTab: (tab: MenuSectionTab) => void;
  onRefresh: () => void;
};

type Step = "destination" | "category-choice" | "item";

function ChoiceCard({
  title,
  subtitle,
  meta,
  active,
  onClick
}: {
  title: string;
  subtitle: string;
  meta?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`admin-search-result-card group text-left ${active ? "admin-search-result-card--active" : ""}`}
      onClick={onClick}
    >
      <span className="admin-search-result-category">{meta ?? "Option"}</span>
      <span className="admin-search-result-title">{title}</span>
      <span className="admin-search-result-subtitle">{subtitle}</span>
    </button>
  );
}

export function MenuMediaDestinationModal({
  open,
  onClose,
  kind,
  token,
  restaurantId,
  menus,
  categories,
  items,
  canUpload,
  canRemove,
  limits,
  onNavigateTab,
  onRefresh
}: Props) {
  const { pushToast } = useAdminToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("destination");
  const [menuId, setMenuId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<"menu-cover" | "item" | null>(null);

  const activeMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);

  useEffect(() => {
    if (!open) {
      setStep("destination");
      setCategoryId("");
      setSelectedItemId(null);
      setPendingAction(null);
      return;
    }
    if (!menuId && activeMenus[0]) setMenuId(activeMenus[0].id);
  }, [open, menuId, activeMenus]);

  const selectedMenu = activeMenus.find((m) => m.id === menuId) ?? null;

  const menuCategories = useMemo(() => {
    if (!menuId) return categories;
    return categories.filter((c) => c.menuId === menuId || c.menuId == null);
  }, [categories, menuId]);

  const selectedCategory = menuCategories.find((c) => c.id === categoryId) ?? null;

  const itemsInCategory = useMemo(() => {
    if (!categoryId) return [];
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return [];
    return items.filter((i) => i.categoryName === cat.name);
  }, [categoryId, categories, items]);

  const mediaLabelPlural = kind === "image" ? "images" : "videos";

  function goDestination() {
    setStep("destination");
    setCategoryId("");
    setSelectedItemId(null);
    setPendingAction(null);
  }

  function closeAll() {
    onClose();
    goDestination();
  }

  function openFilePicker(action: "menu-cover" | "item", itemId?: string) {
    if (!canUpload) {
      pushToast("You do not have permission to upload menu media.", "error");
      return;
    }
    setPendingAction(action);
    if (itemId) setSelectedItemId(itemId);
    fileRef.current?.click();
  }

  async function handleFile(file: File) {
    if (!pendingAction || !menuId) return;

    let durationMs: number | undefined;
    if (kind === "video") {
      try {
        durationMs = await readVideoDurationMs(file);
        const maxMs = limits?.maxVideoDurationMs ?? 60_000;
        if (durationMs > maxMs) {
          pushToast("Videos must be 60 seconds or shorter.", "error");
          return;
        }
      } catch {
        pushToast("Could not read video duration.", "error");
        return;
      }
    }

    setBusy(true);
    const uploaded = await uploadMenuMediaFile(token, {
      restaurantId,
      file,
      kind,
      menuItemId: pendingAction === "item" ? selectedItemId ?? undefined : undefined
    });
    if (!uploaded.ok) {
      setBusy(false);
      pushToast(uploaded.error ?? "Upload failed", "error");
      return;
    }

    if (pendingAction === "menu-cover") {
      const attached = await attachUploadedMediaToMenuCover(token, restaurantId, menuId, uploaded.mediaId);
      setBusy(false);
      if (!attached.ok) {
        pushToast(attached.message ?? attached.error ?? "Could not set menu cover", "error");
        return;
      }
      pushToast("Menu cover updated.", "success");
      onRefresh();
      closeAll();
      return;
    }

    if (pendingAction === "item" && selectedItemId) {
      const attached = await attachUploadedMediaToItem(token, restaurantId, selectedItemId, {
        mediaId: uploaded.mediaId,
        setAsCover: kind === "image",
        durationMs
      });
      setBusy(false);
      if (!attached.ok) {
        pushToast(attached.message ?? attached.error ?? "Could not attach media", "error");
        return;
      }
      pushToast(kind === "image" ? "Image added to item." : "Video added to item.", "success");
      onRefresh();
    }
    setBusy(false);
  }

  const headerTitle =
    step === "destination"
      ? `Select where to add ${mediaLabelPlural}`
      : step === "category-choice"
        ? selectedCategory
          ? `Add ${kind} to ${selectedCategory.name}`
          : "Set menu cover"
        : selectedCategory
          ? `Items in ${selectedCategory.name}`
          : "Pick an item";

  const headerHint =
    step === "destination"
      ? "Menus are guest-facing surfaces. Categories group dishes. Items are individual products."
      : step === "category-choice"
        ? "Menu cover is one hero photo for the whole menu — not tied to a single dish."
        : "Photos and videos attach to one item at a time.";

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm,video/quicktime"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      <SignupModalShell
        open={open}
        onClose={closeAll}
        labelledBy="menu-media-dest-title"
        backdropLabel="Close media destination picker"
        shellClassName="admin-search-modal-shell fixed inset-0 z-[110] flex items-center justify-center overflow-hidden p-4 sm:p-6"
        panelClassName="admin-search-modal-panel relative z-[1] flex w-full max-w-[min(94vw,52rem)] flex-col overflow-hidden rounded-[1.5rem] border shadow-[0_32px_100px_rgba(15,23,42,0.32)] backdrop-blur-xl"
      >
        <div className="admin-search-modal-header shrink-0 border-b px-5 py-5 sm:px-7 sm:py-6">
          <p id="menu-media-dest-title" className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600/90">
            Menu {mediaLabelPlural}
          </p>
          <p className="mt-2 text-center font-display text-xl font-bold sm:text-2xl">{headerTitle}</p>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm admin-config-text-subtle">{headerHint}</p>

          {activeMenus.length > 1 ? (
            <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide admin-config-text-muted">Menu surface</span>
              {activeMenus.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    menuId === m.id
                      ? "bg-violet-600 text-white"
                      : "border border-slate-200/80 bg-white/80 admin-config-text-subtle hover:border-violet-200"
                  }`}
                  onClick={() => {
                    setMenuId(m.id);
                    goDestination();
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ) : selectedMenu ? (
            <p className="mt-3 text-center text-xs admin-config-text-muted">
              Editing menu: <strong className="admin-config-text">{selectedMenu.name}</strong>
            </p>
          ) : null}
        </div>

        <div className="admin-search-modal-body flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {activeMenus.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
              <p className="text-sm admin-config-text-subtle">Create a menu surface first — then you can add cover photos and item media.</p>
              <AdminBtnPrimary
                onClick={() => {
                  closeAll();
                  onNavigateTab("menus");
                }}
              >
                Go to Menus
              </AdminBtnPrimary>
            </div>
          ) : step === "destination" ? (
            <>
              <p className="admin-search-modal-kicker shrink-0 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600/80">
                Step 1 · Where should this go?
              </p>
              <div className="admin-search-modal-grid mt-4">
                <ChoiceCard
                  meta="Menu · hero cover"
                  title="This menu (cover only)"
                  subtitle="One photo or short video for the whole menu listing — not linked to any dish."
                  onClick={() => {
                    setCategoryId("");
                    setStep("category-choice");
                  }}
                />
                {menuCategories.length === 0 ? (
                  <ChoiceCard
                    meta="Categories"
                    title="No categories yet"
                    subtitle="Group dishes first (Burgers, Drinks…) — then add item photos by category."
                    onClick={() => {
                      closeAll();
                      onNavigateTab("categories");
                    }}
                  />
                ) : (
                  menuCategories.map((cat) => (
                    <ChoiceCard
                      key={cat.id}
                      meta={`Category · ${cat.itemCount} item${cat.itemCount === 1 ? "" : "s"}`}
                      title={cat.name}
                      subtitle="Add media to dishes in this category, or set the menu cover."
                      onClick={() => {
                        setCategoryId(cat.id);
                        setStep("category-choice");
                      }}
                    />
                  ))
                )}
              </div>
            </>
          ) : step === "category-choice" ? (
            <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
              <p className="admin-search-modal-kicker text-center text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600/80">
                Step 2 · What is this {kind} for?
              </p>

              {selectedCategory ? (
                <p className="text-center text-sm admin-config-text-subtle">
                  Category <strong className="admin-config-text">{selectedCategory.name}</strong> — choose menu cover or item photos.
                </p>
              ) : (
                <p className="text-center text-sm admin-config-text-subtle">
                  Menu cover for <strong className="admin-config-text">{selectedMenu?.name}</strong>.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <AdminBtnPrimary className="flex-1" disabled={busy} onClick={() => openFilePicker("menu-cover")}>
                  Upload menu cover
                </AdminBtnPrimary>
                {selectedCategory ? (
                  <AdminBtnSecondary
                    className="flex-1"
                    disabled={busy}
                    onClick={() => {
                      if (itemsInCategory.length === 0) {
                        closeAll();
                        onNavigateTab("items");
                        return;
                      }
                      setStep("item");
                    }}
                  >
                    Upload to items in {selectedCategory.name}
                  </AdminBtnSecondary>
                ) : null}
              </div>

              {selectedCategory && itemsInCategory.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
                  <p className="text-sm admin-config-text-subtle">No items in {selectedCategory.name} yet.</p>
                  <AdminBtnPrimary className="mt-3" onClick={() => { closeAll(); onNavigateTab("items"); }}>
                    Create items
                  </AdminBtnPrimary>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 text-xs leading-relaxed admin-config-text-subtle dark:border-slate-700/50 dark:bg-slate-900/30">
                <p>
                  <strong className="admin-config-text">Menu cover</strong> — shown on the menu card; guests see it before browsing dishes.
                </p>
                <p className="mt-2">
                  <strong className="admin-config-text">Item photos</strong> — attached to one product; shown on that dish in the guest app.
                </p>
              </div>

              <button type="button" className="admin-page-link-btn mx-auto text-sm" onClick={goDestination}>
                ← Back to categories
              </button>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-2xl">
              <p className="admin-search-modal-kicker text-center text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600/80">
                Step 3 · Pick a dish
              </p>
              <p className="mt-2 text-center text-sm admin-config-text-subtle">
                Tap an item to upload a {kind} for that product only.
              </p>
              <div className="admin-search-modal-grid mt-4">
                {itemsInCategory.map((item) => (
                  <ChoiceCard
                    key={item.id}
                    meta="Item"
                    title={item.name}
                    subtitle={`In ${item.categoryName} · product photo`}
                    active={selectedItemId === item.id}
                    onClick={() => openFilePicker("item", item.id)}
                  />
                ))}
              </div>
              {selectedItemId && canUpload ? (
                <div className="mt-6">
                  <MenuItemMediaGallery
                    token={token}
                    restaurantId={restaurantId}
                    menuItemId={selectedItemId}
                    itemName={itemsInCategory.find((i) => i.id === selectedItemId)?.name ?? "Item"}
                    canUpload={canUpload}
                    canRemove={canRemove}
                    limits={limits}
                  />
                </div>
              ) : null}
              <button type="button" className="admin-page-link-btn mx-auto mt-6 block text-sm" onClick={() => setStep("category-choice")}>
                ← Back
              </button>
            </div>
          )}
        </div>

        <div className="admin-search-modal-footer shrink-0 border-t px-5 py-4 sm:px-7">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs admin-config-text-muted">
              {kind === "image" ? "JPEG, PNG, WebP, GIF" : "MP4, WebM · max 60s"}
            </span>
            <button type="button" className="admin-page-link-btn text-sm font-bold" onClick={closeAll}>
              Close
            </button>
          </div>
        </div>
      </SignupModalShell>
    </>
  );
}

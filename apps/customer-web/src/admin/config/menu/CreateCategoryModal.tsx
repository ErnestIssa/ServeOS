import { useEffect, useMemo, useState } from "react";
import { createCategory, type MenuSurfaceRow } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel, inputBase } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import type { MenuSectionTab } from "../configRouting";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  MenuPageModalShell
} from "./menuPageModalShell";

export type CreateCategoryForm = {
  name: string;
  description: string;
  menuId: string;
};

const emptyForm = (menuId: string): CreateCategoryForm => ({
  name: "",
  description: "",
  menuId
});

function menuStatusHint(menu: MenuSurfaceRow) {
  if (menu.status === "PUBLISHED") return "Live for guests";
  if (menu.status === "ARCHIVED") return "Archived";
  return "Draft — not visible to guests yet";
}

function validateForm(form: CreateCategoryForm) {
  const errors: Partial<Record<keyof CreateCategoryForm, string>> = {};
  const name = form.name.trim();
  if (!name) errors.name = "Please enter a category name.";
  else if (name.length < 2) errors.name = "Category name needs at least 2 characters.";
  if (!form.menuId) errors.menuId = "Please choose a menu.";
  return errors;
}

function friendlyCategoryCreateError(message?: string, error?: string) {
  const raw = `${error ?? ""} ${message ?? ""}`.toLowerCase();
  if (raw.includes("menu_not_found")) {
    return "We couldn't find that menu. Refresh the page and try again.";
  }
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to create categories for this venue.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find that venue. Refresh the page and try again.";
  }
  return "We couldn't create the category right now. Please try again.";
}

function isDirty(form: CreateCategoryForm, defaultMenuId: string) {
  return form.name.trim() !== "" || form.description.trim() !== "" || form.menuId !== defaultMenuId;
}

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  onClose: () => void;
  onCreated: () => void;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

function CreateCategoryConfirmModal({
  open,
  venueLabel,
  menuLabel,
  form,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  venueLabel: string;
  menuLabel: string;
  form: CreateCategoryForm;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create category?"
      description={`“${form.name.trim()}” will be added to ${menuLabel} at ${venueLabel}. You can add items to it next.`}
      titleId="create-category-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      <ProfileModalNote>
        <strong>{form.name.trim()}</strong>
        {form.description.trim() ? (
          <>
            <br />
            {form.description.trim()}
          </>
        ) : null}
        <br />
        Menu: <strong>{menuLabel}</strong>
        <br />
        Venue: <strong>{venueLabel}</strong>
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create category"
        cancelLabel="Go back"
        busy={busy}
      />
    </MenuPageModalShell>
  );
}

export function CreateCategoryModal({
  open,
  venueName,
  token,
  restaurantId,
  menus: menusProp,
  onClose,
  onCreated,
  onNavigateTab
}: Props) {
  const activeMenus = useMemo(() => menusProp.filter((m) => m.status !== "ARCHIVED"), [menusProp]);
  const defaultMenuId = activeMenus[0]?.id ?? "";

  const [form, setForm] = useState<CreateCategoryForm>(() => emptyForm(defaultMenuId));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form, defaultMenuId);

  const menuOptions = useMemo(
    () =>
      activeMenus.map((m) => ({
        value: m.id,
        label: m.name,
        hint: menuStatusHint(m)
      })),
    [activeMenus]
  );

  const selectedMenu = activeMenus.find((m) => m.id === form.menuId) ?? null;
  const selectedMenuLabel = selectedMenu?.name ?? "Menu";

  useEffect(() => {
    if (!open) {
      setForm(emptyForm(defaultMenuId));
      setSubmitAttempted(false);
      setSending(false);
      setConfirmOpen(false);
      setDiscardOpen(false);
      setShakeSubmit(false);
      setSubmitError(null);
      return;
    }

    setForm((prev) => ({
      ...prev,
      menuId: prev.menuId && activeMenus.some((m) => m.id === prev.menuId) ? prev.menuId : defaultMenuId
    }));
  }, [open, defaultMenuId, activeMenus]);

  const patch = <K extends keyof CreateCategoryForm>(key: K, value: CreateCategoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const attemptClose = () => {
    if (sending) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const finishClose = () => {
    setDiscardOpen(false);
    setConfirmOpen(false);
    setForm(emptyForm(defaultMenuId));
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof CreateCategoryForm) => {
    const showError = submitAttempted && errors[key];
    const value = String(form[key] ?? "").trim();
    const showOk = submitAttempted && !errors[key] && value;
    return [showError ? "admin-staff-field--error" : "", showOk ? "admin-staff-field--ok" : ""]
      .filter(Boolean)
      .join(" ");
  };

  const submitTone =
    submitAttempted && hasErrors
      ? "admin-staff-invite-submit--error"
      : !hasErrors && form.name.trim() && form.menuId
        ? "admin-staff-invite-submit--ready"
        : "";

  const openConfirm = () => {
    setSubmitAttempted(true);
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setShakeSubmit(true);
      window.setTimeout(() => setShakeSubmit(false), 520);
      return;
    }
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const handleCreate = async () => {
    setSending(true);
    setSubmitError(null);
    const res = await createCategory(token, restaurantId, {
      name: form.name.trim(),
      menuId: form.menuId,
      description: form.description.trim() || undefined
    });
    setSending(false);

    if (!res.ok || !res.category) {
      setSubmitError(friendlyCategoryCreateError(res.message, res.error));
      return;
    }

    onCreated();
    finishClose();
  };

  return (
    <>
      <MenuPageModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title="Create category"
        description="Add a group for dishes within a menu — like Starters, Mains, or Drinks. You'll add items after the category is created."
        titleId="create-category-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal admin-menu-create-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        <div className="admin-menu-create-hero" aria-hidden>
          <div className="admin-menu-create-hero__icon">☰</div>
          <p className="admin-menu-create-hero__text">
            Create the categories for your items that will be in the desired menus
          </p>
        </div>

        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Category name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Pizza, burgers, drinks, desserts"
                autoComplete="off"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                aria-invalid={(submitAttempted && Boolean(errors.name)) || undefined}
              />
              {submitAttempted && errors.name ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.name}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel className={fieldClass("description")}>
              <span className="admin-staff-field-label">Description (optional)</span>
              <textarea
                className={`${inputBase} admin-staff-premium-input admin-staff-premium-textarea admin-menu-create-description admin-menu-create-field-input mt-1`}
                placeholder="What guests should expect in this section — shareable plates, kids portions, bar bites, and so on"
                rows={5}
                value={form.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </AdminLabel>
          </div>

          <div className="admin-menu-create-form__meta">
            <div className={fieldClass("menuId")}>
              {menuOptions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                  <p className="text-sm admin-config-text-subtle">This venue has no menus yet. Create a menu first, then add categories.</p>
                  <AdminBtnPrimary
                    className="mt-3"
                    onClick={() => {
                      finishClose();
                      onNavigateTab("menus");
                    }}
                  >
                    Go to Menus
                  </AdminBtnPrimary>
                </div>
              ) : (
                <>
                  <AdminBubbleDropdown
                    label="Menu"
                    required
                    dropInline
                    value={form.menuId}
                    options={menuOptions}
                    onChange={(v) => patch("menuId", v)}
                  />
                  {submitAttempted && errors.menuId ? (
                    <span className="admin-staff-field-error" role="alert">
                      {errors.menuId}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={attemptClose} disabled={sending}>
            Cancel
          </AdminBtnSecondary>
          <button
            type="button"
            disabled={sending || menuOptions.length === 0}
            onClick={openConfirm}
            className={`admin-staff-invite-submit admin-menu-create-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
          >
            Review & create
          </button>
        </div>
      </MenuPageModalShell>

      <CreateCategoryConfirmModal
        open={confirmOpen}
        venueLabel={venueName}
        menuLabel={selectedMenuLabel}
        form={form}
        busy={sending}
        error={submitError}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />

      <MenuPageModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard category?"
        description="Your category details will be lost if you close now."
        titleId="discard-category-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <ProfileModalNote>You have unsaved category details. This cannot be undone.</ProfileModalNote>
        <ProfileModalFooter
          onCancel={() => setDiscardOpen(false)}
          onConfirm={finishClose}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          danger
        />
      </MenuPageModalShell>
    </>
  );
}

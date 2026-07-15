import { useEffect, useMemo, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import { createMenuItem, updateMenuItem } from "../../../api";
import type { MenuSurfaceRow } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import type { MenuSectionTab } from "../configRouting";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  MenuPageModalShell
} from "./menuPageModalShell";
import {
  detailsFromItem,
  detailsPatchPayload,
  detailsPayload,
  emptyMenuItemDetails,
  MenuItemDetailsPanel
} from "./MenuItemDetailsPanel";

export type CreateItemForm = {
  categoryId: string;
  name: string;
  price: string;
};

export type EditItemTarget = {
  id: string;
  categoryId: string;
  name: string;
  priceCents: number;
  description: string | null;
  ingredients: string | null;
  specialNotes: string | null;
};

type CategoryOption = {
  id: string;
  name: string;
  menuId: string | null;
};

const emptyForm = (categoryId: string): CreateItemForm => ({
  categoryId,
  name: "",
  price: "12.00"
});

function formFromEdit(target: EditItemTarget): CreateItemForm {
  return {
    categoryId: target.categoryId,
    name: target.name,
    price: (target.priceCents / 100).toFixed(2)
  };
}

function parsePriceCents(raw: string) {
  const dollars = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function validateForm(form: CreateItemForm) {
  const errors: Partial<Record<keyof CreateItemForm, string>> = {};
  const name = form.name.trim();
  if (!form.categoryId) errors.categoryId = "Please choose a category.";
  if (!name) errors.name = "Please enter an item name.";
  else if (name.length < 2) errors.name = "Item name needs at least 2 characters.";
  if (parsePriceCents(form.price) === null) errors.price = "Please enter a valid price.";
  return errors;
}

function friendlyItemCreateError(message?: string, error?: string) {
  const raw = `${error ?? ""} ${message ?? ""}`.toLowerCase();
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to create items for this venue.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find that category. Refresh the page and try again.";
  }
  return "We couldn't create the item right now. Please try again.";
}

function friendlyItemSaveError(error?: string) {
  const raw = (error ?? "").toLowerCase();
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to edit this item.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find this item. Refresh the page and try again.";
  }
  return "We couldn't save your changes right now. Please try again.";
}

function isCreateDirty(form: CreateItemForm, defaultCategoryId: string, details: ReturnType<typeof emptyMenuItemDetails>) {
  return (
    form.name.trim() !== "" ||
    form.categoryId !== defaultCategoryId ||
    form.price !== "12.00" ||
    details.description.trim() !== "" ||
    details.ingredients.trim() !== "" ||
    details.specialNotes.trim() !== ""
  );
}

function isDetailsDirty(
  details: ReturnType<typeof emptyMenuItemDetails>,
  baseline: ReturnType<typeof emptyMenuItemDetails>
) {
  return (
    details.description.trim() !== baseline.description.trim() ||
    details.ingredients.trim() !== baseline.ingredients.trim() ||
    details.specialNotes.trim() !== baseline.specialNotes.trim()
  );
}

type Props = {
  open: boolean;
  mode?: "create" | "edit-details";
  editTarget?: EditItemTarget | null;
  canEdit?: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  categories: CategoryOption[];
  menus: MenuSurfaceRow[];
  onClose: () => void;
  onCreated: () => void;
  onSaved?: () => void;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

function CreateItemConfirmModal({
  open,
  venueLabel,
  categoryLabel,
  form,
  priceCents,
  details,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  venueLabel: string;
  categoryLabel: string;
  form: CreateItemForm;
  priceCents: number;
  details: ReturnType<typeof emptyMenuItemDetails>;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create item?"
      description={`“${form.name.trim()}” will be added to ${categoryLabel} at ${venueLabel}.`}
      titleId="create-item-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      <ProfileModalNote>
        <strong>{form.name.trim()}</strong>
        <br />
        Category: <strong>{categoryLabel}</strong>
        <br />
        Price: <strong>{formatMoneyCents(priceCents)}</strong>
        {details.description.trim() ? (
          <>
            <br />
            {details.description.trim()}
          </>
        ) : null}
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create item"
        cancelLabel="Go back"
        busy={busy}
      />
    </MenuPageModalShell>
  );
}

export function CreateItemModal({
  open,
  mode = "create",
  editTarget = null,
  canEdit = true,
  venueName,
  token,
  restaurantId,
  categories,
  menus,
  onClose,
  onCreated,
  onSaved,
  onNavigateTab
}: Props) {
  const isEdit = mode === "edit-details";
  const defaultCategoryId = categories[0]?.id ?? "";
  const [form, setForm] = useState<CreateItemForm>(() => emptyForm(defaultCategoryId));
  const [details, setDetails] = useState(() => emptyMenuItemDetails());
  const [detailsBaseline, setDetailsBaseline] = useState(() => emptyMenuItemDetails());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
        hint: menus.find((m) => m.id === c.menuId)?.name ?? "Menu"
      })),
    [categories, menus]
  );

  const selectedCategory = categories.find((c) => c.id === form.categoryId) ?? null;
  const selectedCategoryLabel = selectedCategory?.name ?? "Category";

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const detailsDirty = isDetailsDirty(details, detailsBaseline);
  const dirty = isEdit ? detailsDirty : isCreateDirty(form, defaultCategoryId, details);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm(defaultCategoryId));
      setDetails(emptyMenuItemDetails());
      setDetailsBaseline(emptyMenuItemDetails());
      setSubmitAttempted(false);
      setSending(false);
      setConfirmOpen(false);
      setDiscardOpen(false);
      setShakeSubmit(false);
      setSubmitError(null);
      return;
    }

    if (isEdit && editTarget) {
      const seededDetails = detailsFromItem(editTarget);
      setForm(formFromEdit(editTarget));
      setDetails(seededDetails);
      setDetailsBaseline(seededDetails);
      return;
    }

    setForm((prev) => ({
      ...prev,
      categoryId: prev.categoryId && categories.some((c) => c.id === prev.categoryId) ? prev.categoryId : defaultCategoryId
    }));
  }, [open, defaultCategoryId, categories, isEdit, editTarget]);

  const patch = <K extends keyof CreateItemForm>(key: K, value: CreateItemForm[K]) => {
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
    setForm(emptyForm(defaultCategoryId));
    setDetails(emptyMenuItemDetails());
    setDetailsBaseline(emptyMenuItemDetails());
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof CreateItemForm) => {
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
      : !hasErrors && form.name.trim() && form.categoryId
        ? "admin-staff-invite-submit--ready"
        : "";

  const editSubmitTone = detailsDirty && canEdit ? "admin-staff-invite-submit--ready" : "";

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
    const priceCents = parsePriceCents(form.price);
    if (priceCents === null) return;

    setSending(true);
    setSubmitError(null);
    const res = await createMenuItem(token, restaurantId, {
      categoryId: form.categoryId,
      name: form.name.trim(),
      priceCents,
      ...detailsPayload(details)
    });
    setSending(false);

    if (!res.ok || !res.item) {
      setSubmitError(friendlyItemCreateError(undefined, res.error));
      return;
    }

    onCreated();
    finishClose();
  };

  const handleSaveDetails = async () => {
    if (!editTarget || !canEdit || !detailsDirty) return;

    setSending(true);
    setSubmitError(null);
    const res = await updateMenuItem(token, restaurantId, editTarget.id, detailsPatchPayload(details));
    setSending(false);

    if (!res.ok) {
      setSubmitError(friendlyItemSaveError(res.error));
      return;
    }

    onSaved?.();
    finishClose();
  };

  const priceCents = parsePriceCents(form.price) ?? 0;

  return (
    <>
      <MenuPageModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title={isEdit ? "Description & ingredients" : "Create item"}
        description={
          isEdit
            ? `Update guest-facing copy for “${editTarget?.name ?? "this item"}”. Name, price, and category stay as they are.`
            : "Add a dish or product and assign it to a category. You can add photos, modifiers, and availability after it's created."
        }
        titleId={isEdit ? "edit-item-details-title" : "create-item-title"}
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal admin-menu-create-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        {!isEdit ? (
          <div className="admin-menu-create-hero" aria-hidden>
            <div className="admin-menu-create-hero__icon">☰</div>
            <p className="admin-menu-create-hero__text">Create product items for your desired categories</p>
          </div>
        ) : null}

        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Item name {!isEdit ? <span className="admin-staff-field-required">*</span> : null}
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Cheeseburger"
                autoComplete="off"
                value={form.name}
                readOnly={isEdit}
                onChange={(e) => patch("name", e.target.value)}
                aria-invalid={(submitAttempted && Boolean(errors.name)) || undefined}
              />
              {submitAttempted && errors.name ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.name}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel className={fieldClass("price")}>
              <span className="admin-staff-field-label">
                Base price {!isEdit ? <span className="admin-staff-field-required">*</span> : null}
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. 12.00"
                inputMode="decimal"
                autoComplete="off"
                value={form.price}
                readOnly={isEdit}
                onChange={(e) => patch("price", e.target.value)}
                aria-invalid={(submitAttempted && Boolean(errors.price)) || undefined}
              />
              {submitAttempted && errors.price ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.price}
                </span>
              ) : null}
            </AdminLabel>
          </div>

          <div className="admin-menu-create-form__meta">
            <div className={fieldClass("categoryId")}>
              {categoryOptions.length === 0 && !isEdit ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                  <p className="text-sm admin-config-text-subtle">This venue has no categories yet. Create a category first, then add items.</p>
                  <AdminBtnPrimary
                    className="mt-3"
                    onClick={() => {
                      finishClose();
                      onNavigateTab("categories");
                    }}
                  >
                    Go to Categories
                  </AdminBtnPrimary>
                </div>
              ) : (
                <>
                  <AdminBubbleDropdown
                    label="Category"
                    required={!isEdit}
                    dropInline
                    disabled={isEdit}
                    value={form.categoryId}
                    options={categoryOptions}
                    onChange={(v) => patch("categoryId", v)}
                  />
                  {submitAttempted && errors.categoryId ? (
                    <span className="admin-staff-field-error" role="alert">
                      {errors.categoryId}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <MenuItemDetailsPanel value={details} onChange={setDetails} defaultOpen={isEdit} />
        </div>

        {submitError && isEdit ? <ProfileModalAlert tone="error">{submitError}</ProfileModalAlert> : null}

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={attemptClose} disabled={sending}>
            Cancel
          </AdminBtnSecondary>
          {isEdit ? (
            <button
              type="button"
              disabled={sending || !canEdit || !detailsDirty}
              onClick={() => void handleSaveDetails()}
              className={`admin-staff-invite-submit admin-menu-create-submit ${editSubmitTone}`}
            >
              {sending ? "Saving…" : "Save changes"}
            </button>
          ) : (
            <button
              type="button"
              disabled={sending || categoryOptions.length === 0}
              onClick={openConfirm}
              className={`admin-staff-invite-submit admin-menu-create-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
            >
              Review & create
            </button>
          )}
        </div>
      </MenuPageModalShell>

      {!isEdit ? (
        <CreateItemConfirmModal
          open={confirmOpen}
          venueLabel={venueName}
          categoryLabel={selectedCategoryLabel}
          form={form}
          priceCents={priceCents}
          details={details}
          busy={sending}
          error={submitError}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleCreate()}
        />
      ) : null}

      <MenuPageModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={isEdit ? "Discard changes?" : "Discard item?"}
        description={isEdit ? "Your description and ingredient changes will be lost if you close now." : "Your item details will be lost if you close now."}
        titleId="discard-item-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <ProfileModalNote>You have unsaved changes. This cannot be undone.</ProfileModalNote>
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

import { useEffect, useMemo, useState } from "react";
import { createModifierGroup } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import type { MenuSectionTab } from "../configRouting";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  ProfileModalShell
} from "../../profile/ProfileModalShell";

export type CreateModifierGroupForm = {
  itemId: string;
  name: string;
};

type ItemOption = {
  id: string;
  name: string;
  categoryName: string;
};

const emptyForm = (itemId: string): CreateModifierGroupForm => ({
  itemId,
  name: ""
});

function validateForm(form: CreateModifierGroupForm) {
  const errors: Partial<Record<keyof CreateModifierGroupForm, string>> = {};
  const name = form.name.trim();
  if (!form.itemId) errors.itemId = "Please choose an item.";
  if (!name) errors.name = "Please enter a group name.";
  else if (name.length < 2) errors.name = "Group name needs at least 2 characters.";
  return errors;
}

function friendlyModifierGroupCreateError(error?: string) {
  const raw = (error ?? "").toLowerCase();
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to create modifier groups for this venue.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find that item. Refresh the page and try again.";
  }
  return "We couldn't create the modifier group right now. Please try again.";
}

function isDirty(form: CreateModifierGroupForm, defaultItemId: string) {
  return form.name.trim() !== "" || form.itemId !== defaultItemId;
}

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  items: ItemOption[];
  onClose: () => void;
  onCreated: () => void;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

function CreateModifierGroupConfirmModal({
  open,
  venueLabel,
  itemLabel,
  form,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  venueLabel: string;
  itemLabel: string;
  form: CreateModifierGroupForm;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create modifier group?"
      description={`“${form.name.trim()}” will be added to ${itemLabel} at ${venueLabel}. You can add options like Small or Large next.`}
      titleId="create-modifier-group-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      <ProfileModalNote>
        <strong>{form.name.trim()}</strong>
        <br />
        Item: <strong>{itemLabel}</strong>
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create group"
        cancelLabel="Go back"
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function CreateModifierGroupModal({
  open,
  venueName,
  token,
  restaurantId,
  items,
  onClose,
  onCreated,
  onNavigateTab
}: Props) {
  const defaultItemId = items[0]?.id ?? "";
  const [form, setForm] = useState<CreateModifierGroupForm>(() => emptyForm(defaultItemId));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const itemOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: i.name,
        hint: i.categoryName
      })),
    [items]
  );

  const selectedItem = items.find((i) => i.id === form.itemId) ?? null;
  const selectedItemLabel = selectedItem?.name ?? "Item";

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form, defaultItemId);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm(defaultItemId));
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
      itemId: prev.itemId && items.some((i) => i.id === prev.itemId) ? prev.itemId : defaultItemId
    }));
  }, [open, defaultItemId, items]);

  const patch = <K extends keyof CreateModifierGroupForm>(key: K, value: CreateModifierGroupForm[K]) => {
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
    setForm(emptyForm(defaultItemId));
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof CreateModifierGroupForm) => {
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
      : !hasErrors && form.name.trim() && form.itemId
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
    const res = await createModifierGroup(token, restaurantId, form.itemId, {
      name: form.name.trim()
    });
    setSending(false);

    if (!res.ok || !res.group) {
      setSubmitError(friendlyModifierGroupCreateError(res.error));
      return;
    }

    onCreated();
    finishClose();
  };

  return (
    <>
      <ProfileModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title="Create modifier group"
        description="Add a choice group to an item — like Choose Size or Choose Bread. You'll add individual options after the group is created."
        titleId="create-modifier-group-title"
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
            Create modifier groups for your items — size, bread, toppings, and more
          </p>
        </div>

        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Group name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Choose Size, Choose Bread"
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
          </div>

          <div className="admin-menu-create-form__meta">
            <div className={fieldClass("itemId")}>
              {itemOptions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                  <p className="text-sm admin-config-text-subtle">This venue has no items yet. Create an item first, then add modifier groups.</p>
                  <AdminBtnPrimary
                    className="mt-3"
                    onClick={() => {
                      finishClose();
                      onNavigateTab("items");
                    }}
                  >
                    Go to Items
                  </AdminBtnPrimary>
                </div>
              ) : (
                <>
                  <AdminBubbleDropdown
                    label="Item"
                    required
                    dropInline
                    value={form.itemId}
                    options={itemOptions}
                    onChange={(v) => patch("itemId", v)}
                  />
                  {submitAttempted && errors.itemId ? (
                    <span className="admin-staff-field-error" role="alert">
                      {errors.itemId}
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
            disabled={sending || itemOptions.length === 0}
            onClick={openConfirm}
            className={`admin-staff-invite-submit admin-menu-create-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
          >
            Review & create
          </button>
        </div>
      </ProfileModalShell>

      <CreateModifierGroupConfirmModal
        open={confirmOpen}
        venueLabel={venueName}
        itemLabel={selectedItemLabel}
        form={form}
        busy={sending}
        error={submitError}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />

      <ProfileModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard modifier group?"
        description="Your group details will be lost if you close now."
        titleId="discard-modifier-group-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <ProfileModalNote>You have unsaved group details. This cannot be undone.</ProfileModalNote>
        <ProfileModalFooter
          onCancel={() => setDiscardOpen(false)}
          onConfirm={finishClose}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          danger
        />
      </ProfileModalShell>
    </>
  );
}

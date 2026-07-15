import { useEffect, useMemo, useState } from "react";
import { updateModifierOption } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { ProfileModalAlert, MenuPageModalShell } from "./menuPageModalShell";

export type EditModifierOptionTarget = {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  itemName: string;
  priceDeltaCents: number;
  isActive: boolean;
};

type Form = {
  name: string;
  price: string;
};

function formFromTarget(target: EditModifierOptionTarget): Form {
  return {
    name: target.name,
    price: (target.priceDeltaCents / 100).toFixed(2)
  };
}

function parsePriceCents(raw: string) {
  const dollars = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function validateForm(form: Form) {
  const errors: Partial<Record<keyof Form, string>> = {};
  const name = form.name.trim();
  if (!name) errors.name = "Please enter an option name.";
  else if (name.length < 1) errors.name = "Option name is required.";
  if (parsePriceCents(form.price) === null) errors.price = "Please enter a valid extra price.";
  return errors;
}

function isDirty(form: Form, baseline: Form) {
  return form.name.trim() !== baseline.name.trim() || form.price !== baseline.price;
}

type Props = {
  open: boolean;
  target: EditModifierOptionTarget | null;
  canEdit: boolean;
  token: string;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function EditModifierOptionModal({ open, target, canEdit, token, restaurantId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>({ name: "", price: "0.00" });
  const [baseline, setBaseline] = useState<Form>({ name: "", price: "0.00" });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => validateForm(form), [form]);
  const dirty = isDirty(form, baseline);

  useEffect(() => {
    if (!open || !target) {
      setSubmitAttempted(false);
      setSending(false);
      setDiscardOpen(false);
      setSubmitError(null);
      return;
    }
    const seeded = formFromTarget(target);
    setForm(seeded);
    setBaseline(seeded);
  }, [open, target]);

  const patch = <K extends keyof Form>(key: K, value: Form[K]) => {
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
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof Form) => {
    const showError = submitAttempted && errors[key];
    const value = String(form[key] ?? "").trim();
    const showOk = submitAttempted && !errors[key] && value;
    return [showError ? "admin-staff-field--error" : "", showOk ? "admin-staff-field--ok" : ""].filter(Boolean).join(" ");
  };

  const handleSave = async () => {
    if (!target || !canEdit) return;
    setSubmitAttempted(true);
    const nextErrors = validateForm(form);
    if (Object.keys(nextErrors).length > 0) return;
    const priceCents = parsePriceCents(form.price);
    if (priceCents === null) return;
    if (!dirty) {
      finishClose();
      return;
    }

    setSending(true);
    setSubmitError(null);
    const res = await updateModifierOption(token, restaurantId, target.id, {
      name: form.name.trim(),
      priceDeltaCents: priceCents
    });
    setSending(false);

    if (!res.ok) {
      setSubmitError("We couldn't save your changes right now. Please try again.");
      return;
    }

    onSaved();
    finishClose();
  };

  if (!target) return null;

  return (
    <>
      <MenuPageModalShell
        open={open && !discardOpen}
        onClose={attemptClose}
        title="Edit modifier option"
        description={`Update “${target.name}” in ${target.groupName}.`}
        titleId="edit-modifier-option-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal admin-menu-create-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel>
              <span className="admin-staff-field-label">Group</span>
              <AdminInput className="admin-staff-premium-input admin-menu-create-field-input" value={target.groupName} readOnly />
            </AdminLabel>
            <AdminLabel>
              <span className="admin-staff-field-label">Item</span>
              <AdminInput className="admin-staff-premium-input admin-menu-create-field-input" value={target.itemName} readOnly />
            </AdminLabel>

            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Option name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Large"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
              />
              {submitAttempted && errors.name ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.name}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel className={fieldClass("price")}>
              <span className="admin-staff-field-label">
                Extra price <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. 1.50"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => patch("price", e.target.value)}
              />
              {submitAttempted && errors.price ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.price}
                </span>
              ) : null}
            </AdminLabel>
          </div>
        </div>

        {submitError ? <ProfileModalAlert tone="error">{submitError}</ProfileModalAlert> : null}

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={attemptClose} disabled={sending}>
            Cancel
          </AdminBtnSecondary>
          <button
            type="button"
            disabled={sending || !canEdit || !dirty}
            onClick={() => void handleSave()}
            className={`admin-staff-invite-submit admin-menu-create-submit${dirty && canEdit ? " admin-staff-invite-submit--ready" : ""}`}
          >
            {sending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </MenuPageModalShell>

      <MenuPageModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard changes?"
        description="Your modifier option changes will be lost if you close now."
        titleId="discard-edit-modifier-option-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={() => setDiscardOpen(false)}>Keep editing</AdminBtnSecondary>
          <button type="button" className="admin-staff-danger-btn" onClick={finishClose}>
            Discard
          </button>
        </div>
      </MenuPageModalShell>
    </>
  );
}

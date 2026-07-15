import { useEffect, useMemo, useState } from "react";
import { updateModifierGroup } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { ProfileModalAlert, MenuPageModalShell } from "./menuPageModalShell";

export type EditModifierGroupTarget = {
  id: string;
  name: string;
  itemId: string;
  itemName: string;
  minSelect: number;
  maxSelect: number;
};

type Form = {
  name: string;
  minSelect: string;
  maxSelect: string;
};

function formFromTarget(target: EditModifierGroupTarget): Form {
  return {
    name: target.name,
    minSelect: String(target.minSelect),
    maxSelect: String(target.maxSelect)
  };
}

function validateForm(form: Form) {
  const errors: Partial<Record<keyof Form, string>> = {};
  const name = form.name.trim();
  if (!name) errors.name = "Please enter a group name.";
  else if (name.length < 2) errors.name = "Group name needs at least 2 characters.";
  const min = Number(form.minSelect);
  const max = Number(form.maxSelect);
  if (!Number.isInteger(min) || min < 0) errors.minSelect = "Please enter a valid minimum.";
  if (!Number.isInteger(max) || max < 0) errors.maxSelect = "Please enter a valid maximum.";
  else if (Number.isInteger(min) && max < min) errors.maxSelect = "Maximum must be at least the minimum.";
  return errors;
}

function isDirty(form: Form, baseline: Form) {
  return form.name.trim() !== baseline.name.trim() || form.minSelect !== baseline.minSelect || form.maxSelect !== baseline.maxSelect;
}

type Props = {
  open: boolean;
  target: EditModifierGroupTarget | null;
  canEdit: boolean;
  token: string;
  restaurantId: string;
  onClose: () => void;
  onSaved: () => void;
};

export function EditModifierGroupModal({ open, target, canEdit, token, restaurantId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>({ name: "", minSelect: "0", maxSelect: "1" });
  const [baseline, setBaseline] = useState<Form>({ name: "", minSelect: "0", maxSelect: "1" });
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
    if (!dirty) {
      finishClose();
      return;
    }

    setSending(true);
    setSubmitError(null);
    const res = await updateModifierGroup(token, restaurantId, target.id, {
      name: form.name.trim(),
      minSelect: Number(form.minSelect),
      maxSelect: Number(form.maxSelect)
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
        title="Edit modifier group"
        description={`Update “${target.name}” on ${target.itemName}.`}
        titleId="edit-modifier-group-title"
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
              <span className="admin-staff-field-label">Item</span>
              <AdminInput className="admin-staff-premium-input admin-menu-create-field-input" value={target.itemName} readOnly />
            </AdminLabel>

            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Group name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
              />
              {submitAttempted && errors.name ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.name}
                </span>
              ) : null}
            </AdminLabel>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminLabel className={fieldClass("minSelect")}>
                <span className="admin-staff-field-label">Min select</span>
                <AdminInput
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  inputMode="numeric"
                  value={form.minSelect}
                  onChange={(e) => patch("minSelect", e.target.value)}
                />
                {submitAttempted && errors.minSelect ? (
                  <span className="admin-staff-field-error" role="alert">
                    {errors.minSelect}
                  </span>
                ) : null}
              </AdminLabel>

              <AdminLabel className={fieldClass("maxSelect")}>
                <span className="admin-staff-field-label">Max select</span>
                <AdminInput
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  inputMode="numeric"
                  value={form.maxSelect}
                  onChange={(e) => patch("maxSelect", e.target.value)}
                />
                {submitAttempted && errors.maxSelect ? (
                  <span className="admin-staff-field-error" role="alert">
                    {errors.maxSelect}
                  </span>
                ) : null}
              </AdminLabel>
            </div>
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
        description="Your modifier group changes will be lost if you close now."
        titleId="discard-edit-modifier-group-title"
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

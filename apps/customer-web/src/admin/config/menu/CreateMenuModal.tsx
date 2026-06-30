import { useEffect, useMemo, useState } from "react";
import { createRestaurantMenu, type MenuSurfaceRow } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  ProfileModalShell
} from "../../profile/ProfileModalShell";

export type CreateMenuForm = {
  name: string;
  description: string;
  surfaceKey: string;
};

const EMPTY_FORM: CreateMenuForm = {
  name: "",
  description: "",
  surfaceKey: "custom"
};

const SURFACE_OPTIONS = [
  { value: "main", label: "Main menu" },
  { value: "lunch", label: "Lunch menu" },
  { value: "dinner", label: "Dinner menu" },
  { value: "drinks", label: "Drinks" },
  { value: "seasonal", label: "Seasonal menu" },
  { value: "custom", label: "Custom surface" }
] as const;

function validateForm(form: CreateMenuForm) {
  const errors: Partial<Record<keyof CreateMenuForm, string>> = {};
  const name = form.name.trim();
  if (!name) errors.name = "Menu name is required.";
  else if (name.length < 2) errors.name = "Use at least 2 characters.";
  return errors;
}

function isDirty(form: CreateMenuForm) {
  return form.name.trim() !== "" || form.description.trim() !== "" || form.surfaceKey !== "custom";
}

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  onClose: () => void;
  onCreated: (menu: MenuSurfaceRow) => void;
};

function CreateMenuConfirmModal({
  open,
  venueName,
  form,
  surfaceLabel,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  venueName: string;
  form: CreateMenuForm;
  surfaceLabel: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create draft menu?"
      description={`A new draft menu surface will be added to ${venueName}. Guests will not see it until you publish.`}
      titleId="create-menu-confirm-title"
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
        Type: <strong>{surfaceLabel}</strong>
        <br />
        Status: <strong>Draft</strong> — you can add categories, items, images, and videos before publishing.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create draft menu"
        cancelLabel="Go back"
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function CreateMenuModal({ open, venueName, token, restaurantId, onClose, onCreated }: Props) {
  const [form, setForm] = useState<CreateMenuForm>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof CreateMenuForm, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setTouched({});
      setSubmitAttempted(false);
      setSending(false);
      setConfirmOpen(false);
      setDiscardOpen(false);
      setShakeSubmit(false);
      setSubmitError(null);
    }
  }, [open]);

  const patch = (key: keyof CreateMenuForm, value: string) => {
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
    setForm(EMPTY_FORM);
    setTouched({});
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof CreateMenuForm) => {
    const showError = (touched[key] || submitAttempted) && errors[key];
    const showOk = (touched[key] || submitAttempted) && !errors[key] && String(form[key]).trim();
    return [showError ? "admin-staff-field--error" : "", showOk ? "admin-staff-field--ok" : ""]
      .filter(Boolean)
      .join(" ");
  };

  const submitTone =
    submitAttempted && hasErrors
      ? "admin-staff-invite-submit--error"
      : !hasErrors && form.name.trim()
        ? "admin-staff-invite-submit--ready"
        : "";

  const surfaceLabel = SURFACE_OPTIONS.find((o) => o.value === form.surfaceKey)?.label ?? form.surfaceKey;

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
    const res = await createRestaurantMenu(token, restaurantId, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      surfaceKey: form.surfaceKey
    });
    setSending(false);

    if (!res.ok || !res.menu) {
      setSubmitError(res.message ?? res.error ?? "Could not create menu.");
      return;
    }

    onCreated(res.menu);
    finishClose();
  };

  return (
    <>
      <ProfileModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title="Create menu"
        description="Start a new draft menu surface. Build categories, items, photos, and short videos — then publish when guests should see it."
        titleId="create-menu-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal admin-menu-create-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        <div className="admin-menu-create-hero" aria-hidden>
          <div className="admin-menu-create-hero__icon">☰</div>
          <p className="admin-menu-create-hero__text">Draft menus stay private until you publish.</p>
        </div>

        <div className="admin-staff-invite-form">
          <div className="admin-staff-invite-form__identity">
            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Menu name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input"
                placeholder="e.g. Lunch Menu"
                autoComplete="off"
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                aria-invalid={Boolean(errors.name) || undefined}
              />
              {(touched.name || submitAttempted) && errors.name ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.name}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel className={fieldClass("description")}>
              <span className="admin-staff-field-label">Description (optional)</span>
              <AdminInput
                className="admin-staff-premium-input"
                placeholder="What guests see this menu for"
                autoComplete="off"
                value={form.description}
                onChange={(e) => patch("description", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, description: true }))}
              />
            </AdminLabel>
          </div>

          <div className="admin-staff-invite-form__assignments">
            <div className="admin-staff-invite-venue-note admin-menu-create-venue-note">
              <p className="admin-staff-invite-venue-note__label">Venue</p>
              <p className="admin-staff-invite-venue-note__value">{venueName}</p>
              <p className="admin-staff-invite-venue-note__hint">
                Role-based permissions control who can edit items, media, modifiers, and publish.
              </p>
            </div>

            <div className={fieldClass("surfaceKey")}>
              <AdminBubbleDropdown
                label="Menu type"
                required
                dropInline
                value={form.surfaceKey}
                options={[...SURFACE_OPTIONS]}
                onChange={(v) => patch("surfaceKey", v)}
                onBlur={() => setTouched((p) => ({ ...p, surfaceKey: true }))}
              />
              <p className="admin-menu-create-surface-hint">Selected: {surfaceLabel}</p>
            </div>
          </div>
        </div>

        {submitAttempted && hasErrors ? (
          <p className="admin-staff-invite-form-alert" role="alert">
            Enter a menu name before continuing.
          </p>
        ) : null}

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={attemptClose} disabled={sending}>
            Cancel
          </AdminBtnSecondary>
          <button
            type="button"
            disabled={sending}
            onClick={openConfirm}
            className={`admin-staff-invite-submit admin-menu-create-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
          >
            Review & create
          </button>
        </div>
      </ProfileModalShell>

      <CreateMenuConfirmModal
        open={confirmOpen}
        venueName={venueName}
        form={form}
        surfaceLabel={surfaceLabel}
        busy={sending}
        error={submitError}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />

      <ProfileModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard menu draft?"
        description="Your menu details will be lost if you close now."
        titleId="discard-menu-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <ProfileModalNote>You have unsaved menu details. This cannot be undone.</ProfileModalNote>
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

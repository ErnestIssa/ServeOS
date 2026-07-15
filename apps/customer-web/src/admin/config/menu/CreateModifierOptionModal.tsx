import { useEffect, useMemo, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import { createModifierOption } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import type { MenuSectionTab } from "../configRouting";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  MenuPageModalShell
} from "./menuPageModalShell";

export type CreateModifierOptionForm = {
  groupId: string;
  name: string;
  price: string;
};

type GroupOption = {
  id: string;
  label: string;
};

const emptyForm = (groupId: string): CreateModifierOptionForm => ({
  groupId,
  name: "",
  price: "0.00"
});

function parsePriceCents(raw: string) {
  const dollars = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function validateForm(form: CreateModifierOptionForm) {
  const errors: Partial<Record<keyof CreateModifierOptionForm, string>> = {};
  const name = form.name.trim();
  if (!form.groupId) errors.groupId = "Please choose a modifier group.";
  if (!name) errors.name = "Please enter an option name.";
  if (parsePriceCents(form.price) === null) errors.price = "Please enter a valid extra price.";
  return errors;
}

function friendlyModifierOptionCreateError(error?: string) {
  const raw = (error ?? "").toLowerCase();
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to create modifier options for this venue.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find that modifier group. Refresh the page and try again.";
  }
  return "We couldn't create the modifier option right now. Please try again.";
}

function isDirty(form: CreateModifierOptionForm, defaultGroupId: string) {
  return form.name.trim() !== "" || form.groupId !== defaultGroupId || form.price !== "0.00";
}

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  groups: GroupOption[];
  onClose: () => void;
  onCreated: () => void;
  onNavigateTab: (tab: MenuSectionTab) => void;
};

function CreateModifierOptionConfirmModal({
  open,
  venueLabel,
  groupLabel,
  form,
  priceCents,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  venueLabel: string;
  groupLabel: string;
  form: CreateModifierOptionForm;
  priceCents: number;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <MenuPageModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create modifier option?"
      description={`“${form.name.trim()}” will be added to ${groupLabel} at ${venueLabel}.`}
      titleId="create-modifier-option-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      <ProfileModalNote>
        <strong>{form.name.trim()}</strong>
        <br />
        Group: <strong>{groupLabel}</strong>
        <br />
        Extra price: <strong>{priceCents > 0 ? `+${formatMoneyCents(priceCents)}` : formatMoneyCents(0)}</strong>
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create option"
        cancelLabel="Go back"
        busy={busy}
      />
    </MenuPageModalShell>
  );
}

export function CreateModifierOptionModal({
  open,
  venueName,
  token,
  restaurantId,
  groups,
  onClose,
  onCreated,
  onNavigateTab
}: Props) {
  const defaultGroupId = groups[0]?.id ?? "";
  const [form, setForm] = useState<CreateModifierOptionForm>(() => emptyForm(defaultGroupId));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.id,
        label: g.label,
        hint: "Modifier group"
      })),
    [groups]
  );

  const selectedGroup = groups.find((g) => g.id === form.groupId) ?? null;
  const selectedGroupLabel = selectedGroup?.label ?? "Modifier group";

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form, defaultGroupId);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm(defaultGroupId));
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
      groupId: prev.groupId && groups.some((g) => g.id === prev.groupId) ? prev.groupId : defaultGroupId
    }));
  }, [open, defaultGroupId, groups]);

  const patch = <K extends keyof CreateModifierOptionForm>(key: K, value: CreateModifierOptionForm[K]) => {
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
    setForm(emptyForm(defaultGroupId));
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof CreateModifierOptionForm) => {
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
      : !hasErrors && form.name.trim() && form.groupId
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
    const priceCents = parsePriceCents(form.price);
    if (priceCents === null) return;

    setSending(true);
    setSubmitError(null);
    const res = await createModifierOption(token, restaurantId, form.groupId, {
      name: form.name.trim(),
      priceDeltaCents: priceCents
    });
    setSending(false);

    if (!res.ok || !res.option) {
      setSubmitError(friendlyModifierOptionCreateError(res.error));
      return;
    }

    onCreated();
    finishClose();
  };

  const priceCents = parsePriceCents(form.price) ?? 0;

  return (
    <>
      <MenuPageModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title="Create modifier option"
        description="Add a choice within a modifier group — like Small, Medium, Large, or Extra cheese."
        titleId="create-modifier-option-title"
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
            Create modifier options for your groups — sizes, toppings, sides, and more
          </p>
        </div>

        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Option name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Large, Extra cheese"
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

            <AdminLabel className={fieldClass("price")}>
              <span className="admin-staff-field-label">
                Extra price <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. 1.50"
                inputMode="decimal"
                autoComplete="off"
                value={form.price}
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
            <div className={fieldClass("groupId")}>
              {groupOptions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                  <p className="text-sm admin-config-text-subtle">This venue has no modifier groups yet. Create a group first, then add options.</p>
                  <AdminBtnPrimary
                    className="mt-3"
                    onClick={() => {
                      finishClose();
                      onNavigateTab("modifier-groups");
                    }}
                  >
                    Go to Modifier groups
                  </AdminBtnPrimary>
                </div>
              ) : (
                <>
                  <AdminBubbleDropdown
                    label="Modifier group"
                    required
                    dropInline
                    value={form.groupId}
                    options={groupOptions}
                    onChange={(v) => patch("groupId", v)}
                  />
                  {submitAttempted && errors.groupId ? (
                    <span className="admin-staff-field-error" role="alert">
                      {errors.groupId}
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
            disabled={sending || groupOptions.length === 0}
            onClick={openConfirm}
            className={`admin-staff-invite-submit admin-menu-create-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
          >
            Review & create
          </button>
        </div>
      </MenuPageModalShell>

      <CreateModifierOptionConfirmModal
        open={confirmOpen}
        venueLabel={venueName}
        groupLabel={selectedGroupLabel}
        form={form}
        priceCents={priceCents}
        busy={sending}
        error={submitError}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />

      <MenuPageModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard modifier option?"
        description="Your option details will be lost if you close now."
        titleId="discard-modifier-option-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <ProfileModalNote>You have unsaved option details. This cannot be undone.</ProfileModalNote>
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

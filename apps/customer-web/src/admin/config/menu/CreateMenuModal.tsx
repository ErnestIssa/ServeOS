import { useEffect, useMemo, useState } from "react";
import { createRestaurantMenu, type MenuSurfaceRow } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel, inputBase } from "../../AdminUi";
import { AdminBubbleDropdown, type BubbleDropdownOption } from "../../AdminBubbleDropdown";
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
  surfaceKey: "main"
};

const BASE_SURFACE_OPTIONS: BubbleDropdownOption[] = [
  { value: "main", label: "Main menu" },
  { value: "lunch", label: "Lunch menu" },
  { value: "dinner", label: "Dinner menu" },
  { value: "drinks", label: "Drinks" },
  { value: "seasonal", label: "Seasonal menu" },
  { value: "custom", label: "Custom surface" }
];

function slugifySurfaceKey(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function normalizeMatchText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s*menu\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findPresetSurfaceMatch(text: string) {
  const normalized = normalizeMatchText(text);
  if (!normalized) return null;
  return (
    BASE_SURFACE_OPTIONS.find((o) => {
      if (o.value === "custom") return false;
      const byValue = o.value.toLowerCase() === normalized;
      const byLabel = normalizeMatchText(o.label) === normalized;
      const byLabelSansMenu = normalizeMatchText(o.label.replace(/\s*menu\s*/i, "")) === normalized;
      return byValue || byLabel || byLabelSansMenu;
    }) ?? null
  );
}

function validateForm(form: CreateMenuForm, customSurfaceInput: string) {
  const errors: Partial<Record<keyof CreateMenuForm | "customSurface", string>> = {};
  const name = form.name.trim();
  if (!name) errors.name = "Please enter a menu name.";
  else if (name.length < 2) errors.name = "Menu name needs at least 2 characters.";
  if (form.surfaceKey === "custom" && !customSurfaceInput.trim()) {
    errors.customSurface = "Please enter a name for this menu type, or pick one from the list.";
  }
  return errors;
}

function friendlyMenuCreateError(message?: string, error?: string) {
  const raw = `${error ?? ""} ${message ?? ""}`.toLowerCase();
  if (raw.includes("menu_name_taken") || raw.includes("already exists")) {
    return "A menu with this name already exists at this venue. Try a different name.";
  }
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to create a menu for this venue.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find that venue. Refresh the page and try again.";
  }
  return "We couldn't create the menu right now. Please try again.";
}

function isDirty(form: CreateMenuForm, customSurfaceInput: string) {
  return (
    form.name.trim() !== "" ||
    form.description.trim() !== "" ||
    form.surfaceKey !== "main" ||
    customSurfaceInput.trim() !== ""
  );
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
  venueLabel,
  form,
  surfaceLabel,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  venueLabel: string;
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
      description={`A new draft menu will be added to ${venueLabel}. Guests will not see it until you publish.`}
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
  const [customSurfaceInput, setCustomSurfaceInput] = useState("");
  const [extraSurfaceOptions, setExtraSurfaceOptions] = useState<BubbleDropdownOption[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const surfaceOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: BubbleDropdownOption[] = [];
    for (const opt of [...BASE_SURFACE_OPTIONS.filter((o) => o.value !== "custom"), ...extraSurfaceOptions, ...BASE_SURFACE_OPTIONS.filter((o) => o.value === "custom")]) {
      if (seen.has(opt.value)) continue;
      seen.add(opt.value);
      out.push(opt);
    }
    return out;
  }, [extraSurfaceOptions]);

  const errors = useMemo(() => validateForm(form, customSurfaceInput), [form, customSurfaceInput]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form, customSurfaceInput);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setCustomSurfaceInput("");
      setExtraSurfaceOptions([]);
      setSubmitAttempted(false);
      setSending(false);
      setConfirmOpen(false);
      setDiscardOpen(false);
      setShakeSubmit(false);
      setSubmitError(null);
    }
  }, [open]);

  const patch = <K extends keyof CreateMenuForm>(key: K, value: CreateMenuForm[K]) => {
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
    setCustomSurfaceInput("");
    setExtraSurfaceOptions([]);
    setSubmitAttempted(false);
    onClose();
  };

  const showFieldError = (key: keyof CreateMenuForm | "customSurface") => {
    if (key === "customSurface") {
      return submitAttempted && form.surfaceKey === "custom" && Boolean(errors.customSurface);
    }
    return Boolean(submitAttempted && errors[key]);
  };

  const fieldClass = (key: keyof CreateMenuForm | "customSurface") => {
    const showError = showFieldError(key);
    const value =
      key === "customSurface" ? customSurfaceInput : String(form[key as keyof CreateMenuForm] ?? "").trim();
    const showOk = submitAttempted && !errors[key] && value && key !== "customSurface";
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

  const surfaceLabel =
    surfaceOptions.find((o) => o.value === form.surfaceKey)?.label ??
    (form.surfaceKey === "custom" ? customSurfaceInput.trim() || "Custom surface" : form.surfaceKey);

  const resolveSurfaceKeyForSubmit = () => {
    if (form.surfaceKey !== "custom") return form.surfaceKey;
    const match = findPresetSurfaceMatch(customSurfaceInput);
    if (match) return match.value;
    return slugifySurfaceKey(customSurfaceInput) || "custom";
  };

  const commitCustomSurface = () => {
    const text = customSurfaceInput.trim();
    if (!text || form.surfaceKey !== "custom") return;

    const match = findPresetSurfaceMatch(text);
    if (match) {
      patch("surfaceKey", match.value);
      setCustomSurfaceInput("");
      return;
    }

    const slug = slugifySurfaceKey(text);
    if (!slug) return;

    setExtraSurfaceOptions((prev) => {
      if (prev.some((o) => o.value === slug) || BASE_SURFACE_OPTIONS.some((o) => o.value === slug)) return prev;
      return [...prev, { value: slug, label: text }];
    });
    patch("surfaceKey", slug);
    setCustomSurfaceInput("");
  };

  const handleCustomSurfaceChange = (text: string) => {
    setCustomSurfaceInput(text);
    const match = findPresetSurfaceMatch(text);
    if (match) {
      patch("surfaceKey", match.value);
      setCustomSurfaceInput("");
    }
  };

  const openConfirm = () => {
    setSubmitAttempted(true);

    let resolvedSurfaceKey = form.surfaceKey;
    let resolvedCustomInput = customSurfaceInput;

    if (form.surfaceKey === "custom") {
      const match = findPresetSurfaceMatch(customSurfaceInput);
      if (match) {
        resolvedSurfaceKey = match.value;
        resolvedCustomInput = "";
        setForm((prev) => ({ ...prev, surfaceKey: match.value }));
        setCustomSurfaceInput("");
      } else {
        const slug = slugifySurfaceKey(customSurfaceInput);
        if (slug) {
          const label = customSurfaceInput.trim();
          resolvedSurfaceKey = slug;
          resolvedCustomInput = "";
          setExtraSurfaceOptions((prev) => {
            if (prev.some((o) => o.value === slug) || BASE_SURFACE_OPTIONS.some((o) => o.value === slug)) return prev;
            return [...prev, { value: slug, label }];
          });
          setForm((prev) => ({ ...prev, surfaceKey: slug }));
          setCustomSurfaceInput("");
        }
      }
    }

    const nextErrors = validateForm({ ...form, surfaceKey: resolvedSurfaceKey }, resolvedCustomInput);
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
    const surfaceKey = resolveSurfaceKeyForSubmit();
    const res = await createRestaurantMenu(token, restaurantId, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      surfaceKey
    });
    setSending(false);

    if (!res.ok || !res.menu) {
      setSubmitError(friendlyMenuCreateError(res.message, res.error));
      return;
    }

    onCreated(res.menu);
    finishClose();
  };

  const showCustomSurfaceField = form.surfaceKey === "custom";

  return (
    <>
      <ProfileModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title="Create menu"
        description="Create a new menu that guests can browse and order from. You'll add categories, items, photos, and availability after it's created."
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
          <p className="admin-menu-create-hero__text">
            New menus are private by default. Nothing is visible to guests until you publish the menu.
          </p>
        </div>

        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("name")}>
              <span className="admin-staff-field-label">
                Menu name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Lunch menu"
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
                placeholder="When this menu is served, what it includes, or anything guests should know"
                rows={5}
                value={form.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </AdminLabel>
          </div>

          <div className="admin-menu-create-form__meta">
            <div className={fieldClass("surfaceKey")}>
              <AdminBubbleDropdown
                label="Menu type"
                required
                dropInline
                value={form.surfaceKey}
                options={surfaceOptions}
                onChange={(v) => {
                  patch("surfaceKey", v);
                  if (v !== "custom") setCustomSurfaceInput("");
                }}
              />
            </div>

            {showCustomSurfaceField ? (
              <div className={`admin-menu-create-custom-type ${fieldClass("customSurface")}`}>
                <AdminLabel>
                  <span className="admin-staff-field-label">Custom menu type (optional)</span>
                  <AdminInput
                    className="admin-staff-premium-input admin-menu-create-field-input"
                    placeholder="e.g. Brunch, rooftop bar, kids menu"
                    autoComplete="off"
                    value={customSurfaceInput}
                    onChange={(e) => handleCustomSurfaceChange(e.target.value)}
                    onBlur={() => commitCustomSurface()}
                  />
                  {submitAttempted && form.surfaceKey === "custom" && errors.customSurface ? (
                    <span className="admin-staff-field-error" role="alert">
                      {errors.customSurface}
                    </span>
                  ) : null}
                </AdminLabel>
              </div>
            ) : null}
          </div>
        </div>

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
        venueLabel={venueName}
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

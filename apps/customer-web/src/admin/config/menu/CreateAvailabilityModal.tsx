import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MenuSurfaceRow } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import type { MenuSectionTab } from "../configRouting";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  ProfileModalShell
} from "../../profile/ProfileModalShell";
import { AvailabilityColorPicker } from "./AvailabilityColorPicker";
import { AvailabilityPreviewCard } from "./AvailabilityPreviewCard";
import {
  AVAILABILITY_DAY_OPTIONS,
  DEFAULT_AVAILABILITY_COLOR,
  formatAvailabilityDays,
  makeAvailabilityKey,
  resolveAvailabilityColor,
  saveMenuAvailabilityWindows
} from "./availabilityHelpers";

export type CreateAvailabilityForm = {
  menuId: string;
  label: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
  color: string;
};

const emptyForm = (menuId: string): CreateAvailabilityForm => ({
  menuId,
  label: "",
  start: "09:00",
  end: "17:00",
  days: [],
  enabled: true,
  color: DEFAULT_AVAILABILITY_COLOR
});

function validateForm(form: CreateAvailabilityForm) {
  const errors: Partial<Record<keyof CreateAvailabilityForm, string>> = {};
  const label = form.label.trim();
  if (!form.menuId) errors.menuId = "Please choose a menu.";
  if (!label) errors.label = "Please enter a window name.";
  else if (label.length < 2) errors.label = "Window name needs at least 2 characters.";
  if (!form.start) errors.start = "Please choose a start time.";
  if (!form.end) errors.end = "Please choose an end time.";
  if (form.start && form.end && form.start >= form.end) {
    errors.end = "End time must be after start time.";
  }
  if (form.days.length === 0) errors.days = "Select at least one day.";
  return errors;
}

function friendlyAvailabilityCreateError(error?: string) {
  const raw = (error ?? "").toLowerCase();
  if (raw.includes("permission") || raw.includes("forbidden")) {
    return "You don't have permission to create availability windows for this venue.";
  }
  if (raw.includes("not found")) {
    return "We couldn't find that menu. Refresh the page and try again.";
  }
  return "We couldn't create the availability window right now. Please try again.";
}

function isDirty(form: CreateAvailabilityForm, defaultMenuId: string) {
  const baseline = emptyForm(defaultMenuId);
  return (
    form.label.trim() !== "" ||
    form.menuId !== defaultMenuId ||
    form.start !== baseline.start ||
    form.end !== baseline.end ||
    form.enabled !== baseline.enabled ||
    form.color !== baseline.color ||
    form.days.join(",") !== baseline.days.join(",")
  );
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

function CreateAvailabilityConfirmModal({
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
  form: CreateAvailabilityForm;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const color = resolveAvailabilityColor(form.color);

  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Create availability window?"
      description={`“${form.label.trim()}” will be added to ${menuLabel} at ${venueLabel}.`}
      titleId="create-availability-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
      panelClassName="admin-menu-create-confirm-modal"
      busy={busy}
    >
      <ProfileModalNote>
        <strong>{form.label.trim()}</strong>
        <br />
        Menu: <strong>{menuLabel}</strong>
        <br />
        Hours: <strong>{form.start} – {form.end}</strong>
        <br />
        Days: <strong>{formatAvailabilityDays(form.days)}</strong>
        <br />
        Status: <strong>{form.enabled ? "Enabled" : "Disabled"}</strong>
        <br />
        Color:{" "}
        <strong>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full border border-black/10"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {color}
          </span>
        </strong>
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Create window"
        cancelLabel="Go back"
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function CreateAvailabilityModal({
  open,
  venueName,
  token,
  restaurantId,
  menus,
  onClose,
  onCreated,
  onNavigateTab
}: Props) {
  const activeMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);
  const defaultMenuId = activeMenus[0]?.id ?? "";
  const [form, setForm] = useState<CreateAvailabilityForm>(() => emptyForm(defaultMenuId));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const menuOptions = useMemo(
    () =>
      activeMenus.map((m) => ({
        value: m.id,
        label: m.name,
        hint: m.status === "PUBLISHED" ? "Published" : "Draft"
      })),
    [activeMenus]
  );

  const selectedMenu = activeMenus.find((m) => m.id === form.menuId) ?? null;
  const selectedMenuLabel = selectedMenu?.name ?? "Menu";
  const previewColor = resolveAvailabilityColor(form.color);

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form, defaultMenuId);

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

  const patch = <K extends keyof CreateAvailabilityForm>(key: K, value: CreateAvailabilityForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day]
    }));
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

  const fieldClass = (key: keyof CreateAvailabilityForm) => {
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
      : !hasErrors && form.label.trim() && form.menuId
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
    if (!selectedMenu) return;
    const color = resolveAvailabilityColor(form.color);

    setSending(true);
    setSubmitError(null);
    const key = makeAvailabilityKey(form.label);
    const res = await saveMenuAvailabilityWindows(token, restaurantId, selectedMenu.id, selectedMenu.availabilityWindows, {
      [key]: {
        label: form.label.trim(),
        start: form.start,
        end: form.end,
        days: [...form.days].sort((a, b) => a - b),
        enabled: form.enabled,
        color
      }
    });
    setSending(false);

    if (!res.ok) {
      setSubmitError(friendlyAvailabilityCreateError(res.error));
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
        title="Create availability window"
        description="Define when a menu is visible — breakfast, lunch, weekend hours, or any custom schedule."
        titleId="create-availability-title"
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
            Schedule when guests can see a menu — with custom hours, days, and card colors
          </p>
        </div>

        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("label")}>
              <span className="admin-staff-field-label">
                Window name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                placeholder="e.g. Breakfast, Weekend brunch, Holiday hours"
                autoComplete="off"
                value={form.label}
                onChange={(e) => patch("label", e.target.value)}
                aria-invalid={(submitAttempted && Boolean(errors.label)) || undefined}
              />
              {submitAttempted && errors.label ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.label}
                </span>
              ) : null}
            </AdminLabel>

            <div className="admin-menu-availability-time-row">
              <AdminLabel className={fieldClass("start")}>
                <span className="admin-staff-field-label">
                  Start time <span className="admin-staff-field-required">*</span>
                </span>
                <AdminInput
                  type="time"
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  value={form.start}
                  onChange={(e) => patch("start", e.target.value)}
                />
                {submitAttempted && errors.start ? (
                  <span className="admin-staff-field-error" role="alert">
                    {errors.start}
                  </span>
                ) : null}
              </AdminLabel>

              <AdminLabel className={fieldClass("end")}>
                <span className="admin-staff-field-label">
                  End time <span className="admin-staff-field-required">*</span>
                </span>
                <AdminInput
                  type="time"
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  value={form.end}
                  onChange={(e) => patch("end", e.target.value)}
                />
                {submitAttempted && errors.end ? (
                  <span className="admin-staff-field-error" role="alert">
                    {errors.end}
                  </span>
                ) : null}
              </AdminLabel>
            </div>
          </div>

          <div className="admin-menu-create-form__meta">
            <div className={fieldClass("menuId")}>
              {menuOptions.length === 0 ? (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                  <p className="text-sm admin-config-text-subtle">This venue has no menus yet. Create a menu first, then add availability windows.</p>
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

            <div className={submitAttempted && errors.days ? "admin-staff-field--error" : ""}>
              <span className="admin-staff-field-label">
                Days <span className="admin-staff-field-required">*</span>
              </span>
              <div
                className="admin-menu-availability-day-grid"
                style={{ "--availability-accent": previewColor } as CSSProperties}
              >
                {AVAILABILITY_DAY_OPTIONS.map((day) => {
                  const active = form.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`admin-menu-availability-day-chip${active ? " is-active" : ""}`}
                      aria-pressed={active}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {submitAttempted && errors.days ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.days}
                </span>
              ) : null}
            </div>

            <label className="admin-menu-availability-enabled-toggle">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => patch("enabled", e.target.checked)}
              />
              <span>Enable this window right away</span>
            </label>

            <div className="admin-menu-availability-preview-row">
              <AvailabilityPreviewCard
                label={form.label}
                start={form.start}
                end={form.end}
                days={form.days}
                menuName={selectedMenuLabel}
                enabled={form.enabled}
                color={previewColor}
              />

              <AvailabilityColorPicker value={form.color} onChange={(color) => patch("color", color)} inline />
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
      </ProfileModalShell>

      <CreateAvailabilityConfirmModal
        open={confirmOpen}
        venueLabel={venueName}
        menuLabel={selectedMenuLabel}
        form={form}
        busy={sending}
        error={submitError}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleCreate()}
      />

      <ProfileModalShell
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard availability window?"
        description="Your window details will be lost if you close now."
        titleId="discard-availability-title"
        maxWidthClass="max-w-md"
        stackLevel="overlay"
        panelClassName="admin-menu-create-confirm-modal"
      >
        <ProfileModalNote>You have unsaved window details. This cannot be undone.</ProfileModalNote>
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

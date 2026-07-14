import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MenuAvailabilityWindow, MenuSurfaceRow } from "../../../api";
import { AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
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
  formatAvailabilityDays,
  removeMenuAvailabilityWindow,
  resolveAvailabilityColor,
  saveMenuAvailabilityWindows
} from "./availabilityHelpers";

export type EditAvailabilityTarget = {
  key: string;
  menuId: string;
  menuName: string;
  window: MenuAvailabilityWindow;
};

type EditAvailabilityForm = {
  menuId: string;
  label: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
  color: string;
};

function formFromTarget(target: EditAvailabilityTarget): EditAvailabilityForm {
  return {
    menuId: target.menuId,
    label: target.window.label,
    start: target.window.start,
    end: target.window.end,
    days: [...target.window.days],
    enabled: target.window.enabled,
    color: target.window.color
  };
}

function validateForm(form: EditAvailabilityForm) {
  const errors: Partial<Record<keyof EditAvailabilityForm, string>> = {};
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

type Props = {
  open: boolean;
  target: EditAvailabilityTarget | null;
  canEdit: boolean;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  onClose: () => void;
  onSaved: () => void;
};

export function EditAvailabilityModal({ open, target, canEdit, token, restaurantId, menus, onClose, onSaved }: Props) {
  const activeMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);
  const [form, setForm] = useState<EditAvailabilityForm | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !target) {
      setForm(null);
      setSubmitAttempted(false);
      setSending(false);
      setConfirmOpen(false);
      setSubmitError(null);
      return;
    }
    setForm(formFromTarget(target));
    setSubmitAttempted(false);
    setSubmitError(null);
  }, [open, target]);

  if (!form || !target) return null;

  const menuOptions = activeMenus.map((m) => ({
    value: m.id,
    label: m.name,
    hint: m.status === "PUBLISHED" ? "Published" : "Draft"
  }));

  const sourceMenu = activeMenus.find((m) => m.id === target.menuId) ?? null;
  const selectedMenu = activeMenus.find((m) => m.id === form.menuId) ?? null;
  const previewColor = resolveAvailabilityColor(form.color);

  const errors = validateForm(form);

  const patch = <K extends keyof EditAvailabilityForm>(key: K, value: EditAvailabilityForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleDay = (day: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day]
          }
        : prev
    );
  };

  const fieldClass = (key: keyof EditAvailabilityForm) => {
    const showError = submitAttempted && errors[key];
    return showError ? "admin-staff-field--error" : "";
  };

  const openConfirm = () => {
    setSubmitAttempted(true);
    if (Object.keys(validateForm(form)).length > 0) return;
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!selectedMenu || !sourceMenu) return;
    const color = resolveAvailabilityColor(form.color);

    setSending(true);
    setSubmitError(null);

    const nextWindow: MenuAvailabilityWindow = {
      label: form.label.trim(),
      start: form.start,
      end: form.end,
      days: [...form.days].sort((a, b) => a - b),
      enabled: form.enabled,
      color
    };

    let res;
    if (form.menuId === target.menuId) {
      res = await saveMenuAvailabilityWindows(token, restaurantId, target.menuId, sourceMenu.availabilityWindows, {
        [target.key]: nextWindow
      });
    } else {
      const destinationMenu = activeMenus.find((m) => m.id === form.menuId);
      if (!destinationMenu) {
        setSending(false);
        setSubmitError("We couldn't find that menu. Refresh the page and try again.");
        return;
      }

      const removeRes = await removeMenuAvailabilityWindow(
        token,
        restaurantId,
        target.menuId,
        sourceMenu.availabilityWindows,
        target.key
      );
      if (!removeRes.ok) {
        setSending(false);
        setSubmitError(removeRes.error ?? "Could not move availability window.");
        return;
      }

      res = await saveMenuAvailabilityWindows(
        token,
        restaurantId,
        destinationMenu.id,
        destinationMenu.availabilityWindows,
        { [target.key]: nextWindow }
      );
    }

    setSending(false);
    if (!res?.ok) {
      setSubmitError(res?.error ?? "Could not save availability window.");
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <>
      <ProfileModalShell
        open={open && !confirmOpen}
        onClose={sending ? () => undefined : onClose}
        title="Edit availability window"
        description={canEdit ? "Update hours, days, menu, color, or enabled state." : "You can view this window but don't have permission to edit it."}
        titleId="edit-availability-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal admin-menu-create-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        <div className="admin-staff-invite-form admin-menu-create-form">
          <div className="admin-menu-create-form__primary">
            <AdminLabel className={fieldClass("label")}>
              <span className="admin-staff-field-label">Window name</span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                value={form.label}
                disabled={!canEdit}
                onChange={(e) => patch("label", e.target.value)}
              />
              {submitAttempted && errors.label ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.label}
                </span>
              ) : null}
            </AdminLabel>

            <div className="admin-menu-availability-time-row">
              <AdminLabel className={fieldClass("start")}>
                <span className="admin-staff-field-label">Start time</span>
                <AdminInput
                  type="time"
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  value={form.start}
                  disabled={!canEdit}
                  onChange={(e) => patch("start", e.target.value)}
                />
              </AdminLabel>
              <AdminLabel className={fieldClass("end")}>
                <span className="admin-staff-field-label">End time</span>
                <AdminInput
                  type="time"
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  value={form.end}
                  disabled={!canEdit}
                  onChange={(e) => patch("end", e.target.value)}
                />
              </AdminLabel>
            </div>
          </div>

          <div className="admin-menu-create-form__meta">
            <AdminBubbleDropdown
              label="Menu"
              required
              dropInline
              value={form.menuId}
              options={menuOptions}
              onChange={(v) => canEdit && patch("menuId", v)}
            />

            <div className={submitAttempted && errors.days ? "admin-staff-field--error" : ""}>
              <span className="admin-staff-field-label">Days</span>
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
                      disabled={!canEdit}
                      className={`admin-menu-availability-day-chip${active ? " is-active" : ""}`}
                      aria-pressed={active}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="admin-menu-availability-enabled-toggle">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={!canEdit}
                onChange={(e) => patch("enabled", e.target.checked)}
              />
              <span>Window enabled</span>
            </label>

            <div className="admin-menu-availability-preview-row">
              <AvailabilityPreviewCard
                label={form.label}
                start={form.start}
                end={form.end}
                days={form.days}
                menuName={selectedMenu?.name ?? target.menuName}
                enabled={form.enabled}
                color={previewColor}
              />

              <AvailabilityColorPicker
                value={form.color}
                onChange={(color) => canEdit && patch("color", color)}
                inline
              />
            </div>
          </div>
        </div>

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={onClose} disabled={sending}>
            Cancel
          </AdminBtnSecondary>
          {canEdit ? (
            <button
              type="button"
              disabled={sending}
              onClick={openConfirm}
              className="admin-staff-invite-submit admin-menu-create-submit"
            >
              Review & save
            </button>
          ) : null}
        </div>
      </ProfileModalShell>

      <ProfileModalShell
        open={confirmOpen}
        onClose={sending ? () => undefined : () => setConfirmOpen(false)}
        title="Save availability window?"
        description={`Update “${form.label.trim()}” on ${selectedMenu?.name ?? "menu"}?`}
        titleId="edit-availability-confirm-title"
        stackLevel="overlay"
        maxWidthClass="max-w-lg"
        panelClassName="admin-menu-create-confirm-modal"
        busy={sending}
      >
        <ProfileModalNote>
          Hours: <strong>{form.start} – {form.end}</strong>
          <br />
          Days: <strong>{formatAvailabilityDays(form.days)}</strong>
          <br />
          Status: <strong>{form.enabled ? "Enabled" : "Disabled"}</strong>
        </ProfileModalNote>
        {submitError ? <ProfileModalAlert tone="error">{submitError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleSave()}
          confirmLabel="Save changes"
          cancelLabel="Go back"
          busy={sending}
        />
      </ProfileModalShell>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { MenuAvailabilityWindow, MenuSurfaceRow } from "../../../api";
import { AdminBtnSecondary } from "../../AdminUi";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  MenuPageModalShell
} from "./menuPageModalShell";
import {
  ALL_AVAILABILITY_CHANNELS,
  AvailabilityWindowFormFields,
  defaultAvailabilityWindowForm,
  type AvailabilityWindowFormValues
} from "./AvailabilityWindowFormFields";
import {
  formatAvailabilityChannels,
  formatAvailabilityDays,
  formatAvailabilityLocations,
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

function toLocalDateTimeValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formFromTarget(target: EditAvailabilityTarget): AvailabilityWindowFormValues {
  const w = target.window;
  const base = defaultAvailabilityWindowForm(target.menuId);
  return {
    ...base,
    menuId: target.menuId,
    label: w.label,
    start: w.start,
    end: w.end,
    days: [...w.days],
    enabled: w.enabled,
    color: w.color,
    scheduleKind: w.scheduleKind ?? "RECURRING",
    temporaryStartAt: toLocalDateTimeValue(w.temporaryStartAt),
    temporaryEndAt: toLocalDateTimeValue(w.temporaryEndAt),
    seasonalStartMd: w.seasonalStartMd ?? "06-01",
    seasonalEndMd: w.seasonalEndMd ?? "08-31",
    channels: w.channels?.length ? [...w.channels] : [...ALL_AVAILABILITY_CHANNELS],
    locationMode: w.locationMode === "SELECTED" ? "SELECTED" : "ALL",
    locationIds: w.locationIds ?? [],
    visibility: w.visibility ?? "CUSTOMERS",
    outOfStock: Boolean(w.outOfStock),
    requiresManagerApproval: Boolean(w.requiresManagerApproval),
    ageRestricted: Boolean(w.ageRestricted),
    minAge: String(w.minAge ?? 18)
  };
}

function validateForm(form: AvailabilityWindowFormValues) {
  const errors: Partial<Record<keyof AvailabilityWindowFormValues, string>> = {};
  const label = form.label.trim();
  if (!form.menuId) errors.menuId = "Please choose a menu.";
  if (!label) errors.label = "Please enter a window name.";
  else if (label.length < 2) errors.label = "Window name needs at least 2 characters.";
  if (!form.start) errors.start = "Please choose a start time.";
  if (!form.end) errors.end = "Please choose an end time.";
  if (form.start && form.end && form.start === form.end) {
    errors.end = "End time must differ from start time.";
  }
  if (form.days.length === 0) errors.days = "Select at least one day.";
  if (form.channels.length === 0) errors.channels = "Select at least one channel.";
  if (form.locationMode === "SELECTED" && form.locationIds.length === 0) {
    errors.locationIds = "Select at least one location, or choose all locations.";
  }
  return errors;
}

function formToWindow(form: AvailabilityWindowFormValues, previous?: MenuAvailabilityWindow): MenuAvailabilityWindow {
  const color = resolveAvailabilityColor(form.color);
  return {
    label: form.label.trim(),
    start: form.start,
    end: form.end,
    days: [...form.days].sort((a, b) => a - b),
    enabled: form.enabled,
    color,
    scheduleKind: form.scheduleKind,
    temporaryStartAt:
      form.scheduleKind === "TEMPORARY" && form.temporaryStartAt
        ? new Date(form.temporaryStartAt).toISOString()
        : null,
    temporaryEndAt:
      form.scheduleKind === "TEMPORARY" && form.temporaryEndAt
        ? new Date(form.temporaryEndAt).toISOString()
        : null,
    seasonalStartMd: form.scheduleKind === "SEASONAL" ? form.seasonalStartMd : null,
    seasonalEndMd: form.scheduleKind === "SEASONAL" ? form.seasonalEndMd : null,
    channels: form.channels,
    locationMode: form.locationMode,
    locationIds: form.locationMode === "SELECTED" ? form.locationIds : [],
    visibility: form.visibility,
    outOfStock: form.outOfStock,
    requiresManagerApproval: form.requiresManagerApproval,
    ageRestricted: form.ageRestricted,
    minAge: form.ageRestricted ? Number(form.minAge) || 18 : null,
    paused: previous?.paused ?? false,
    history: [
      ...(previous?.history ?? []).slice(-39),
      {
        at: new Date().toISOString(),
        action: "updated",
        detail: "Updated from admin availability form"
      }
    ]
  };
}

type Props = {
  open: boolean;
  target: EditAvailabilityTarget | null;
  canEdit: boolean;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  locations?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
};

export function EditAvailabilityModal({
  open,
  target,
  canEdit,
  token,
  restaurantId,
  menus,
  locations = [],
  onClose,
  onSaved
}: Props) {
  const activeMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);
  const [form, setForm] = useState<AvailabilityWindowFormValues | null>(null);
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
  const errors = validateForm(form);
  const windowPreview = formToWindow(form, target.window);

  const patch = <K extends keyof AvailabilityWindowFormValues>(
    key: K,
    value: AvailabilityWindowFormValues[K]
  ) => {
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

  const openConfirm = () => {
    setSubmitAttempted(true);
    if (Object.keys(validateForm(form)).length > 0) return;
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const handleSave = async () => {
    if (!selectedMenu || !sourceMenu) return;
    const nextWindow = formToWindow(form, target.window);

    setSending(true);
    setSubmitError(null);

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
      <MenuPageModalShell
        open={open && !confirmOpen}
        onClose={sending ? () => undefined : onClose}
        title="Edit availability window"
        description={
          canEdit
            ? "Update the full rule set — schedule, channels, locations, visibility, stock, and business rules."
            : "You can view this window but don't have permission to edit it."
        }
        titleId="edit-availability-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal admin-menu-create-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        <AvailabilityWindowFormFields
          form={form}
          onPatch={patch}
          onToggleDay={toggleDay}
          menuOptions={menuOptions}
          selectedMenuLabel={selectedMenu?.name ?? target.menuName}
          locations={locations}
          disabled={!canEdit}
          submitAttempted={submitAttempted}
          errors={errors}
        />

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
      </MenuPageModalShell>

      <MenuPageModalShell
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
          Schedule: <strong>{form.scheduleKind.toLowerCase()}</strong> · {form.start} – {form.end}
          <br />
          Days: <strong>{formatAvailabilityDays(form.days)}</strong>
          <br />
          Channels: <strong>{formatAvailabilityChannels(form.channels)}</strong>
          <br />
          Locations: <strong>{formatAvailabilityLocations(windowPreview)}</strong>
          <br />
          Visibility: <strong>{form.visibility}</strong>
          <br />
          Status: <strong>{form.enabled ? "Enabled" : "Disabled"}</strong>
          {form.outOfStock ? (
            <>
              <br />
              Stock: <strong>Out of stock</strong>
            </>
          ) : null}
        </ProfileModalNote>
        {submitError ? <ProfileModalAlert tone="error">{submitError}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void handleSave()}
          confirmLabel="Save changes"
          cancelLabel="Go back"
          busy={sending}
        />
      </MenuPageModalShell>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { MenuAvailabilityWindow, MenuSurfaceRow } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import type { MenuSectionTab } from "../configRouting";
import {
  ProfileModalAlert,
  ProfileModalFooter,
  ProfileModalNote,
  MenuPageModalShell
} from "./menuPageModalShell";
import {
  AvailabilityWindowFormFields,
  defaultAvailabilityWindowForm,
  type AvailabilityWindowFormValues
} from "./AvailabilityWindowFormFields";
import {
  formatAvailabilityChannels,
  formatAvailabilityDays,
  formatAvailabilityLocations,
  makeAvailabilityKey,
  resolveAvailabilityColor,
  saveMenuAvailabilityWindows
} from "./availabilityHelpers";

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
  if (form.scheduleKind === "SEASONAL") {
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(form.seasonalStartMd)) {
      errors.seasonalStartMd = "Use MM-DD format.";
    }
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(form.seasonalEndMd)) {
      errors.seasonalEndMd = "Use MM-DD format.";
    }
  }
  return errors;
}

function formToWindow(form: AvailabilityWindowFormValues): MenuAvailabilityWindow {
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
    paused: false,
    history: [
      {
        at: new Date().toISOString(),
        action: "created",
        detail: "Created from admin availability form"
      }
    ]
  };
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

function isDirty(form: AvailabilityWindowFormValues, defaultMenuId: string) {
  const baseline = defaultAvailabilityWindowForm(defaultMenuId);
  return JSON.stringify({ ...form, menuId: form.menuId || defaultMenuId }) !== JSON.stringify(baseline);
}

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  locations?: Array<{ id: string; name: string }>;
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
  form: AvailabilityWindowFormValues;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const color = resolveAvailabilityColor(form.color);
  const windowPreview = formToWindow(form);

  return (
    <MenuPageModalShell
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
        Stock: <strong>{form.outOfStock ? "Out of stock" : "In stock"}</strong>
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
    </MenuPageModalShell>
  );
}

export function CreateAvailabilityModal({
  open,
  venueName,
  token,
  restaurantId,
  menus,
  locations = [],
  onClose,
  onCreated,
  onNavigateTab
}: Props) {
  const activeMenus = useMemo(() => menus.filter((m) => m.status !== "ARCHIVED"), [menus]);
  const defaultMenuId = activeMenus[0]?.id ?? "";
  const [form, setForm] = useState<AvailabilityWindowFormValues>(() => defaultAvailabilityWindowForm(defaultMenuId));
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

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isDirty(form, defaultMenuId);

  useEffect(() => {
    if (!open) {
      setForm(defaultAvailabilityWindowForm(defaultMenuId));
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

  const patch = <K extends keyof AvailabilityWindowFormValues>(key: K, value: AvailabilityWindowFormValues[K]) => {
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
    setForm(defaultAvailabilityWindowForm(defaultMenuId));
    setSubmitAttempted(false);
    onClose();
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

    setSending(true);
    setSubmitError(null);
    const key = makeAvailabilityKey(form.label);
    const res = await saveMenuAvailabilityWindows(
      token,
      restaurantId,
      selectedMenu.id,
      selectedMenu.availabilityWindows,
      {
        [key]: formToWindow(form)
      }
    );
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
      <MenuPageModalShell
        open={open && !confirmOpen}
        onClose={attemptClose}
        title="Create availability window"
        description="Define a full rule set — schedule, channels, locations, visibility, stock, and business rules. Backend remains the SSOT."
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
            Build an orderability window guests and staff will understand — reasons, not just an on/off switch
          </p>
        </div>

        <AvailabilityWindowFormFields
          form={form}
          onPatch={patch}
          onToggleDay={toggleDay}
          menuOptions={menuOptions}
          selectedMenuLabel={selectedMenuLabel}
          locations={locations}
          submitAttempted={submitAttempted}
          errors={errors}
          emptyMenusSlot={
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
              <p className="text-sm admin-config-text-subtle">
                This venue has no menus yet. Create a menu first, then add availability windows.
              </p>
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
          }
        />

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
      </MenuPageModalShell>

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

      <MenuPageModalShell
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
      </MenuPageModalShell>
    </>
  );
}

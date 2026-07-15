import { useState, type ReactNode } from "react";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel, AdminSelect } from "../AdminUi";
import { useModalScrollLock } from "../../lib/modalScrollLock";
import { ProfileModalShell, ProfileModalFooter } from "../profile/ProfileModalShell";
import type { SpecialSchedule } from "./venueProfileModel";

export function CreateLocationModal({
  open,
  busy,
  onClose,
  onConfirm
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (name: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      busy={busy}
      title="Create location"
      description="Add another venue under your workspace company. Only owners can create locations."
      titleId="venue-create-location-title"
      maxWidthClass="max-w-lg"
    >
      <AdminLabel>
        <span className="admin-venue-field-label">Location name</span>
        <AdminInput className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Downtown branch" />
      </AdminLabel>
      {error ? (
        <p className="mt-3 text-sm font-semibold text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <ProfileModalFooter
        busy={busy}
        onCancel={onClose}
        confirmLabel="Create location"
        confirmDisabled={!name.trim()}
        onConfirm={() => {
          setError(null);
          void onConfirm(name.trim()).then((res) => {
            if (!res.ok) {
              setError(res.error ?? "Could not create location");
              return;
            }
            setName("");
            onClose();
          });
        }}
      />
    </ProfileModalShell>
  );
}

export function SpecialHoursModal({
  open,
  onClose,
  onSave,
  initial
}: {
  open: boolean;
  onClose: () => void;
  onSave: (row: SpecialSchedule) => void;
  initial?: SpecialSchedule | null;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [kind, setKind] = useState<SpecialSchedule["kind"]>(initial?.kind ?? "holiday");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title={initial ? "Edit special hours" : "Add special hours"}
      description="Holidays, temporary closures, vacation, or special events."
      titleId="venue-special-hours-title"
      maxWidthClass="max-w-lg"
    >
      <div className="grid gap-4">
        <AdminLabel>
          <span className="admin-venue-field-label">Label</span>
          <AdminInput className="mt-1.5" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Christmas Eve" />
        </AdminLabel>
        <AdminLabel>
          <span className="admin-venue-field-label">Type</span>
          <AdminSelect className="mt-1.5" value={kind} onChange={(e) => setKind(e.target.value as SpecialSchedule["kind"])}>
            <option value="holiday">Holiday</option>
            <option value="closure">Temporary closure</option>
            <option value="vacation">Vacation</option>
            <option value="event">Special event</option>
          </AdminSelect>
        </AdminLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminLabel>
            <span className="admin-venue-field-label">Start date</span>
            <AdminInput className="mt-1.5" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </AdminLabel>
          <AdminLabel>
            <span className="admin-venue-field-label">End date</span>
            <AdminInput className="mt-1.5" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </AdminLabel>
        </div>
        <AdminLabel>
          <span className="admin-venue-field-label">Note</span>
          <AdminInput className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details for staff" />
        </AdminLabel>
      </div>
      <ProfileModalFooter
        onCancel={onClose}
        confirmLabel="Save"
        confirmDisabled={!label.trim() || !startDate}
        onConfirm={() => {
          onSave({
            id: initial?.id ?? `sp-${Date.now()}`,
            label: label.trim(),
            kind,
            startDate,
            endDate: endDate || startDate,
            note: note.trim()
          });
          onClose();
        }}
      />
    </ProfileModalShell>
  );
}

export function ConfirmVenueActionModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  busy,
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <ProfileModalShell open={open} onClose={onClose} busy={busy} title={title} description={description} titleId="venue-confirm-action" maxWidthClass="max-w-md">
      <ProfileModalFooter
        busy={busy}
        danger={danger}
        onCancel={onClose}
        confirmLabel={confirmLabel}
        onConfirm={() => void onConfirm()}
      />
    </ProfileModalShell>
  );
}

export function VenueProfileSheet({
  open,
  title,
  description,
  onClose,
  children,
  footer
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: React.ReactNode;
}) {
  useModalScrollLock(open);

  if (!open) return null;
  return (
    <>
      <button type="button" className="admin-venue-sheet-backdrop" aria-label="Close panel" onClick={onClose} />
      <aside className="admin-venue-sheet" role="dialog" aria-modal="true" aria-labelledby="venue-sheet-title">
        <div className="admin-venue-sheet-head">
          <div>
            <h2 id="venue-sheet-title" className="admin-venue-sheet-title">
              {title}
            </h2>
            {description ? <p className="admin-venue-sheet-desc">{description}</p> : null}
          </div>
          <AdminBtnSecondary type="button" onClick={onClose}>
            Close
          </AdminBtnSecondary>
        </div>
        <div className="admin-venue-sheet-body">{children}</div>
        {footer ? <div className="admin-venue-sheet-foot">{footer}</div> : null}
      </aside>
    </>
  );
}

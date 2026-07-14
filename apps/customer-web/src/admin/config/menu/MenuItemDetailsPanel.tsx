import { useState } from "react";
import { AdminBtnPrimary, AdminInput, AdminLabel } from "../../AdminUi";
import { inputBase } from "../../AdminUi";

type DetailsValue = {
  description: string;
  ingredients: string;
  specialNotes: string;
};

type Props = {
  value: DetailsValue;
  onChange: (next: DetailsValue) => void;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  canSave?: boolean;
  defaultOpen?: boolean;
};

export function MenuItemDetailsPanel({
  value,
  onChange,
  onSave,
  saveLabel = "Save details",
  saving = false,
  canSave = true,
  defaultOpen = false
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`admin-menu-details-panel mt-4 rounded-2xl border border-violet-200/60 bg-violet-50/30 p-4 dark:border-violet-500/20 dark:bg-violet-950/20${open ? " admin-menu-details-panel--open" : ""}`}
    >
      <button
        type="button"
        className="admin-menu-details-panel__toggle flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-bold admin-config-text">Add description &amp; ingredients</span>
          <span className="mt-1 block text-xs admin-config-text-subtle">
            Optional guest-facing copy — description, ingredient list, and special notes (allergens, prep, etc.).
          </span>
        </span>
        <span className="admin-menu-details-panel__chevron shrink-0 text-lg font-bold text-violet-600/80" aria-hidden>
          +
        </span>
      </button>

      <div className="admin-menu-details-panel__body">
        <div className="admin-menu-details-panel__body-inner">
          <div className="admin-menu-details-panel__fields space-y-4 border-t border-violet-200/50 pt-4 dark:border-violet-500/15">
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Description</span>
              <textarea
                className={`${inputBase} mt-1 min-h-[88px] resize-y`}
                placeholder="What guests see under the dish name — flavors, portion, story…"
                value={value.description}
                onChange={(e) => onChange({ ...value, description: e.target.value })}
              />
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Ingredients</span>
              <textarea
                className={`${inputBase} mt-1 min-h-[72px] resize-y`}
                placeholder="e.g. Beef patty, cheddar, brioche bun, pickles, house sauce"
                value={value.ingredients}
                onChange={(e) => onChange({ ...value, ingredients: e.target.value })}
              />
            </AdminLabel>
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Special notes</span>
              <AdminInput
                className="mt-1"
                placeholder="e.g. Contains gluten · May contain nuts"
                value={value.specialNotes}
                onChange={(e) => onChange({ ...value, specialNotes: e.target.value })}
              />
            </AdminLabel>
            {onSave ? (
              <div className="flex justify-end">
                <AdminBtnPrimary disabled={saving || !canSave} onClick={onSave}>
                  {saving ? "Saving…" : saveLabel}
                </AdminBtnPrimary>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function emptyMenuItemDetails(): DetailsValue {
  return { description: "", ingredients: "", specialNotes: "" };
}

export function detailsFromItem(item: {
  description?: string | null;
  ingredients?: string | null;
  specialNotes?: string | null;
}): DetailsValue {
  return {
    description: item.description?.trim() ?? "",
    ingredients: item.ingredients?.trim() ?? "",
    specialNotes: item.specialNotes?.trim() ?? ""
  };
}

export function detailsPayload(value: DetailsValue) {
  const trim = (s: string) => s.trim();
  return {
    description: trim(value.description) || undefined,
    ingredients: trim(value.ingredients) || undefined,
    specialNotes: trim(value.specialNotes) || undefined
  };
}

export function detailsPatchPayload(value: DetailsValue) {
  const trim = (s: string) => s.trim();
  return {
    description: trim(value.description) || null,
    ingredients: trim(value.ingredients) || null,
    specialNotes: trim(value.specialNotes) || null
  };
}

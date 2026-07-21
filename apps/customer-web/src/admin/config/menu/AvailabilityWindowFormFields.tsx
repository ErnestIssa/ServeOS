import type { CSSProperties, ReactNode } from "react";
import type {
  AvailabilityChannel,
  AvailabilityScheduleKind,
  AvailabilityVisibility
} from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { AdminBubbleDropdown } from "../../AdminBubbleDropdown";
import { AvailabilityColorPicker } from "./AvailabilityColorPicker";
import { AvailabilityPreviewCard } from "./AvailabilityPreviewCard";
import {
  AVAILABILITY_DAY_OPTIONS,
  CHANNEL_LABELS,
  DEFAULT_AVAILABILITY_COLOR,
  resolveAvailabilityColor
} from "./availabilityHelpers";

export const ALL_AVAILABILITY_CHANNELS: AvailabilityChannel[] = [
  "DINE_IN",
  "TAKEAWAY",
  "DELIVERY",
  "QR",
  "KIOSK",
  "STAFF"
];

export type AvailabilityWindowFormValues = {
  menuId: string;
  label: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
  color: string;
  scheduleKind: AvailabilityScheduleKind;
  temporaryStartAt: string;
  temporaryEndAt: string;
  seasonalStartMd: string;
  seasonalEndMd: string;
  channels: AvailabilityChannel[];
  locationMode: "ALL" | "SELECTED";
  locationIds: string[];
  visibility: AvailabilityVisibility;
  outOfStock: boolean;
  requiresManagerApproval: boolean;
  ageRestricted: boolean;
  minAge: string;
};

export function defaultAvailabilityWindowForm(menuId: string): AvailabilityWindowFormValues {
  return {
    menuId,
    label: "",
    start: "09:00",
    end: "17:00",
    days: [1, 2, 3, 4, 5],
    enabled: true,
    color: DEFAULT_AVAILABILITY_COLOR,
    scheduleKind: "RECURRING",
    temporaryStartAt: "",
    temporaryEndAt: "",
    seasonalStartMd: "06-01",
    seasonalEndMd: "08-31",
    channels: [...ALL_AVAILABILITY_CHANNELS],
    locationMode: "ALL",
    locationIds: [],
    visibility: "CUSTOMERS",
    outOfStock: false,
    requiresManagerApproval: false,
    ageRestricted: false,
    minAge: "18"
  };
}

type Props = {
  form: AvailabilityWindowFormValues;
  onPatch: <K extends keyof AvailabilityWindowFormValues>(key: K, value: AvailabilityWindowFormValues[K]) => void;
  onToggleDay: (day: number) => void;
  menuOptions: Array<{ value: string; label: string; hint?: string }>;
  selectedMenuLabel: string;
  locations: Array<{ id: string; name: string }>;
  disabled?: boolean;
  submitAttempted?: boolean;
  errors?: Partial<Record<keyof AvailabilityWindowFormValues, string>>;
  emptyMenusSlot?: ReactNode;
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="admin-avail-form-section">
      <div className="admin-avail-form-section__head">
        <h4 className="admin-avail-form-section__title">{title}</h4>
        {hint ? <p className="admin-avail-form-section__hint">{hint}</p> : null}
      </div>
      <div className="admin-avail-form-section__body">{children}</div>
    </section>
  );
}

export function AvailabilityWindowFormFields({
  form,
  onPatch,
  onToggleDay,
  menuOptions,
  selectedMenuLabel,
  locations,
  disabled = false,
  submitAttempted = false,
  errors = {},
  emptyMenusSlot
}: Props) {
  const previewColor = resolveAvailabilityColor(form.color);

  const fieldClass = (key: keyof AvailabilityWindowFormValues) => {
    const showError = submitAttempted && errors[key];
    return showError ? "admin-staff-field--error" : "";
  };

  const setDayPreset = (days: number[]) => {
    onPatch("days", days);
  };

  const toggleChannel = (ch: AvailabilityChannel) => {
    const on = form.channels.includes(ch);
    onPatch(
      "channels",
      on ? form.channels.filter((c) => c !== ch) : [...form.channels, ch]
    );
  };

  const toggleLocation = (id: string) => {
    const on = form.locationIds.includes(id);
    onPatch(
      "locationIds",
      on ? form.locationIds.filter((x) => x !== id) : [...form.locationIds, id]
    );
  };

  return (
    <div className="admin-staff-invite-form admin-menu-create-form admin-avail-create-form">
      <div className="admin-menu-create-form__primary">
        <AdminLabel className={fieldClass("label")}>
          <span className="admin-staff-field-label">
            Window name <span className="admin-staff-field-required">*</span>
          </span>
          <AdminInput
            className="admin-staff-premium-input admin-menu-create-field-input"
            placeholder="e.g. Breakfast, Lunch, Christmas menu, Happy Hour"
            autoComplete="off"
            value={form.label}
            disabled={disabled}
            onChange={(e) => onPatch("label", e.target.value)}
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
              disabled={disabled}
              onChange={(e) => onPatch("start", e.target.value)}
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
              disabled={disabled}
              onChange={(e) => onPatch("end", e.target.value)}
            />
            {submitAttempted && errors.end ? (
              <span className="admin-staff-field-error" role="alert">
                {errors.end}
              </span>
            ) : null}
          </AdminLabel>
        </div>
        <p className="admin-avail-form-note">Overnight windows are allowed (e.g. 22:00–02:00).</p>
      </div>

      <div className="admin-menu-create-form__meta">
        <div className={fieldClass("menuId")}>
          {menuOptions.length === 0 ? (
            emptyMenusSlot
          ) : (
            <>
              <AdminBubbleDropdown
                label="Menu"
                required
                dropInline
                value={form.menuId}
                options={menuOptions}
                onChange={(v) => !disabled && onPatch("menuId", v)}
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
          <div className="admin-avail-preset-row" style={{ marginTop: "0.35rem" }}>
            <button type="button" className="admin-avail-preset" disabled={disabled} onClick={() => setDayPreset([1, 2, 3, 4, 5])}>
              Every weekday
            </button>
            <button type="button" className="admin-avail-preset" disabled={disabled} onClick={() => setDayPreset([0, 6])}>
              Weekends only
            </button>
            <button
              type="button"
              className="admin-avail-preset"
              disabled={disabled}
              onClick={() => setDayPreset([0, 1, 2, 3, 4, 5, 6])}
            >
              Every day
            </button>
            <button
              type="button"
              className="admin-avail-preset"
              disabled={disabled}
              onClick={() => {
                onPatch("start", "11:00");
                onPatch("end", "15:00");
                setDayPreset([1, 2, 3, 4, 5]);
              }}
            >
              Lunch hours
            </button>
          </div>
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
                  disabled={disabled}
                  className={`admin-menu-availability-day-chip${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => onToggleDay(day.value)}
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

        <Section title="Scheduling" hint="Recurring weekly, temporary dates, or seasonal menus.">
          <div className="admin-avail-check-grid">
            {(
              [
                ["RECURRING", "Recurring schedule"],
                ["TEMPORARY", "Temporary availability"],
                ["SEASONAL", "Seasonal availability"]
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={`admin-avail-check${form.scheduleKind === value ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="avail-schedule-kind"
                  checked={form.scheduleKind === value}
                  disabled={disabled}
                  onChange={() => onPatch("scheduleKind", value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          {form.scheduleKind === "TEMPORARY" ? (
            <div className="admin-menu-availability-time-row mt-3">
              <AdminLabel>
                <span className="admin-staff-field-label">Starts</span>
                <AdminInput
                  type="datetime-local"
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  value={form.temporaryStartAt}
                  disabled={disabled}
                  onChange={(e) => onPatch("temporaryStartAt", e.target.value)}
                />
              </AdminLabel>
              <AdminLabel>
                <span className="admin-staff-field-label">Ends</span>
                <AdminInput
                  type="datetime-local"
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  value={form.temporaryEndAt}
                  disabled={disabled}
                  onChange={(e) => onPatch("temporaryEndAt", e.target.value)}
                />
              </AdminLabel>
            </div>
          ) : null}
          {form.scheduleKind === "SEASONAL" ? (
            <div className="admin-menu-availability-time-row mt-3">
              <AdminLabel>
                <span className="admin-staff-field-label">Season start (MM-DD)</span>
                <AdminInput
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  placeholder="12-20"
                  value={form.seasonalStartMd}
                  disabled={disabled}
                  onChange={(e) => onPatch("seasonalStartMd", e.target.value)}
                />
              </AdminLabel>
              <AdminLabel>
                <span className="admin-staff-field-label">Season end (MM-DD)</span>
                <AdminInput
                  className="admin-staff-premium-input admin-menu-create-field-input"
                  placeholder="01-05"
                  value={form.seasonalEndMd}
                  disabled={disabled}
                  onChange={(e) => onPatch("seasonalEndMd", e.target.value)}
                />
              </AdminLabel>
            </div>
          ) : null}
        </Section>

        <Section
          title="Restaurant operations"
          hint="Restrict which ordering channels can use this window."
        >
          <div className="admin-avail-check-grid">
            {ALL_AVAILABILITY_CHANNELS.map((ch) => {
              const on = form.channels.includes(ch);
              return (
                <label key={ch} className={`admin-avail-check${on ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={() => toggleChannel(ch)}
                  />
                  <span>{CHANNEL_LABELS[ch]}</span>
                </label>
              );
            })}
          </div>
          {submitAttempted && errors.channels ? (
            <span className="admin-staff-field-error" role="alert">
              {errors.channels}
            </span>
          ) : null}
        </Section>

        <Section title="Location" hint="Multi-location restaurants can limit where this window applies.">
          <div className="admin-avail-check-grid">
            <label className={`admin-avail-check${form.locationMode === "ALL" ? " is-on" : ""}`}>
              <input
                type="radio"
                name="avail-location-mode"
                checked={form.locationMode === "ALL"}
                disabled={disabled}
                onChange={() => onPatch("locationMode", "ALL")}
              />
              <span>Available at all locations</span>
            </label>
            <label className={`admin-avail-check${form.locationMode === "SELECTED" ? " is-on" : ""}`}>
              <input
                type="radio"
                name="avail-location-mode"
                checked={form.locationMode === "SELECTED"}
                disabled={disabled}
                onChange={() => onPatch("locationMode", "SELECTED")}
              />
              <span>Selected locations only</span>
            </label>
          </div>
          {form.locationMode === "SELECTED" ? (
            <div className="admin-avail-check-grid mt-2">
              {locations.length === 0 ? (
                <p className="admin-avail-form-note">No peer locations found — defaults to this venue when saved.</p>
              ) : (
                locations.map((loc) => {
                  const on = form.locationIds.includes(loc.id);
                  return (
                    <label key={loc.id} className={`admin-avail-check${on ? " is-on" : ""}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggleLocation(loc.id)}
                      />
                      <span>{loc.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}
          {submitAttempted && errors.locationIds ? (
            <span className="admin-staff-field-error" role="alert">
              {errors.locationIds}
            </span>
          ) : null}
        </Section>

        <Section title="Customer visibility" hint="Different from availability — who can see this window.">
          <div className="admin-avail-check-grid">
            {(
              [
                ["CUSTOMERS", "Show to customers"],
                ["HIDDEN", "Hide from customers"],
                ["STAFF_ONLY", "Staff only"],
                ["TESTING", "Internal testing"]
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={`admin-avail-check${form.visibility === value ? " is-on" : ""}`}>
                <input
                  type="radio"
                  name="avail-visibility"
                  checked={form.visibility === value}
                  disabled={disabled}
                  onChange={() => onPatch("visibility", value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section
          title="Inventory"
          hint="Out of stock ≠ unavailable. Unavailable hides intentionally; out of stock means it should sell when restocked."
        >
          <label className={`admin-avail-check${form.outOfStock ? " is-on" : ""}`}>
            <input
              type="checkbox"
              checked={form.outOfStock}
              disabled={disabled}
              onChange={(e) => onPatch("outOfStock", e.target.checked)}
            />
            <span>Mark out of stock</span>
          </label>
        </Section>

        <Section title="Business rules">
          <label className={`admin-avail-check${form.requiresManagerApproval ? " is-on" : ""}`}>
            <input
              type="checkbox"
              checked={form.requiresManagerApproval}
              disabled={disabled}
              onChange={(e) => onPatch("requiresManagerApproval", e.target.checked)}
            />
            <span>Requires manager approval</span>
          </label>
          <label className={`admin-avail-check mt-2${form.ageRestricted ? " is-on" : ""}`}>
            <input
              type="checkbox"
              checked={form.ageRestricted}
              disabled={disabled}
              onChange={(e) => onPatch("ageRestricted", e.target.checked)}
            />
            <span>Age restricted</span>
          </label>
          {form.ageRestricted ? (
            <AdminLabel className="mt-2">
              <span className="admin-staff-field-label">Minimum age</span>
              <AdminInput
                className="admin-staff-premium-input admin-menu-create-field-input"
                value={form.minAge}
                disabled={disabled}
                onChange={(e) => onPatch("minAge", e.target.value)}
              />
            </AdminLabel>
          ) : null}
        </Section>

        <label className="admin-menu-availability-enabled-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            disabled={disabled}
            onChange={(e) => onPatch("enabled", e.target.checked)}
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
            scheduleKind={form.scheduleKind}
            channels={form.channels}
            visibility={form.visibility}
            outOfStock={form.outOfStock}
            locationMode={form.locationMode}
          />
          <AvailabilityColorPicker
            value={form.color}
            onChange={(color) => !disabled && onPatch("color", color)}
            inline
          />
        </div>
      </div>
    </div>
  );
}

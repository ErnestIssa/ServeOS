import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BubbleDropdownOption } from "../../AdminBubbleDropdown";

function EditPencilIcon() {
  return (
    <svg className="admin-qr-hover-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

type CommonProps = {
  label: string;
  disabled?: boolean;
};

type TextProps = CommonProps & {
  value: string;
  displayValue?: string;
  placeholder?: string;
  type?: "text" | "number";
  /** Called when the user finishes editing — parent should keep as draft until Save. */
  onCommit: (next: string) => void;
};

export function QrHoverEditText({
  label,
  value,
  displayValue,
  placeholder,
  type = "text",
  disabled,
  onCommit
}: TextProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const shown = (displayValue ?? value).trim() || "—";

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next === value.trim()) return;
    onCommit(next);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing && !disabled) {
    return (
      <div className="admin-qr-hover-edit is-editable is-editing">
        <label className="admin-qr-hover-edit-label" htmlFor={id}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={id}
          type={type}
          className="admin-qr-hover-edit-input"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          min={type === "number" ? 1 : undefined}
          step={type === "number" ? 1 : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={`admin-qr-hover-edit is-editable${disabled ? " is-disabled" : ""}`}>
      <span className="admin-qr-hover-edit-label">{label}</span>
      <button
        type="button"
        className="admin-qr-hover-edit-display"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setEditing(true);
        }}
        aria-label={`Edit ${label}`}
      >
        <span className="admin-qr-hover-edit-value">{shown}</span>
        {!disabled ? <EditPencilIcon /> : null}
      </button>
    </div>
  );
}

type SuggestTextProps = CommonProps & {
  value: string;
  displayValue?: string;
  placeholder?: string;
  /** Recently used / available values — optional picks; free text always allowed. */
  suggestions?: string[];
  suggestionsTitle?: string;
  onCommit: (next: string) => void;
};

/** Free-text field with optional recent/available suggestions while editing. */
export function QrHoverEditSuggestText({
  label,
  value,
  displayValue,
  placeholder,
  suggestions = [],
  suggestionsTitle = "Recently used",
  disabled,
  onCommit
}: SuggestTextProps) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const suppressBlurCommit = useRef(false);

  const suggestionList = useMemo(() => {
    const set = new Set<string>();
    for (const s of suggestions) {
      const t = s.trim();
      if (t) set.add(t);
    }
    const q = draft.trim().toLowerCase();
    const all = [...set].sort((a, b) => a.localeCompare(b));
    if (!q) return all;
    return all.filter((s) => s.toLowerCase().includes(q));
  }, [suggestions, draft]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useLayoutEffect(() => {
    if (!editing || !wrapRef.current || suggestionList.length === 0) {
      setCoords(null);
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 200);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
    let top = rect.bottom + 6;
    const estHeight = Math.min(240, 52 + suggestionList.length * 38);
    if (top + estHeight > window.innerHeight - 12 && rect.top > estHeight + 12) {
      top = rect.top - estHeight - 6;
    }
    setCoords({ top, left, width });
  }, [editing, suggestionList.length, draft]);

  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      commit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft, value]);

  const shown = (displayValue ?? value).trim() || "—";

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    setCoords(null);
    if (next === value.trim()) return;
    onCommit(next);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
    setCoords(null);
  };

  if (editing && !disabled) {
    return (
      <div ref={wrapRef} className="admin-qr-hover-edit is-editable is-editing is-suggest">
        <label className="admin-qr-hover-edit-label" htmlFor={id}>
          {label}
        </label>
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="admin-qr-hover-edit-input"
          value={draft}
          placeholder={placeholder ?? "Type any value"}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (suppressBlurCommit.current) {
              suppressBlurCommit.current = false;
              return;
            }
            // Delay so suggestion mousedown can fire first
            window.setTimeout(() => {
              if (suppressBlurCommit.current) {
                suppressBlurCommit.current = false;
                return;
              }
              commit();
            }, 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
        />
        {coords && suggestionList.length > 0
          ? createPortal(
              <div
                ref={panelRef}
                className="admin-staff-actions-portal admin-qr-pick-portal"
                style={{ top: coords.top, left: coords.left, width: coords.width, right: "auto" }}
                role="presentation"
                onMouseDown={() => {
                  suppressBlurCommit.current = true;
                }}
              >
                <div
                  className="admin-top-bubble admin-top-bubble--arrow-end admin-staff-actions-bubble admin-menu-item-actions-bubble"
                  role="listbox"
                  aria-label={suggestionsTitle}
                >
                  <div className="admin-bubble-header">
                    <p className="admin-bubble-title">{suggestionsTitle}</p>
                  </div>
                  <div className="admin-bubble-body admin-bubble-body--menu">
                    {suggestionList.map((opt) => {
                      const active = opt === draft.trim();
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`admin-bubble-menu-item w-full text-left${active ? " is-selected" : ""}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            suppressBlurCommit.current = true;
                            setDraft(opt);
                            setEditing(false);
                            setCoords(null);
                            if (opt !== value.trim()) onCommit(opt);
                          }}
                        >
                          <span className="admin-bubble-item-title">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    );
  }

  return (
    <div className={`admin-qr-hover-edit is-editable${disabled ? " is-disabled" : ""}`}>
      <span className="admin-qr-hover-edit-label">{label}</span>
      <button
        type="button"
        className="admin-qr-hover-edit-display"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setEditing(true);
        }}
        aria-label={`Edit ${label}`}
      >
        <span className="admin-qr-hover-edit-value">{shown}</span>
        {!disabled ? <EditPencilIcon /> : null}
      </button>
    </div>
  );
}

const TTL_HOUR_OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12, 24, 48];
const TTL_MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30, 45];
const TTL_PRESETS: Array<{ label: string; hours: number; minutes: number }> = [
  { label: "15m", hours: 0, minutes: 15 },
  { label: "30m", hours: 0, minutes: 30 },
  { label: "1h", hours: 1, minutes: 0 },
  { label: "2h", hours: 2, minutes: 0 },
  { label: "4h", hours: 4, minutes: 0 }
];

export function hoursToTtlParts(hours: number | null | undefined): { hours: number; minutes: number } {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return { hours: 0, minutes: 0 };
  const totalMin = Math.round(hours * 60);
  return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
}

export function ttlPartsToHours(hours: number, minutes: number): number | null {
  const h = Math.max(0, Math.floor(hours));
  const m = Math.min(59, Math.max(0, Math.floor(minutes)));
  const total = h * 60 + m;
  if (total <= 0) return null;
  return total / 60;
}

export function formatSessionTtlDisplay(hoursValue: string): string {
  const trimmed = hoursValue.trim();
  if (!trimmed) return "Venue default";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return "Venue default";
  const { hours, minutes } = hoursToTtlParts(n);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

type DurationProps = CommonProps & {
  /** Stored as decimal hours string ("" = platform default). */
  value: string;
  onCommit: (nextHoursDecimal: string) => void;
};

/** Session TTL — hours + minutes via fill and/or quick selection. */
export function QrHoverEditDuration({ label, value, disabled, onCommit }: DurationProps) {
  const hoursId = useId();
  const minutesId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const initial = hoursToTtlParts(value.trim() ? Number(value) : null);
  const [hoursDraft, setHoursDraft] = useState(String(initial.hours));
  const [minutesDraft, setMinutesDraft] = useState(String(initial.minutes));

  useEffect(() => {
    if (editing) return;
    const parts = hoursToTtlParts(value.trim() ? Number(value) : null);
    setHoursDraft(String(parts.hours));
    setMinutesDraft(String(parts.minutes));
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      commit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, hoursDraft, minutesDraft, value]);

  const shown = formatSessionTtlDisplay(value);

  const commit = () => {
    const h = Number(hoursDraft);
    const m = Number(minutesDraft);
    const safeH = Number.isFinite(h) ? Math.max(0, Math.min(168, Math.floor(h))) : 0;
    const safeM = Number.isFinite(m) ? Math.max(0, Math.min(59, Math.floor(m))) : 0;
    const nextHours = ttlPartsToHours(safeH, safeM);
    const nextStr = nextHours == null ? "" : String(nextHours);
    setEditing(false);
    if (nextStr === value.trim()) return;
    onCommit(nextStr);
  };

  const cancel = () => {
    const parts = hoursToTtlParts(value.trim() ? Number(value) : null);
    setHoursDraft(String(parts.hours));
    setMinutesDraft(String(parts.minutes));
    setEditing(false);
  };

  const applyPreset = (hours: number, minutes: number) => {
    setHoursDraft(String(hours));
    setMinutesDraft(String(minutes));
    const nextHours = ttlPartsToHours(hours, minutes);
    const nextStr = nextHours == null ? "" : String(nextHours);
    setEditing(false);
    if (nextStr !== value.trim()) onCommit(nextStr);
  };

  if (editing && !disabled) {
    return (
      <div ref={wrapRef} className="admin-qr-hover-edit is-editable is-editing is-duration">
        <span className="admin-qr-hover-edit-label">{label}</span>
        <div className="admin-qr-ttl-editor">
          <div className="admin-qr-ttl-fields">
            <label className="admin-qr-ttl-field" htmlFor={hoursId}>
              <span className="admin-qr-ttl-field-label">Hours</span>
              <div className="admin-qr-ttl-field-controls">
                <input
                  id={hoursId}
                  type="number"
                  min={0}
                  max={168}
                  className="admin-qr-hover-edit-input admin-qr-ttl-input"
                  value={hoursDraft}
                  onChange={(e) => setHoursDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    }
                  }}
                />
                <select
                  className="admin-qr-ttl-select"
                  aria-label="Hours presets"
                  value={TTL_HOUR_OPTIONS.includes(Number(hoursDraft)) ? hoursDraft : ""}
                  onChange={(e) => {
                    if (e.target.value !== "") setHoursDraft(e.target.value);
                  }}
                >
                  <option value="">Custom</option>
                  {TTL_HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="admin-qr-ttl-field" htmlFor={minutesId}>
              <span className="admin-qr-ttl-field-label">Minutes</span>
              <div className="admin-qr-ttl-field-controls">
                <input
                  id={minutesId}
                  type="number"
                  min={0}
                  max={59}
                  className="admin-qr-hover-edit-input admin-qr-ttl-input"
                  value={minutesDraft}
                  onChange={(e) => setMinutesDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    }
                  }}
                />
                <select
                  className="admin-qr-ttl-select"
                  aria-label="Minutes presets"
                  value={TTL_MINUTE_OPTIONS.includes(Number(minutesDraft)) ? minutesDraft : ""}
                  onChange={(e) => {
                    if (e.target.value !== "") setMinutesDraft(e.target.value);
                  }}
                >
                  <option value="">Custom</option>
                  {TTL_MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <div className="admin-qr-ttl-presets" role="group" aria-label="Quick durations">
            {TTL_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="admin-qr-ttl-preset"
                onClick={() => applyPreset(p.hours, p.minutes)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className="admin-qr-ttl-preset admin-qr-ttl-preset--muted"
              onClick={() => {
                setEditing(false);
                if (value.trim() !== "") onCommit("");
              }}
            >
              Default
            </button>
            <button type="button" className="admin-qr-ttl-preset admin-qr-ttl-preset--apply" onClick={commit}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-qr-hover-edit is-editable${disabled ? " is-disabled" : ""}`}>
      <span className="admin-qr-hover-edit-label">{label}</span>
      <button
        type="button"
        className="admin-qr-hover-edit-display"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setEditing(true);
        }}
        aria-label={`Edit ${label}`}
      >
        <span className="admin-qr-hover-edit-value">{shown}</span>
        {!disabled ? <EditPencilIcon /> : null}
      </button>
    </div>
  );
}

type PickProps = CommonProps & {
  value: string;
  options: BubbleDropdownOption[];
  onCommit: (next: string) => void;
  emptyHint?: string;
};

/**
 * Option picker — same bubble body style as QR card ⋮ actions menu.
 * Selection updates draft only (parent Save changes persists).
 */
export function QrHoverEditPick({
  label,
  value,
  options,
  disabled,
  onCommit,
  emptyHint = "No options yet"
}: PickProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const opts = useMemo(() => {
    if (options.length > 0) return options;
    return [{ value: "", label: emptyHint }];
  }, [options, emptyHint]);

  const shown = opts.find((o) => o.value === value)?.label ?? (value || "—");
  const canPick = options.length > 0 && !disabled;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
    let top = rect.bottom + 6;
    const estHeight = Math.min(280, 56 + opts.length * 40);
    if (top + estHeight > window.innerHeight - 12 && rect.top > estHeight + 12) {
      top = rect.top - estHeight - 6;
    }
    setCoords({ top, left, width });
  }, [open, opts.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`admin-qr-hover-edit is-editable is-pick${disabled ? " is-disabled" : ""}`}>
      <span className="admin-qr-hover-edit-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={`admin-qr-hover-edit-display admin-qr-pick-trigger${open ? " is-open" : ""}`}
        disabled={!canPick}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Choose ${label}`}
        onClick={() => {
          if (canPick) setOpen((v) => !v);
        }}
      >
        <span className="admin-qr-hover-edit-value">{shown}</span>
        {!disabled ? <EditPencilIcon /> : null}
      </button>
      {options.length === 0 ? <p className="admin-qr-hover-edit-empty">{emptyHint}</p> : null}

      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              className="admin-staff-actions-portal admin-qr-pick-portal"
              style={{ top: coords.top, left: coords.left, width: coords.width, right: "auto" }}
              role="presentation"
            >
              <div
                className="admin-top-bubble admin-top-bubble--arrow-end admin-staff-actions-bubble admin-menu-item-actions-bubble"
                role="listbox"
                aria-label={label}
              >
                <div className="admin-bubble-header">
                  <p className="admin-bubble-title">{label}</p>
                </div>
                <div className="admin-bubble-body admin-bubble-body--menu">
                  {opts.map((opt) => {
                    const active = opt.value === value;
                    return (
                      <button
                        key={opt.value || "__empty"}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`admin-bubble-menu-item w-full text-left${active ? " is-selected" : ""}`}
                        onClick={() => {
                          setOpen(false);
                          if (opt.value !== value) onCommit(opt.value);
                        }}
                      >
                        <span className="admin-bubble-item-title">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

type ToggleProps = CommonProps & {
  value: boolean;
  onLabel?: string;
  offLabel?: string;
  /** Request a change — parent shows confirm, then applies. */
  onRequestChange: (next: boolean) => void;
};

export function QrHoverEditToggle({
  label,
  value,
  disabled,
  onRequestChange,
  onLabel = "On",
  offLabel = "Off"
}: ToggleProps) {
  return (
    <div className={`admin-qr-hover-edit is-toggle${disabled ? " is-disabled" : ""}`}>
      <div className="admin-qr-hover-edit-toggle-row">
        <div className="admin-qr-hover-edit-toggle-copy">
          <span className="admin-qr-hover-edit-label">{label}</span>
          <span className="admin-qr-hover-edit-toggle-state">{value ? onLabel : offLabel}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={label}
          className={`admin-qr-toggle${value ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => {
            if (!disabled) onRequestChange(!value);
          }}
        >
          <span className="admin-qr-toggle-thumb" />
        </button>
      </div>
    </div>
  );
}

export function QrHoverEditReadonly({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="admin-qr-hover-edit is-readonly">
      <span className="admin-qr-hover-edit-label">{label}</span>
      <div className="admin-qr-hover-edit-readonly-value">{children}</div>
    </div>
  );
}

export function buildQrLabelOptions(
  rows: Array<{ locationLabel?: string | null; areaLabel?: string | null; tableLabel?: string | null }>,
  field: "locationLabel" | "areaLabel" | "tableLabel",
  current: string
): BubbleDropdownOption[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[field]?.trim();
    if (v) set.add(v);
  }
  const cur = current.trim();
  if (cur) set.add(cur);
  return [
    { value: "", label: "None" },
    ...[...set].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }))
  ];
}

/** Distinct non-empty labels for free-text suggestion lists (no "None"). */
export function buildQrLabelSuggestions(
  rows: Array<{ locationLabel?: string | null; areaLabel?: string | null; tableLabel?: string | null }>,
  field: "locationLabel" | "areaLabel" | "tableLabel"
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = row[field]?.trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

import { useEffect, useRef, useState, type ReactNode } from "react";

export type PaymentSelectOption = { value: string; label: string; hint?: string };

/** Methods-style switch used across payments config surfaces. */
export function PaymentSwitch({
  label,
  description,
  checked,
  disabled,
  onRequestChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onRequestChange: (next: boolean) => void;
}) {
  return (
    <div className={`admin-payments-method-toggle-row${disabled ? " is-disabled" : ""}`}>
      <span className="admin-payments-method-toggle-label">
        <span className="admin-payments-method-toggle-title">{label}</span>
        {description ? <span className="admin-payments-method-toggle-desc">{description}</span> : null}
      </span>
      <label className={`admin-payments-switch${disabled ? " is-disabled" : ""}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            e.preventDefault();
            onRequestChange(e.target.checked);
          }}
          aria-label={label}
        />
        <span className="admin-payments-switch-track" aria-hidden>
          <span className="admin-payments-switch-thumb" />
        </span>
      </label>
    </div>
  );
}

/** White expand-down select (settlement / rules mode pattern). */
export function PaymentExpandSelect({
  label,
  value,
  options,
  disabled,
  onRequestChange
}: {
  label: string;
  value: string;
  options: PaymentSelectOption[];
  disabled?: boolean;
  onRequestChange: (next: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="admin-payments-expand-select" ref={rootRef}>
      <span className="admin-payments-expand-select-label">{label}</span>
      <div className={`admin-payments-expand-select-body${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}>
        <button
          type="button"
          className="admin-payments-expand-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
        >
          <span className="admin-payments-expand-select-value">{selected?.label ?? value}</span>
          <span className={`admin-payments-expand-select-chevron${open ? " is-open" : ""}`} aria-hidden>
            ▾
          </span>
        </button>
        <div className="admin-payments-expand-select-panel" aria-hidden={!open}>
          <div className="admin-payments-expand-select-panel-inner" role="listbox" aria-label={label}>
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`admin-payments-expand-select-option${active ? " is-selected" : ""}`}
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    if (opt.value === value) return;
                    onRequestChange(opt.value);
                  }}
                >
                  <span className="admin-payments-expand-select-option-label">{opt.label}</span>
                  {opt.hint ? <span className="admin-payments-expand-select-option-hint">{opt.hint}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaymentSourceChip({
  label,
  active,
  disabled,
  onToggle
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`admin-payments-source-chip${active ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
      disabled={disabled}
      aria-pressed={active}
      onClick={() => {
        if (disabled) return;
        onToggle(!active);
      }}
    >
      <span className="admin-payments-source-chip-mark" aria-hidden>
        {active ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

export function PaymentChipGroup({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-payments-chip-group">
      <p className="admin-payments-chip-group-label">{label}</p>
      <div className="admin-payments-chip-group-row">{children}</div>
    </div>
  );
}

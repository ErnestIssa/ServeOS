type Props = {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  highlighted?: boolean;
  disabled?: boolean;
};

export function PreferenceToggle({ label, hint, checked, onChange, highlighted, disabled }: Props) {
  return (
    <label
      className={`comm-pref-toggle-row${highlighted ? " is-highlighted" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <span className="comm-pref-toggle-copy">
        <span className="comm-pref-toggle-label">{label}</span>
        {hint ? <span className="comm-pref-toggle-hint">{hint}</span> : null}
      </span>
      <span className="comm-pref-toggle">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="comm-pref-toggle-track" aria-hidden />
      </span>
    </label>
  );
}

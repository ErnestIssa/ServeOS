import { ProfileToggleRow } from "./ProfileUi";

export function ProfileExclusiveToggleGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="admin-profile-exclusive-toggles">
      {options.map((opt) => (
        <ProfileToggleRow
          key={opt.value}
          label={opt.label}
          checked={value === opt.value}
          onChange={(on) => {
            if (!disabled && on) onChange(opt.value);
          }}
        />
      ))}
    </div>
  );
}
